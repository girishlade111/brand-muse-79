// Supabase Service-Role Admin Client & Server Abstraction Shim
// Supports legacy workflows and admin scripts when running with Supabase backend.
// Re-exports unified database (`@/db/index.server`) and object storage (`./storage.server`).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { db, getDb, isSupabaseProvider } from "@/db/index.server";

let cachedAdmin: SupabaseClient | null = null;

export function getAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    if (isSupabaseProvider()) {
      throw new Error(
        "DATABASE_PROVIDER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }
    // Simulation / fallback client when in Neon mode
    cachedAdmin = createClient(
      url || "https://placeholder.supabase.co",
      serviceRoleKey || "placeholder-service-key",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
    return cachedAdmin;
  }

  cachedAdmin = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedAdmin;
}

export { db, getDb };
export { uploadAsset, deleteAsset, publicUrlFor, urlForAsset } from "./storage.server";
