// Multi-Tiered Edge Caching Layer
// Tier 1: Microsecond in-memory LRU cache for edge isolates
// Tier 2: Distributed Upstash Redis (HTTP REST) / Cloudflare KV
// Zero native socket bindings — 100% Cloudflare Workers & Node.js edge compatible.

import { Redis } from "@upstash/redis";

export interface CacheOptions {
  ttlSeconds: number;
  tag?: string;
  skipL1?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  l1Hits: number;
  l2Hits: number;
  totalRequests: number;
  hitRatio: number;
}

interface MemoryCacheEntry<T> {
  data: T;
  expiresAt: number;
  tag?: string;
  createdAt: number;
}

// Tier 1: In-Memory L1 Cache
const MAX_L1_ITEMS = 1000;
const l1Cache = new Map<string, MemoryCacheEntry<any>>();
const l1TagMap = new Map<string, Set<string>>();

// Metrics Telemetry
let stats: CacheStats = {
  hits: 0,
  misses: 0,
  l1Hits: 0,
  l2Hits: 0,
  totalRequests: 0,
  hitRatio: 0,
};

// Tier 2: Upstash Redis Client (Lazy Singleton)
let redisClient: Redis | null = null;
let redisInitialized = false;

function getRedisClient(): Redis | null {
  if (redisInitialized) return redisClient;
  redisInitialized = true;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (url && token) {
    try {
      redisClient = new Redis({
        url,
        token,
      });
    } catch (e) {
      console.warn("[cache.server] Failed to initialize Upstash Redis:", e);
      redisClient = null;
    }
  }
  return redisClient;
}

/**
 * Deterministic hash for string keys (e.g. long URLs).
 */
export function hashUrlKey(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function updateStats(type: "l1_hit" | "l2_hit" | "miss") {
  stats.totalRequests++;
  if (type === "l1_hit") {
    stats.hits++;
    stats.l1Hits++;
  } else if (type === "l2_hit") {
    stats.hits++;
    stats.l2Hits++;
  } else {
    stats.misses++;
  }
  stats.hitRatio = stats.totalRequests > 0 ? stats.hits / stats.totalRequests : 0;
}

/**
 * Returns current cache telemetry.
 */
export function getCacheStats(): CacheStats {
  return { ...stats };
}

/**
 * Resets cache telemetry (used for benchmarking).
 */
export function resetCacheStats(): void {
  stats = {
    hits: 0,
    misses: 0,
    l1Hits: 0,
    l2Hits: 0,
    totalRequests: 0,
    hitRatio: 0,
  };
}

/**
 * Clears all L1 memory cache entries (used for tests/benchmarks).
 */
export function clearL1Cache(): void {
  l1Cache.clear();
  l1TagMap.clear();
}

/**
 * Retrieves a cached entry across L1 (Memory) and L2 (Upstash Redis / Cloudflare KV).
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  const now = Date.now();

  // 1. Check L1 Memory Cache
  const l1Entry = l1Cache.get(key);
  if (l1Entry) {
    if (l1Entry.expiresAt > now) {
      updateStats("l1_hit");
      return l1Entry.data as T;
    }
    // Expired
    l1Cache.delete(key);
  }

  // 2. Check L2 Upstash Redis / Cloudflare KV
  const redis = getRedisClient();
  if (redis) {
    try {
      const data = await redis.get<T>(key);
      if (data !== null && data !== undefined) {
        updateStats("l2_hit");
        // Backfill into L1 memory for sub-millisecond future hits
        const remainingTtlSeconds = 300; // 5 min local buffer
        setL1Cache(key, data, remainingTtlSeconds);
        return data;
      }
    } catch (e) {
      console.warn(`[cache.server] Redis get error for key ${key}:`, e);
    }
  }

  // 3. Check Cloudflare KV if bound
  const cfKv = (globalThis as any).KV || (globalThis as any).__env__?.KV;
  if (cfKv && typeof cfKv.get === "function") {
    try {
      const raw = await cfKv.get(key, "json");
      if (raw !== null && raw !== undefined) {
        updateStats("l2_hit");
        setL1Cache(key, raw, 300);
        return raw as T;
      }
    } catch (e) {
      console.warn(`[cache.server] Cloudflare KV get error for key ${key}:`, e);
    }
  }

  updateStats("miss");
  return null;
}

/**
 * Stores a value in both L1 and L2 caches with TTL.
 */
export async function setCache<T = any>(
  key: string,
  value: T,
  ttlSeconds: number,
  tag?: string,
): Promise<void> {
  // 1. Store in L1 Memory
  setL1Cache(key, value, ttlSeconds, tag);

  // 2. Store in L2 Redis
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
      if (tag) {
        await redis.sadd(`tag:${tag}`, key);
        await redis.expire(`tag:${tag}`, ttlSeconds);
      }
    } catch (e) {
      console.warn(`[cache.server] Redis set error for key ${key}:`, e);
    }
  }

  // 3. Store in Cloudflare KV if present
  const cfKv = (globalThis as any).KV || (globalThis as any).__env__?.KV;
  if (cfKv && typeof cfKv.put === "function") {
    try {
      await cfKv.put(key, JSON.stringify(value), { expirationTtl: Math.max(60, ttlSeconds) });
    } catch (e) {
      console.warn(`[cache.server] Cloudflare KV put error for key ${key}:`, e);
    }
  }
}

function setL1Cache<T>(key: string, data: T, ttlSeconds: number, tag?: string): void {
  // Prune if L1 cache reaches limit
  if (l1Cache.size >= MAX_L1_ITEMS) {
    const oldestKey = l1Cache.keys().next().value;
    if (oldestKey) l1Cache.delete(oldestKey);
  }

  l1Cache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
    tag,
    createdAt: Date.now(),
  });

  if (tag) {
    let keySet = l1TagMap.get(tag);
    if (!keySet) {
      keySet = new Set();
      l1TagMap.set(tag, keySet);
    }
    keySet.add(key);
  }
}

/**
 * Reads from cache or computes value via fetcher and populates cache.
 */
export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions,
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  const fresh = await fetcher();
  if (fresh !== null && fresh !== undefined) {
    await setCache(key, fresh, options.ttlSeconds, options.tag);
  }
  return fresh;
}

/**
 * Invalidates a specific key from all cache tiers.
 */
export async function invalidateCache(key: string): Promise<void> {
  l1Cache.delete(key);

  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(key);
    } catch (e) {
      console.warn(`[cache.server] Redis del error for key ${key}:`, e);
    }
  }

  const cfKv = (globalThis as any).KV || (globalThis as any).__env__?.KV;
  if (cfKv && typeof cfKv.delete === "function") {
    try {
      await cfKv.delete(key);
    } catch (e) {
      console.warn(`[cache.server] Cloudflare KV delete error for key ${key}:`, e);
    }
  }
}

/**
 * Invalidates all keys associated with a tag from all cache tiers.
 */
export async function invalidateByTag(tag: string): Promise<void> {
  // 1. Invalidate L1 keys
  const l1Keys = l1TagMap.get(tag);
  if (l1Keys) {
    for (const k of l1Keys) {
      l1Cache.delete(k);
    }
    l1TagMap.delete(tag);
  }

  // 2. Invalidate L2 Redis keys
  const redis = getRedisClient();
  if (redis) {
    try {
      const tagKey = `tag:${tag}`;
      const keys = await redis.smembers<string[]>(tagKey);
      if (keys && keys.length > 0) {
        await redis.del(...keys, tagKey);
      }
    } catch (e) {
      console.warn(`[cache.server] Redis tag invalidation error for tag ${tag}:`, e);
    }
  }
}

// ============================================================================
// Granular Domain-Specific Cache Rule Helpers
// ============================================================================

/**
 * Rule 1: Google Fonts Catalog Lookup (TTL: 7 Days / 604,800 seconds)
 */
export async function cacheGoogleFontCatalog<T>(
  family: string,
  weights: string[] | undefined,
  fetcher: () => Promise<T>,
): Promise<T> {
  const normalizedFamily = family.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  const normalizedWeights = (weights ?? []).map((w) => String(w).trim()).sort().join("_");
  const key = `gfont_catalog:${normalizedFamily}:${normalizedWeights || "default"}`;
  return getOrSet(key, fetcher, {
    ttlSeconds: 604800, // 7 days
    tag: "google_fonts",
  });
}

/**
 * Rule 2: Scraped URL raw HTML / Markdown (TTL: 24 Hours / 86,400 seconds)
 * Keyed by deterministic URL hash to avoid duplicate Firecrawl API credits.
 */
export async function cacheScrapedUrl<T>(
  url: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const hash = hashUrlKey(url.trim().toLowerCase());
  const key = `scraped_url:${hash}`;
  return getOrSet(key, fetcher, {
    ttlSeconds: 86400, // 24 hours
    tag: "scraped_urls",
  });
}

/**
 * Rule 3: Normalized Brand Kit Public Reads (TTL: 1 Hour / 3,600 seconds)
 * Instantly invalidated upon edit via invalidateKitCache.
 */
export async function cacheNormalizedKit<T>(
  kitId: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const key = `brand_kit:${kitId}:normalized`;
  return getOrSet(key, fetcher, {
    ttlSeconds: 3600, // 1 hour
    tag: `kit:${kitId}`,
  });
}

/**
 * Instant invalidation for normalized brand kit cache.
 * Called on any studio edit, token update, or re-extraction.
 */
export async function invalidateKitCache(kitId: string): Promise<void> {
  const key = `brand_kit:${kitId}:normalized`;
  await invalidateCache(key);
  await invalidateByTag(`kit:${kitId}`);
}
