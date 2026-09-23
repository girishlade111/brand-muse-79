// Developer REST API Key Authentication & Rate Limiting Engine.
// Handles API key hashing (SHA-256), token-bucket sliding-window rate limiting,
// and key lifecycle (creation, inspection, revocation).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { db, apiKeys, type ApiKey } from "@/db/index.server";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Rate Limiter: In-Memory Sliding Window Bucket (Per Key Hash)
// ---------------------------------------------------------------------------

type RateLimitBucket = {
  count: number;
  resetAt: number; // Unix timestamp in ms
};

const rateLimitStore = new Map<string, RateLimitBucket>();

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
  retryAfter: number; // seconds
};

export function checkRateLimit(
  keyIdentifier: string,
  limitPerMin = 60,
  now = Date.now(),
): RateLimitResult {
  const windowMs = 60 * 1000;
  let bucket = rateLimitStore.get(keyIdentifier);

  if (!bucket || now >= bucket.resetAt) {
    bucket = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(keyIdentifier, bucket);
    return {
      allowed: true,
      limit: limitPerMin,
      remaining: Math.max(0, limitPerMin - 1),
      reset: Math.ceil(bucket.resetAt / 1000),
      retryAfter: 0,
    };
  }

  if (bucket.count < limitPerMin) {
    bucket.count += 1;
    return {
      allowed: true,
      limit: limitPerMin,
      remaining: Math.max(0, limitPerMin - bucket.count),
      reset: Math.ceil(bucket.resetAt / 1000),
      retryAfter: 0,
    };
  }

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return {
    allowed: false,
    limit: limitPerMin,
    remaining: 0,
    reset: Math.ceil(bucket.resetAt / 1000),
    retryAfter,
  };
}

export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}

// ---------------------------------------------------------------------------
// Key Generation & Hashing Helpers
// ---------------------------------------------------------------------------

export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey.trim()).digest("hex");
}

export function generateRawApiKey(): { rawKey: string; prefix: string; keyHash: string } {
  const randomBytes = crypto.randomBytes(24).toString("hex");
  const rawKey = `bm_live_${randomBytes}`;
  const prefix = `bm_live_${randomBytes.slice(0, 8)}...`;
  const keyHash = hashApiKey(rawKey);
  return { rawKey, prefix, keyHash };
}

import {
  GenerateApiKeyInputSchema,
  ListApiKeysInputSchema,
  RevokeApiKeyInputSchema,
  type GenerateApiKeyInput,
  type ListApiKeysInput,
  type RevokeApiKeyInput,
  type GenerateApiKeyResult,
} from "@/lib/api-keys";

export {
  GenerateApiKeyInputSchema,
  ListApiKeysInputSchema,
  RevokeApiKeyInputSchema,
  type GenerateApiKeyInput,
  type ListApiKeysInput,
  type RevokeApiKeyInput,
  type GenerateApiKeyResult,
};

// ---------------------------------------------------------------------------
// Authentication Result & Header Generator
// ---------------------------------------------------------------------------

export type AuthenticateApiKeyResult =
  | {
      authenticated: true;
      apiKey: ApiKey;
      userId: string;
      rateLimit: RateLimitResult;
      headers: Record<string, string>;
    }
  | {
      authenticated: false;
      status: number;
      error: string;
      rateLimit?: RateLimitResult;
      headers: Record<string, string>;
    };

export function extractBearerOrApiKey(request: Request | any): string | null {
  if (!request) return null;

  // 1. Check standard headers
  const getHeader = (name: string): string | null => {
    if (typeof request.headers?.get === "function") {
      return request.headers.get(name);
    }
    if (request.headers && typeof request.headers === "object") {
      const lower = name.toLowerCase();
      return request.headers[lower] || request.headers[name] || null;
    }
    return null;
  };

  const authHeader = getHeader("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) return match[1].trim();
  }

  const customKeyHeader = getHeader("x-api-key");
  if (customKeyHeader) return customKeyHeader.trim();

  // 2. Check query string
  try {
    const rawUrl = request.url || "";
    if (rawUrl.includes("?")) {
      const url = new URL(rawUrl, "http://localhost");
      const paramKey = url.searchParams.get("api_key") || url.searchParams.get("token");
      if (paramKey) return paramKey.trim();
    }
  } catch {}

  return null;
}

export async function authenticateApiRequest(
  request: Request | any,
  overrides?: { db?: any },
): Promise<AuthenticateApiKeyResult> {
  const activeDb = overrides?.db || db;
  const rawKey = extractBearerOrApiKey(request);

  if (!rawKey) {
    return {
      authenticated: false,
      status: 401,
      error:
        "Unauthorized: Missing API Key. Provide via 'Authorization: Bearer bm_live_...' or 'X-API-Key' header.",
      headers: {
        "WWW-Authenticate": 'Bearer realm="BrandMuse API"',
        "Content-Type": "application/json",
      },
    };
  }

  const hashed = hashApiKey(rawKey);

  let apiKeyRecord: ApiKey | undefined;
  if (activeDb) {
    try {
      const rows = await activeDb
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, hashed))
        .limit(1);
      apiKeyRecord = rows[0];
    } catch (dbErr) {
      console.error("[api-auth.server] Failed to query api_keys:", dbErr);
    }
  }

  if (!apiKeyRecord) {
    return {
      authenticated: false,
      status: 401,
      error: "Unauthorized: Invalid or revoked API Key.",
      headers: {
        "WWW-Authenticate": 'Bearer realm="BrandMuse API"',
        "Content-Type": "application/json",
      },
    };
  }

  // Rate Limiting
  const rateLimit = checkRateLimit(apiKeyRecord.keyHash, apiKeyRecord.rateLimitPerMin || 60);

  const rateLimitHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(rateLimit.reset),
  };

  if (!rateLimit.allowed) {
    return {
      authenticated: false,
      status: 429,
      error: `Rate limit exceeded: maximum ${rateLimit.limit} requests per minute.`,
      rateLimit,
      headers: {
        ...rateLimitHeaders,
        "Retry-After": String(rateLimit.retryAfter),
        "Content-Type": "application/json",
      },
    };
  }

  // Asynchronously bump lastUsedAt
  if (activeDb) {
    activeDb
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKeyRecord.id))
      .catch(() => {});
  }

  return {
    authenticated: true,
    apiKey: apiKeyRecord,
    userId: apiKeyRecord.userId,
    rateLimit,
    headers: rateLimitHeaders,
  };
}

// ---------------------------------------------------------------------------
// Pure Handlers (Directly Testable)
// ---------------------------------------------------------------------------

export async function executeGenerateApiKey(
  input: GenerateApiKeyInput,
  overrides?: { db?: any },
): Promise<GenerateApiKeyResult> {
  const activeDb = overrides?.db || db;
  const { rawKey, prefix, keyHash } = generateRawApiKey();

  const [created] = await activeDb
    .insert(apiKeys)
    .values({
      userId: input.userId,
      name: input.name,
      prefix,
      keyHash,
      rateLimitPerMin: input.rateLimitPerMin || 60,
    })
    .returning();

  return {
    ok: true,
    rawKey,
    apiKey: {
      id: created.id,
      userId: created.userId,
      prefix: created.prefix,
      name: created.name,
      rateLimitPerMin: created.rateLimitPerMin,
      createdAt: created.createdAt.toISOString(),
    },
  };
}

export async function executeListApiKeys(
  input: ListApiKeysInput,
  overrides?: { db?: any },
): Promise<Array<Omit<ApiKey, "keyHash">>> {
  const activeDb = overrides?.db || db;
  const rows = await activeDb
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      prefix: apiKeys.prefix,
      name: apiKeys.name,
      lastUsedAt: apiKeys.lastUsedAt,
      rateLimitPerMin: apiKeys.rateLimitPerMin,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, input.userId))
    .orderBy(desc(apiKeys.createdAt));

  return rows;
}

export async function executeRevokeApiKey(
  input: RevokeApiKeyInput,
  overrides?: { db?: any },
): Promise<{ ok: boolean }> {
  const activeDb = overrides?.db || db;
  await activeDb
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, input.keyId), eq(apiKeys.userId, input.userId)));

  return { ok: true };
}

// ---------------------------------------------------------------------------
// TanStack Start Server Functions
// ---------------------------------------------------------------------------

export const generateApiKeyFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => GenerateApiKeyInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeGenerateApiKey(data);
  });

export const listApiKeysFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => ListApiKeysInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeListApiKeys(data);
  });

export const revokeApiKeyFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => RevokeApiKeyInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeRevokeApiKey(data);
  });
