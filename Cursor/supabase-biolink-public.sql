-- One-time: Supabase SQL Editor — public bio JSON for myeo.io (everyone can read; signed-in users can write).
-- SECURITY: Any authenticated user can publish. Use Supabase Auth settings (disable signups / allowlist) so only you can sign in.

create table if not exists public.biolink_public (
  id text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.biolink_public enable row level security;

drop policy if exists "biolink_public_select_anon" on public.biolink_public;
create policy "biolink_public_select_anon"
on public.biolink_public
for select
to anon, authenticated
using (true);

drop policy if exists "biolink_public_insert_authenticated" on public.biolink_public;
create policy "biolink_public_insert_authenticated"
on public.biolink_public
for insert
to authenticated
with check (true);

drop policy if exists "biolink_public_update_authenticated" on public.biolink_public;
create policy "biolink_public_update_authenticated"
on public.biolink_public
for update
to authenticated
using (true)
with check (true);
