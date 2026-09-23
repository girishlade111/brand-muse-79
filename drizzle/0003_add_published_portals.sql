CREATE TABLE IF NOT EXISTS "published_portals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kit_id" uuid NOT NULL UNIQUE REFERENCES "brand_kits"("id") ON DELETE cascade,
	"slug" text NOT NULL UNIQUE,
	"custom_domain" text UNIQUE,
	"custom_domain_status" text DEFAULT 'unconfigured' NOT NULL,
	"custom_domain_ssl_status" text DEFAULT 'pending' NOT NULL,
	"custom_domain_cname_target" text DEFAULT 'cname.branddna.app' NOT NULL,
	"cf_custom_hostname_id" text,
	"cf_verification_data" jsonb,
	"is_published" boolean DEFAULT true NOT NULL,
	"is_password_protected" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"password_hint" text,
	"expires_at" timestamp with time zone,
	"whitelabel_remove_badge" boolean DEFAULT false NOT NULL,
	"whitelabel_title" text,
	"whitelabel_meta_description" text,
	"whitelabel_favicon_url" text,
	"whitelabel_social_image_url" text,
	"custom_css" text,
	"allowed_download_formats" jsonb DEFAULT '["svg","png","tokens","css","pdf"]'::jsonb,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "published_portals_slug_idx" ON "published_portals" ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "published_portals_custom_domain_idx" ON "published_portals" ("custom_domain");
