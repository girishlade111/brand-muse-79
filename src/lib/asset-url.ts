// Client-safe helper to resolve an asset row to a displayable URL.
// Prefers the stored absolute `url`; falls back to VITE_R2_PUBLIC_URL +
// storage_path (post Supabase -> R2 migration).
export function publicAssetUrl(a: { storage_path?: string | null; url?: string | null }): string {
  if (a.storage_path) {
    const base = (
      (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_R2_PUBLIC_URL ?? ""
    ).replace(/\/+$/, "");
    const clean = String(a.storage_path).replace(/^\/+/, "");
    if (base) return `${base}/${clean}`;
  }
  return a.url ?? "";
}
