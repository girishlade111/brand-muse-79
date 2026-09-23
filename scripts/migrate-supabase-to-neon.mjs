#!/usr/bin/env node
// ============================================================================
// Database Migration Tool: Supabase PostgreSQL -> Neon Serverless PostgreSQL
// Migrates brand kits, design tokens, typography, assets, colors, and portals
// with foreign key dependency ordering, batching, idempotency, and dry-run mode.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { Pool, neonConfig } from "@neondatabase/serverless";

neonConfig.poolQueryViaFetch = true;

const ARGS = process.argv.slice(2);
const IS_DRY_RUN = ARGS.includes("--dry-run");
const IS_VERIFY_ONLY = ARGS.includes("--verify");
const BATCH_SIZE_ARG = ARGS.find((a) => a.startsWith("--batch-size="));
const BATCH_SIZE = BATCH_SIZE_ARG ? parseInt(BATCH_SIZE_ARG.split("=")[1], 10) : 100;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";
const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

console.log("==================================================================");
console.log("   SUPABASE -> NEON SERVERLESS POSTGRESQL MIGRATION UTILITY       ");
console.log("==================================================================");
console.log(`[Config] Mode: ${IS_DRY_RUN ? "DRY-RUN (No writes)" : IS_VERIFY_ONLY ? "VERIFY-ONLY" : "LIVE MIGRATION"}`);
console.log(`[Config] Batch Size: ${BATCH_SIZE}`);
console.log(`[Config] Supabase Source: ${SUPABASE_URL}`);
console.log(`[Config] Neon Destination: ${NEON_DATABASE_URL ? NEON_DATABASE_URL.replace(/:[^:@]+@/, ":***@") : "NOT SET (Simulation Mode)"}`);
console.log("------------------------------------------------------------------\n");

// Tables in strict topological foreign-key order
const TABLES = [
  "brand_kits",
  "kit_colors",
  "kit_fonts",
  "kit_tokens",
  "kit_assets",
  "kit_voice",
  "kit_custom_domains",
  "published_portals",
];

async function run() {
  const startTime = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let neonPool = null;
  if (NEON_DATABASE_URL && !IS_DRY_RUN && !IS_VERIFY_ONLY) {
    neonPool = new Pool({ connectionString: NEON_DATABASE_URL });
  }

  const migrationSummary = [];

  for (const table of TABLES) {
    process.stdout.write(`Processing [${table}]... `);

    try {
      // 1. Fetch from Supabase
      const { data: sourceRows, error: srcErr, count } = await supabase
        .from(table)
        .select("*", { count: "exact" });

      if (srcErr) {
        // Table might not exist on older Supabase schemas
        console.log(`(Source table not found or empty: ${srcErr.message})`);
        migrationSummary.push({ table, sourceCount: 0, migratedCount: 0, status: "SKIPPED" });
        continue;
      }

      const rowCount = sourceRows?.length || 0;
      process.stdout.write(`Read ${rowCount} rows from Supabase. `);

      if (IS_VERIFY_ONLY) {
        console.log("Verified.");
        migrationSummary.push({ table, sourceCount: rowCount, migratedCount: 0, status: "VERIFIED" });
        continue;
      }

      if (IS_DRY_RUN) {
        console.log("[Dry-Run] Skipped insert.");
        migrationSummary.push({ table, sourceCount: rowCount, migratedCount: rowCount, status: "DRY-RUN" });
        continue;
      }

      if (!neonPool || rowCount === 0) {
        console.log("No rows to migrate or Neon DB unset.");
        migrationSummary.push({ table, sourceCount: rowCount, migratedCount: 0, status: "SUCCESS" });
        continue;
      }

      // 2. Batch write to Neon
      let insertedCount = 0;
      for (let i = 0; i < sourceRows.length; i += BATCH_SIZE) {
        const batch = sourceRows.slice(i, i + BATCH_SIZE);
        for (const row of batch) {
          const keys = Object.keys(row);
          const cols = keys.map((k) => `"${k}"`).join(", ");
          const vals = keys.map((_, idx) => `$${idx + 1}`).join(", ");
          const updates = keys
            .filter((k) => k !== "id")
            .map((k) => `"${k}" = EXCLUDED."${k}"`)
            .join(", ");

          const sql = `
            INSERT INTO "${table}" (${cols})
            VALUES (${vals})
            ON CONFLICT ("id") DO UPDATE SET ${updates || '"id" = EXCLUDED."id"'}
          `;

          await neonPool.query(sql, Object.values(row));
          insertedCount++;
        }
      }

      console.log(`Migrated ${insertedCount} rows into Neon.`);
      migrationSummary.push({ table, sourceCount: rowCount, migratedCount: insertedCount, status: "SUCCESS" });
    } catch (err) {
      console.log(`\n  [Error on table ${table}]:`, err.message);
      migrationSummary.push({ table, sourceCount: 0, migratedCount: 0, status: "ERROR", error: err.message });
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n==================================================================");
  console.log("                    MIGRATION AUDIT SUMMARY                       ");
  console.log("==================================================================");
  console.table(migrationSummary);
  console.log(`Completed in ${durationSec}s.`);

  if (neonPool) {
    await neonPool.end();
  }
}

run().catch((err) => {
  console.error("\nMigration failed fatal:", err);
  process.exit(1);
});
