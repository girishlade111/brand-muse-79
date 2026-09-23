import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const appRoleEnum = pgEnum("app_role", ["admin", "user"]);

// ---------------------------------------------------------------------------
// brand_kits — top-level brand identity container.
// Ownership is a mix of `user_id` (authed) and `anon_token` (anonymous).
// ---------------------------------------------------------------------------
export const brandKits = pgTable("brand_kits", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().default("Untitled brand kit"),
  status: text("status").notNull().default("pending"),
  sourceType: text("source_type").notNull().default("url"),
  sourceUrl: text("source_url"),
  sourceText: text("source_text"),
  brandPositioning: jsonb("brand_positioning").$type<any>(),
  typographyScale: jsonb("typography_scale").$type<any>(),
  imageryStyle: jsonb("imagery_style").$type<any>(),
  motionStyle: jsonb("motion_style").$type<any>(),
  shareToken: text("share_token"),
  anonToken: text("anon_token"),
  userId: text("user_id"),
  isPublic: boolean("is_public").notNull().default(false),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  errorStatus: integer("error_status"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kitColors = pgTable("kit_colors", {
  id: uuid("id").defaultRandom().primaryKey(),
  kitId: uuid("kit_id")
    .notNull()
    .references(() => brandKits.id, { onDelete: "cascade" }),
  hex: text("hex").notNull(),
  name: text("name"),
  role: text("role"),
  locked: boolean("locked").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kitFonts = pgTable("kit_fonts", {
  id: uuid("id").defaultRandom().primaryKey(),
  kitId: uuid("kit_id")
    .notNull()
    .references(() => brandKits.id, { onDelete: "cascade" }),
  family: text("family").notNull(),
  sourceFamily: text("source_family"),
  role: text("role"),
  weights: text("weights").array(),
  googleFont: boolean("google_font").default(false),
  isSubstitute: boolean("is_substitute").notNull().default(false),
  license: text("license"),
  licenseNote: text("license_note"),
  provider: text("provider"),
  providerUrl: text("provider_url"),
  scale: jsonb("scale").$type<any>(),
  fileUrls: jsonb("file_urls").$type<any>(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kitAssets = pgTable("kit_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  kitId: uuid("kit_id")
    .notNull()
    .references(() => brandKits.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  url: text("url").notNull(),
  storagePath: text("storage_path"),
  width: integer("width"),
  height: integer("height"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kitTokens = pgTable("kit_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  kitId: uuid("kit_id")
    .notNull()
    .references(() => brandKits.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  name: text("name").notNull(),
  value: text("value").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kitVoice = pgTable("kit_voice", {
  id: uuid("id").defaultRandom().primaryKey(),
  kitId: uuid("kit_id")
    .notNull()
    .unique()
    .references(() => brandKits.id, { onDelete: "cascade" }),
  summary: text("summary"),
  tone: jsonb("tone").$type<any>(),
  vocabulary: jsonb("vocabulary").$type<any>(),
  dos: jsonb("dos").$type<any>(),
  donts: jsonb("donts").$type<any>(),
  samples: jsonb("samples").$type<any>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const designDocVersions = pgTable("design_doc_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  version: integer("version").notNull(),
  label: text("label"),
  markdown: text("markdown").notNull(),
  parsed: jsonb("parsed").$type<any>().notNull().default({}),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userRoles = pgTable("user_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  role: appRoleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kitGitSyncs = pgTable("kit_git_syncs", {
  id: uuid("id").defaultRandom().primaryKey(),
  kitId: uuid("kit_id")
    .notNull()
    .references(() => brandKits.id, { onDelete: "cascade" }),
  repoName: text("repo_name").notNull(),
  branchName: text("branch_name"),
  prUrl: text("pr_url"),
  prNumber: integer("pr_number"),
  status: text("status").notNull().default("pending"),
  commitSha: text("commit_sha"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  name: text("name").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  rateLimitPerMin: integer("rate_limit_per_min").notNull().default(60),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BrandKit = typeof brandKits.$inferSelect;
export type NewBrandKit = typeof brandKits.$inferInsert;
export type KitColor = typeof kitColors.$inferSelect;
export type KitFont = typeof kitFonts.$inferSelect;
export type KitAsset = typeof kitAssets.$inferSelect;
export type KitToken = typeof kitTokens.$inferSelect;
export type KitVoice = typeof kitVoice.$inferSelect;
export type KitGitSync = typeof kitGitSyncs.$inferSelect;
export type NewKitGitSync = typeof kitGitSyncs.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscription = typeof webhookSubscriptions.$inferInsert;
export type DesignDocVersion = typeof designDocVersions.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
