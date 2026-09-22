// Anonymous kit ownership token stored in localStorage.
// Lets a non-logged-in user keep working with their kit across reloads.
const KEY = "branddna.anon_token";
const HISTORY_KEY = "branddna.anon_token_history";

export function getAnonToken(): string {
  if (typeof window === "undefined") return "";
  let t: string | null = null;
  try {
    t = localStorage.getItem(KEY);
  } catch {
    t = null;
  }
  if (!t) {
    t =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // Private mode / quota — return ephemeral token.
    }
  }
  // Always make sure the active token is recorded in history.
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
    if (!list.includes(t)) {
      list.push(t);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-20)));
    }
  } catch {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify([t]));
    } catch {
      // Ignore persistence failures.
    }
  }
  return t;
}

// Returns every anon token this browser has ever used (most recent last),
// including the active one. Useful for listing kits that may have been
// created under a previous token before localStorage rotated.
export function getAnonTokenHistory(): string[] {
  if (typeof window === "undefined") return [];
  const active = getAnonToken();
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
    if (active && !list.includes(active)) list.push(active);
    return Array.from(new Set(list));
  } catch {
    return active ? [active] : [];
  }
}
