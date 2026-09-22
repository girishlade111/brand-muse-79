// Neon Serverless PostgreSQL client — server-only.
// Uses @neondatabase/serverless Pool over fetch so it works on
// Cloudflare Workers (Edge) as well as Node. Drizzle provides typing.
//
// Requires `DATABASE_URL` (pooled Neon connection string).
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Pool queries go through `fetch` instead of WebSockets — required on
// Cloudflare Workers and generally faster for short-lived edge requests.
neonConfig.poolQueryViaFetch = true;

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | null = null;

export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Set it to your pooled Neon connection string (Neon Console -> Connect).",
    );
  }
  const pool = new Pool({ connectionString: url });
  cached = drizzle(pool, { schema });
  return cached;
}

// Eager singleton for server handlers. Lazily initialized on first access
// so importing this module at build time (without env) does not crash.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export * from "./schema";
export * as schema from "./schema";
