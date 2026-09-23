// Database Provider Compatibility Tests
// Verifies seamless switching between Neon Serverless and Supabase PostgreSQL.

import { describe, expect, it } from "vitest";
import {
  getDatabaseProvider,
  isSupabaseProvider,
  isNeonProvider,
  resolveDatabaseUrl,
} from "@/db/index.server";
import { getSupabaseConfig, createClient } from "@/integrations/supabase/client";

describe("Database Provider & Compatibility Layer", () => {
  it("defaults to neon provider when DATABASE_PROVIDER is unset", () => {
    const original = process.env.DATABASE_PROVIDER;
    delete process.env.DATABASE_PROVIDER;

    expect(getDatabaseProvider()).toBe("neon");
    expect(isNeonProvider()).toBe(true);
    expect(isSupabaseProvider()).toBe(false);

    if (original) process.env.DATABASE_PROVIDER = original;
  });

  it("switches to supabase provider when configured", () => {
    const original = process.env.DATABASE_PROVIDER;
    process.env.DATABASE_PROVIDER = "supabase";

    expect(getDatabaseProvider()).toBe("supabase");
    expect(isSupabaseProvider()).toBe(true);
    expect(isNeonProvider()).toBe(false);

    if (original) process.env.DATABASE_PROVIDER = original;
    else delete process.env.DATABASE_PROVIDER;
  });

  it("resolves connection string appropriately based on provider", () => {
    const originalProvider = process.env.DATABASE_PROVIDER;
    const originalDbUrl = process.env.DATABASE_URL;
    const originalSupabaseDbUrl = process.env.SUPABASE_DB_URL;

    process.env.DATABASE_PROVIDER = "supabase";
    process.env.SUPABASE_DB_URL = "postgres://user:pass@supabase.com:6543/postgres";
    expect(resolveDatabaseUrl()).toBe("postgres://user:pass@supabase.com:6543/postgres");

    process.env.DATABASE_PROVIDER = "neon";
    process.env.DATABASE_URL = "postgres://user:pass@ep-neon.tech/neondb";
    expect(resolveDatabaseUrl()).toBe("postgres://user:pass@ep-neon.tech/neondb");

    // Clean up
    if (originalProvider) process.env.DATABASE_PROVIDER = originalProvider;
    else delete process.env.DATABASE_PROVIDER;
    if (originalDbUrl) process.env.DATABASE_URL = originalDbUrl;
    else delete process.env.DATABASE_URL;
    if (originalSupabaseDbUrl) process.env.SUPABASE_DB_URL = originalSupabaseDbUrl;
    else delete process.env.SUPABASE_DB_URL;
  });

  it("initializes Supabase client without crashing in edge environments", () => {
    const config = getSupabaseConfig();
    expect(config.url).toBeDefined();
    expect(config.anonKey).toBeDefined();

    const client = createClient("https://mock-proj.supabase.co", "mock-anon-key");
    expect(client).toBeDefined();
    expect(typeof client.from).toBe("function");
    expect(typeof client.storage.from).toBe("function");
  });
});
