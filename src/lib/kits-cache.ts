// Lightweight client-side cache for the kit list.
// Lets the library + landing page render instantly while we revalidate.
const KEY = "branddna.kits_cache.v1";

export type CachedKit = {
  id: string;
  name: string;
  source_url: string | null;
  status: string;
  created_at: string;
  primaryHex: string | null;
  palette?: string[];
  displayFont?: {
    family: string;
    google: boolean;
    source_family?: string | null;
    weights?: string[] | null;
    file_urls?: Array<{ url: string; weight?: string; style?: string; format?: string }> | null;
  } | null;
  logoUrl?: string | null;
};

const MAX_CACHED_KITS = 100;

function isValidCachedKit(k: unknown): k is CachedKit {
  if (!k || typeof k !== "object") return false;
  const r = k as Record<string, unknown>;
  return typeof r.id === "string" && typeof r.name === "string";
}

export function readKitsCache(): CachedKit[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(isValidCachedKit);
    if (!valid.length) return null;
    return valid.slice(0, MAX_CACHED_KITS);
  } catch {
    return null;
  }
}

export function writeKitsCache(kits: CachedKit[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(kits.slice(0, MAX_CACHED_KITS)));
  } catch {
    try {
      localStorage.setItem(KEY, JSON.stringify(kits.slice(0, 20)));
    } catch {
      /* quota — ignore */
    }
  }
}
