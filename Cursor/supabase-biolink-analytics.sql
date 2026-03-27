-- One-time: Supabase SQL Editor — global visit + click counts (same numbers for every visitor).
-- Run after `supabase-biolink-public.sql`. Anyone can call `biolink_track` (spam = rate-limit at Cloudflare if needed).

create table if not exists public.biolink_analytics (
  id text primary key default 'default',
  data jsonb not null default '{"total":0,"days":{},"clicks":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.biolink_analytics (id, data)
values ('default', '{"total":0,"days":{},"clicks":{}}'::jsonb)
on conflict (id) do nothing;

alter table public.biolink_analytics enable row level security;

drop policy if exists "biolink_analytics_select_public" on public.biolink_analytics;
create policy "biolink_analytics_select_public"
on public.biolink_analytics
for select
to anon, authenticated
using (true);

drop policy if exists "biolink_analytics_update_authenticated" on public.biolink_analytics;
create policy "biolink_analytics_update_authenticated"
on public.biolink_analytics
for update
to authenticated
using (true)
with check (true);

create or replace function public.biolink_track(p_kind text, p_label text, p_day text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_rec record;
  d jsonb;
  day_key text;
  now_ms bigint;
  clicks jsonb;
  cl jsonb;
  label_clean text;
  tot bigint;
  day_count int;
  cl_tot int;
  cl_day int;
begin
  if p_kind is null or p_kind not in ('pageview', 'click') then
    raise exception 'invalid kind';
  end if;

  day_key := nullif(trim(coalesce(p_day, '')), '');
  if day_key is null or day_key !~ '^\d{4}-\d{2}-\d{2}$' then
    day_key := to_char(((now() at time zone 'utc'))::date, 'YYYY-MM-DD');
  end if;

  label_clean := left(regexp_replace(coalesce(p_label, ''), '[\x00-\x1f]', '', 'g'), 80);
  if p_kind = 'click' and label_clean = '' then
    label_clean := 'link';
  end if;

  select * into row_rec from public.biolink_analytics where id = 'default' for update;
  if not found then
    insert into public.biolink_analytics (id, data)
    values ('default', '{"total":0,"days":{},"clicks":{}}'::jsonb);
    select * into row_rec from public.biolink_analytics where id = 'default' for update;
  end if;

  d := coalesce(row_rec.data, '{}'::jsonb);
  now_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;

  d := jsonb_set(d, '{last}', to_jsonb(now_ms), true);
  if not (d ? 'first') or jsonb_typeof(d->'first') = 'null' then
    d := jsonb_set(d, '{first}', to_jsonb(now_ms), true);
  end if;

  if p_kind = 'pageview' then
    tot := coalesce((d->>'total')::bigint, 0) + 1;
    d := jsonb_set(d, '{total}', to_jsonb(tot), true);
    day_count := coalesce((d->'days'->>day_key)::int, 0) + 1;
    d := jsonb_set(
      d,
      '{days}',
      jsonb_set(coalesce(d->'days', '{}'::jsonb), array[day_key], to_jsonb(day_count), true),
      true
    );
  elsif p_kind = 'click' then
    clicks := coalesce(d->'clicks', '{}'::jsonb);
    cl := coalesce(clicks->label_clean, jsonb_build_object('total', 0, 'days', '{}'::jsonb));
    cl_tot := coalesce((cl->>'total')::int, 0) + 1;
    cl := jsonb_set(cl, '{total}', to_jsonb(cl_tot), true);
    cl_day := coalesce((cl->'days'->>day_key)::int, 0) + 1;
    cl := jsonb_set(
      cl,
      '{days}',
      jsonb_set(coalesce(cl->'days', '{}'::jsonb), array[day_key], to_jsonb(cl_day), true),
      true
    );
    d := jsonb_set(d, '{clicks}', jsonb_set(clicks, array[label_clean], cl, true), true);
  end if;

  update public.biolink_analytics
  set data = d, updated_at = now()
  where id = 'default';

  return d;
end;
$$;

revoke all on function public.biolink_track(text, text, text) from public;
grant execute on function public.biolink_track(text, text, text) to anon, authenticated;
