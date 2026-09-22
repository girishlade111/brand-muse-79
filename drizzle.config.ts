import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Pooled Neon connection string. Set DATABASE_URL in .env.
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
