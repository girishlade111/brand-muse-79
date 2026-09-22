CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."app_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "brand_kits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT 'Untitled brand kit' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source_type" text DEFAULT 'url' NOT NULL,
	"source_url" text,
	"source_text" text,
	"brand_positioning" jsonb,
	"typography_scale" jsonb,
	"imagery_style" jsonb,
	"motion_style" jsonb,
	"share_token" text,
	"anon_token" text,
	"user_id" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"error_message" text,
	"error_status" integer,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_doc_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"label" text,
	"markdown" text NOT NULL,
	"parsed" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kit_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kit_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"storage_path" text,
	"width" integer,
	"height" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kit_colors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kit_id" uuid NOT NULL,
	"hex" text NOT NULL,
	"name" text,
	"role" text,
	"locked" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kit_fonts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kit_id" uuid NOT NULL,
	"family" text NOT NULL,
	"source_family" text,
	"role" text,
	"weights" text[],
	"google_font" boolean DEFAULT false,
	"is_substitute" boolean DEFAULT false NOT NULL,
	"license" text,
	"license_note" text,
	"provider" text,
	"provider_url" text,
	"scale" jsonb,
	"file_urls" jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kit_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kit_id" uuid NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kit_voice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kit_id" uuid NOT NULL,
	"summary" text,
	"tone" jsonb,
	"vocabulary" jsonb,
	"dos" jsonb,
	"donts" jsonb,
	"samples" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kit_voice_kit_id_unique" UNIQUE("kit_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role" "app_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kit_assets" ADD CONSTRAINT "kit_assets_kit_id_brand_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."brand_kits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_colors" ADD CONSTRAINT "kit_colors_kit_id_brand_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."brand_kits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_fonts" ADD CONSTRAINT "kit_fonts_kit_id_brand_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."brand_kits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_tokens" ADD CONSTRAINT "kit_tokens_kit_id_brand_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."brand_kits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_voice" ADD CONSTRAINT "kit_voice_kit_id_brand_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."brand_kits"("id") ON DELETE cascade ON UPDATE no action;