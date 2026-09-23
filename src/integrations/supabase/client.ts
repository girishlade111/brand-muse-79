// Supabase Client Integration for Browser and Edge Runtimes
// Uses @supabase/supabase-js with standard fetch dispatch.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseConfig(): { url: string; anonKey: string } {
  const url =
    (typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined) ||
    (typeof process !== "undefined" ? process.env.VITE_SUPABASE_URL : undefined) ||
    "https://placeholder.supabase.co";

  const anonKey =
    (typeof process !== "undefined" ? process.env.SUPABASE_ANON_KEY : undefined) ||
    (typeof process !== "undefined" ? process.env.VITE_SUPABASE_ANON_KEY : undefined) ||
    "placeholder-anon-key";

  return { url, anonKey };
}

let cachedClient: SupabaseClient | null = null;

/**
 * Returns a typed Supabase client singleton configured with anon key.
 */
export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const { url, anonKey } = getSupabaseConfig();
  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return cachedClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseClient(), prop, receiver);
  },
});

export { createClient };
