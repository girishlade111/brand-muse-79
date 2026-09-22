// DEPRECATED — Neon migration shim.
// This module previously exposed a Supabase service-role client via
// `getAdmin()`. All data access now goes through Drizzle + Neon
// (`src/db/index.server.ts`) and R2 (`src/server/storage.server.ts`).
//
// Kept as a re-export so any stale import keeps working until removed.
// New code should `import { db } from "@/db/index.server"` directly.
export { db, getDb } from "@/db/index.server";
export { uploadAsset, deleteAsset, publicUrlFor, urlForAsset } from "./storage.server";
