-- Run in Supabase → SQL Editor (production project).
-- Hardens RLS so policies cannot be bypassed by table owners in normal sessions.

-- Force RLS even for table owners (Postgres table owner bypass disabled for RLS).
ALTER TABLE IF EXISTS public.user_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_analytics FORCE ROW LEVEL SECURITY;

-- Analytics: append-only for authenticated users (no UPDATE/DELETE policies = denied).
DROP POLICY IF EXISTS "users can update own analytics" ON public.user_analytics;
DROP POLICY IF EXISTS "users can delete own analytics" ON public.user_analytics;

-- Optional: allow users to delete their own config row (off by default — uncomment if needed).
-- DROP POLICY IF EXISTS "users can delete own config" ON public.user_configs;
-- CREATE POLICY "users can delete own config"
-- ON public.user_configs FOR DELETE
-- USING (auth.uid() = user_id);

-- Query performance for dashboard-style reads.
CREATE INDEX IF NOT EXISTS user_analytics_user_id_created_at_idx
  ON public.user_analytics (user_id, created_at DESC);

-- After running: confirm in Dashboard → Authentication → Policies that only intended roles apply.
-- Rotate Supabase anon/service keys from Project Settings → API if they were ever exposed.
