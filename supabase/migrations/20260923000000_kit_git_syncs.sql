-- Migration: kit_git_syncs table for GitHub automated token syncs
CREATE TABLE IF NOT EXISTS public.kit_git_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.brand_kits(id) ON DELETE CASCADE,
  repo_name text NOT NULL,
  branch_name text,
  pr_url text,
  pr_number integer,
  status text NOT NULL DEFAULT 'pending',
  commit_sha text,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kit_git_syncs_kit_id ON public.kit_git_syncs(kit_id);
CREATE INDEX IF NOT EXISTS idx_kit_git_syncs_created_at ON public.kit_git_syncs(created_at DESC);
