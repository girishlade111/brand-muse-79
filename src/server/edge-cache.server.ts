// Cloudflare Edge Cache API (caches.default) Integration
// Heavily caches the public Brand Guidelines portals at the edge
// to handle high media/asset traffic with sub-30ms response times
// without hitting the PostgreSQL database.

interface InMemoryCacheEntry {
  data: any;
  expiresAt: number;
  headers: Record<string, string>;
}

// In-memory fallback cache for Node.js / local Vite dev runtime
const memoryCache = new Map<string, InMemoryCacheEntry>();

/**
 * Normalizes a slug or custom domain into a deterministic edge cache URL key.
 */
export function buildPortalCacheKey(identifier: string): string {
  const clean = identifier
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "");
  return `https://edge-cache.branddna.internal/portal/${clean}`;
}

/**
 * Retrieves cached portal payload from Cloudflare Workers edge cache
 * (caches.default) or in-memory fallback.
 */
export async function getEdgeCachedJson<T = any>(cacheKeyUrl: string): Promise<T | null> {
  try {
    const cfCache = (globalThis as any).caches?.default;
    if (cfCache && typeof cfCache.match === "function") {
      const cacheReq = new Request(cacheKeyUrl, { method: "GET" });
      const cachedRes = await cfCache.match(cacheReq);
      if (cachedRes) {
        return (await cachedRes.json()) as T;
      }
    }
  } catch (err) {
    console.warn("[edge-cache] Cloudflare Cache API match warning:", err);
  }

  // Fallback to in-memory cache
  const entry = memoryCache.get(cacheKeyUrl);
  if (entry) {
    if (Date.now() < entry.expiresAt) {
      return entry.data as T;
    }
    memoryCache.delete(cacheKeyUrl);
  }

  return null;
}

/**
 * Stores portal payload into Cloudflare Workers edge cache (caches.default)
 * and in-memory fallback with aggressive cache headers.
 */
export async function setEdgeCachedJson(
  cacheKeyUrl: string,
  data: any,
  sMaxAgeSeconds: number = 3600,
): Promise<void> {
  const browserMaxAge = Math.min(sMaxAgeSeconds, 120); // 2 minutes in browser, 1 hour at edge
  const cacheControl = `public, max-age=${browserMaxAge}, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=86400`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheControl,
    "CF-Cache-Status": "HIT",
    "X-Edge-Cache": "HIT",
    "X-Cache-Key": cacheKeyUrl,
  };

  // 1. Cloudflare Workers Cache API
  try {
    const cfCache = (globalThis as any).caches?.default;
    if (cfCache && typeof cfCache.put === "function") {
      const cacheReq = new Request(cacheKeyUrl, { method: "GET" });
      const cacheRes = new Response(JSON.stringify(data), {
        status: 200,
        headers,
      });
      await cfCache.put(cacheReq, cacheRes);
    }
  } catch (err) {
    console.warn("[edge-cache] Cloudflare Cache API put warning:", err);
  }

  // 2. In-memory cache fallback
  memoryCache.set(cacheKeyUrl, {
    data,
    expiresAt: Date.now() + sMaxAgeSeconds * 1000,
    headers,
  });

  // Prune expired memory cache if map grows large
  if (memoryCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of memoryCache.entries()) {
      if (v.expiresAt <= now) memoryCache.delete(k);
    }
  }
}

/**
 * Purges a portal's cached payload from Cloudflare Workers edge cache
 * and in-memory cache when a brand kit is republished or edited.
 */
export async function purgePortalEdgeCache(identifier: string): Promise<boolean> {
  const cacheKeyUrl = buildPortalCacheKey(identifier);
  let purgedCf = false;

  try {
    const cfCache = (globalThis as any).caches?.default;
    if (cfCache && typeof cfCache.delete === "function") {
      const cacheReq = new Request(cacheKeyUrl, { method: "GET" });
      purgedCf = await cfCache.delete(cacheReq);
    }
  } catch (err) {
    console.warn("[edge-cache] Cloudflare Cache API delete warning:", err);
  }

  memoryCache.delete(cacheKeyUrl);
  return purgedCf || true;
}
