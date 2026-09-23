-- Migration: api_keys and webhook_subscriptions tables for Developer REST API & Webhook Delivery
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  prefix text NOT NULL,
  name text NOT NULL,
  last_used_at timestamp with time zone,
  rate_limit_per_min integer NOT NULL DEFAULT 60,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);

CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['kit.extraction_completed', 'kit.tokens_updated', 'kit.failed'],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_user_id ON public.webhook_subscriptions(user_id);
