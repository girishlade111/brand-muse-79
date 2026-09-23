CREATE TABLE IF NOT EXISTS "kit_git_syncs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kit_id" uuid NOT NULL,
	"repo_name" text NOT NULL,
	"branch_name" text,
	"pr_url" text,
	"pr_number" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"commit_sha" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kit_git_syncs" ADD CONSTRAINT "kit_git_syncs_kit_id_brand_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."brand_kits"("id") ON DELETE cascade ON UPDATE no action;
