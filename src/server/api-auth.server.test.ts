import { describe, it, expect, beforeEach } from "vitest";
import {
  generateRawApiKey,
  hashApiKey,
  checkRateLimit,
  resetRateLimitStore,
  authenticateApiRequest,
  extractBearerOrApiKey,
  executeGenerateApiKey,
  executeListApiKeys,
  executeRevokeApiKey,
} from "./api-auth.server";

describe("Developer API Authentication & Rate Limiting Engine", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  describe("API Key Hashing & Format", () => {
    it("generates keys with 'bm_live_' prefix and produces deterministic SHA-256 hash", () => {
      const { rawKey, prefix, keyHash } = generateRawApiKey();

      expect(rawKey).toMatch(/^bm_live_[a-f0-9]{48}$/);
      expect(prefix).toMatch(/^bm_live_[a-f0-9]{8}\.\.\.$/);
      expect(keyHash).toHaveLength(64); // SHA-256 hex string

      // Verify hash is deterministic
      expect(hashApiKey(rawKey)).toBe(keyHash);
    });

    it("extracts API key from Authorization Bearer header, X-API-Key, or query param", () => {
      // 1. Authorization: Bearer <key>
      const req1 = new Request("https://api.brandmuse.io/api/v1/extract", {
        headers: { Authorization: "Bearer bm_live_123456" },
      });
      expect(extractBearerOrApiKey(req1)).toBe("bm_live_123456");

      // 2. X-API-Key
      const req2 = new Request("https://api.brandmuse.io/api/v1/extract", {
        headers: { "X-API-Key": "bm_live_custom_key" },
      });
      expect(extractBearerOrApiKey(req2)).toBe("bm_live_custom_key");

      // 3. Query parameter ?api_key=<key>
      const req3 = new Request(
        "https://api.brandmuse.io/api/v1/kits/123/css?api_key=bm_live_query_key",
      );
      expect(extractBearerOrApiKey(req3)).toBe("bm_live_query_key");
    });
  });

  describe("Sliding Window Rate Limiter", () => {
    it("permits requests under the limit and tracks remaining quota", () => {
      const keyId = "test-key-hash-1";
      const limit = 5;

      const r1 = checkRateLimit(keyId, limit);
      expect(r1.allowed).toBe(true);
      expect(r1.limit).toBe(5);
      expect(r1.remaining).toBe(4);

      const r2 = checkRateLimit(keyId, limit);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(3);
    });

    it("blocks requests once limit is exceeded and provides retryAfter seconds", () => {
      const keyId = "test-key-hash-2";
      const limit = 3;
      const startTime = 1727088000000;

      expect(checkRateLimit(keyId, limit, startTime).allowed).toBe(true);
      expect(checkRateLimit(keyId, limit, startTime + 1000).allowed).toBe(true);
      expect(checkRateLimit(keyId, limit, startTime + 2000).allowed).toBe(true);

      // 4th request exceeds limit
      const blocked = checkRateLimit(keyId, limit, startTime + 3000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });

    it("resets quota after 60-second window expires", () => {
      const keyId = "test-key-hash-3";
      const limit = 2;
      const startTime = 1727088000000;

      checkRateLimit(keyId, limit, startTime);
      checkRateLimit(keyId, limit, startTime + 1000);
      expect(checkRateLimit(keyId, limit, startTime + 2000).allowed).toBe(false);

      // 61 seconds later
      const refreshed = checkRateLimit(keyId, limit, startTime + 61000);
      expect(refreshed.allowed).toBe(true);
      expect(refreshed.remaining).toBe(1);
    });
  });

  describe("authenticateApiRequest Handler", () => {
    it("returns 401 when no credentials are provided", async () => {
      const req = new Request("https://api.brandmuse.io/api/v1/extract");
      const res = await authenticateApiRequest(req);

      expect(res.authenticated).toBe(false);
      if (!res.authenticated) {
        expect(res.status).toBe(401);
        expect(res.error).toContain("Missing API Key");
        expect(res.headers["WWW-Authenticate"]).toBeDefined();
      }
    });

    it("returns 401 when invalid API key is provided", async () => {
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      };

      const req = new Request("https://api.brandmuse.io/api/v1/extract", {
        headers: { "X-API-Key": "bm_live_nonexistent" },
      });

      const res = await authenticateApiRequest(req, { db: mockDb });
      expect(res.authenticated).toBe(false);
      if (!res.authenticated) {
        expect(res.status).toBe(401);
        expect(res.error).toContain("Invalid or revoked");
      }
    });

    it("successfully authenticates a valid API key and attaches rate limit headers", async () => {
      const testRawKey = "bm_live_0123456789abcdef0123456789abcdef0123456789abcdef";
      const keyHash = hashApiKey(testRawKey);

      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  {
                    id: "key-uuid-1",
                    userId: "user-42",
                    keyHash,
                    prefix: "bm_live_01234567...",
                    name: "Test API Key",
                    rateLimitPerMin: 60,
                    createdAt: new Date(),
                  },
                ]),
            }),
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => Promise.resolve(),
          }),
        }),
      };

      const req = new Request("https://api.brandmuse.io/api/v1/extract", {
        headers: { Authorization: `Bearer ${testRawKey}` },
      });

      const res = await authenticateApiRequest(req, { db: mockDb });
      expect(res.authenticated).toBe(true);
      if (res.authenticated) {
        expect(res.userId).toBe("user-42");
        expect(res.apiKey.name).toBe("Test API Key");
        expect(res.headers["X-RateLimit-Limit"]).toBe("60");
        expect(res.headers["X-RateLimit-Remaining"]).toBeDefined();
      }
    });
  });

  describe("Key Management Operations", () => {
    it("generates an API key and inserts into database", async () => {
      const mockInserted: any[] = [];
      const mockDb = {
        insert: () => ({
          values: (val: any) => ({
            returning: () => {
              const row = { ...val, id: "key-uuid-1", createdAt: new Date() };
              mockInserted.push(row);
              return Promise.resolve([row]);
            },
          }),
        }),
      };

      const res = await executeGenerateApiKey(
        { userId: "user-100", name: "Production App", rateLimitPerMin: 120 },
        { db: mockDb },
      );

      expect(res.ok).toBe(true);
      expect(res.rawKey).toMatch(/^bm_live_/);
      expect(res.apiKey.name).toBe("Production App");
      expect(res.apiKey.rateLimitPerMin).toBe(120);
      expect(mockInserted.length).toBe(1);
      expect(mockInserted[0].keyHash).toBe(hashApiKey(res.rawKey));
    });

    it("lists API keys for a user without leaking keyHash", async () => {
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () =>
                Promise.resolve([
                  {
                    id: "key-1",
                    userId: "user-100",
                    prefix: "bm_live_abc123...",
                    name: "App 1",
                    lastUsedAt: null,
                    rateLimitPerMin: 60,
                    createdAt: new Date(),
                  },
                ]),
            }),
          }),
        }),
      };

      const keys = await executeListApiKeys({ userId: "user-100" }, { db: mockDb });
      expect(keys.length).toBe(1);
      expect((keys[0] as any).keyHash).toBeUndefined();
      expect(keys[0].prefix).toBe("bm_live_abc123...");
    });

    it("revokes an API key", async () => {
      let deleted = false;
      const mockDb = {
        delete: () => ({
          where: () => {
            deleted = true;
            return Promise.resolve();
          },
        }),
      };

      const res = await executeRevokeApiKey(
        { keyId: "11111111-1111-1111-1111-111111111111", userId: "user-100" },
        { db: mockDb },
      );

      expect(res.ok).toBe(true);
      expect(deleted).toBe(true);
    });
  });
});
