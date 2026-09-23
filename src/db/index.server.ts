// Database Compatibility Layer: Neon Serverless PostgreSQL & Supabase PostgreSQL
// Uses @neondatabase/serverless Pool over fetch (poolQueryViaFetch = true)
// ensuring 100% Cloudflare Workers edge compatibility without Node.js socket bindings.
//
// Seamless switching via DATABASE_PROVIDER=supabase|neon.

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Ensure queries route through HTTP fetch instead of native WebSockets or TCP sockets.
// Critical for Cloudflare Workers edge isolates and serverless cold starts.
neonConfig.poolQueryViaFetch = true;

export type DatabaseProvider = "neon" | "supabase";

export function getDatabaseProvider(): DatabaseProvider {
  const provider = (process.env.DATABASE_PROVIDER || "neon").toLowerCase().trim();
  return provider === "supabase" ? "supabase" : "neon";
}

export function isSupabaseProvider(): boolean {
  return getDatabaseProvider() === "supabase";
}

export function isNeonProvider(): boolean {
  return getDatabaseProvider() === "neon";
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cachedDb: Db | null = null;
let cachedPool: Pool | null = null;

export function resolveDatabaseUrl(): string {
  const provider = getDatabaseProvider();
  if (provider === "supabase") {
    const url = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();
    if (!url) {
      throw new Error(
        "DATABASE_PROVIDER=supabase requires SUPABASE_DB_URL or DATABASE_URL (Supabase pooled connection string on port 6543).",
      );
    }
    return url;
  }

  // Neon provider
  const url = process.env.NEON_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_PROVIDER=neon requires DATABASE_URL or NEON_DATABASE_URL (Neon pooled connection string from Neon Console).",
    );
  }
  return url;
}

export function getDb(): Db {
  if (cachedDb) return cachedDb;
  const connectionString = resolveDatabaseUrl();
  cachedPool = new Pool({ connectionString });
  cachedDb = drizzle(cachedPool, { schema });
  return cachedDb;
}

// Eager singleton proxy for server handlers.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export * from "./schema";
export * as schema from "./schema";
