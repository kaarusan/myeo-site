-- Run this in Supabase SQL Editor.

create table if not exists public.user_configs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_configs enable row level security;

drop policy if exists "users can read own config" on public.user_configs;
create policy "users can read own config"
on public.user_configs
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own config" on public.user_configs;
create policy "users can insert own config"
on public.user_configs
for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own config" on public.user_configs;
create policy "users can update own config"
on public.user_configs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.user_analytics (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_analytics enable row level security;

drop policy if exists "users can read own analytics" on public.user_analytics;
create policy "users can read own analytics"
on public.user_analytics
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own analytics" on public.user_analytics;
create policy "users can insert own analytics"
on public.user_analytics
for insert
with check (auth.uid() = user_id);
