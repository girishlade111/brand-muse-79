ALTER TABLE "brand_kits" ADD COLUMN IF NOT EXISTS "extraction_step" text;
--> statement-breakpoint
ALTER TABLE "brand_kits" ADD COLUMN IF NOT EXISTS "extraction_progress" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "brand_kits" ADD COLUMN IF NOT EXISTS "extraction_status" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "brand_kits" ADD COLUMN IF NOT EXISTS "step_details" jsonb;
--> statement-breakpoint
ALTER TABLE "brand_kits" ADD COLUMN IF NOT EXISTS "job_id" text;
--> statement-breakpoint
ALTER TABLE "brand_kits" ADD COLUMN IF NOT EXISTS "job_provider" text DEFAULT 'qstash';
