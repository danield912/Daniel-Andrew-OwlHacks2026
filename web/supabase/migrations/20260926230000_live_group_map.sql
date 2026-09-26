-- Live group map: opt-in location sharing and "might be late" alerts.
--
-- Privacy rules enforced here:
--   * Members only: rows reference plan_members, so leaving a plan or deleting
--     it removes that person's location and alerts automatically (cascade).
--   * Game-day window only: 3 h before the arrive-by time until 2 h after the
--     estimated end of the game. Writes outside it are rejected by RLS.
--   * No history: one location row per person, overwritten in place.
--   * Everything expires at the end of the window and is purged.

-- Game lengths match Daniel's estimatedGameEnd() in lib/game-day.ts.
create or replace function public.plan_live_window_bounds(p_target_arrival timestamptz, p_game jsonb)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
set search_path = public
as $$
  select
    p_target_arrival - interval '3 hours',
    coalesce(nullif(p_game->>'startsAt', '')::timestamptz, p_target_arrival)
      + case
          when coalesce(p_game->'venue'->>'name', '') ~* 'lincoln financial' then interval '195 minutes'
          when coalesce(p_game->'venue'->>'name', '') ~* 'citizens bank' then interval '180 minutes'
          when coalesce(p_game->'venue'->>'name', '') ~* 'wells fargo|xfinity|arena' then interval '150 minutes'
          else interval '180 minutes'
        end
      + interval '2 hours';
$$;

-- Window for a plan, visible to its members only (no rows otherwise).
create or replace function public.plan_live_window(p_plan_id uuid)
returns table (starts_at timestamptz, ends_at timestamptz, is_open boolean)
language sql
stable
security definer
set search_path = public
as $$
  select b.starts_at, b.ends_at, now() >= b.starts_at and now() < b.ends_at
  from public.plans p
  cross join lateral public.plan_live_window_bounds(p.target_arrival_time, p.game) b
  where p.id = p_plan_id
    and public.can_access_plan(p_plan_id);
$$;

create or replace function public.is_live_window_open(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select now() >= b.starts_at and now() < b.ends_at
    from public.plans p
    cross join lateral public.plan_live_window_bounds(p.target_arrival_time, p.game) b
    where p.id = p_plan_id
  ), false);
$$;

create or replace function public.plan_live_window_end(p_plan_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select b.ends_at
  from public.plans p
  cross join lateral public.plan_live_window_bounds(p.target_arrival_time, p.game) b
  where p.id = p_plan_id;
$$;

-- ---------- Locations ----------

create table public.plan_locations (
  plan_id uuid not null,
  user_id uuid not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy double precision check (accuracy is null or accuracy between 0 and 100000),
  updated_at timestamptz not null default now(),
  -- Last automatic lateness check (throttled to once every 3 minutes).
  eta_checked_at timestamptz,
  expires_at timestamptz not null,
  primary key (plan_id, user_id),
  foreign key (plan_id, user_id)
    references public.plan_members (plan_id, user_id) on delete cascade
);

create index plan_locations_expires_at_idx on public.plan_locations (expires_at);

-- ---------- Alerts ----------

create table public.plan_alerts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id uuid not null,
  kind text not null check (kind in ('manual', 'auto')),
  minutes_late integer not null check (minutes_late between 1 and 600),
  -- { kind: stop|stadium|kickoff, at, placeId } -- a Google place ID only, never
  -- place names (looked up fresh when alerts are read).
  target jsonb check (target is null or jsonb_typeof(target) = 'object'),
  target_key text,
  eta timestamptz,
  note text check (note is null or char_length(note) <= 140),
  created_at timestamptz not null default now(),
  dismissed_at timestamptz,
  expires_at timestamptz not null,
  foreign key (plan_id, user_id)
    references public.plan_members (plan_id, user_id) on delete cascade
);

create index plan_alerts_plan_created_idx on public.plan_alerts (plan_id, created_at desc);
create index plan_alerts_expires_at_idx on public.plan_alerts (expires_at);
-- Automatic alerts: once per person per stop.
create unique index plan_alerts_auto_once_idx
  on public.plan_alerts (plan_id, user_id, target_key) where kind = 'auto';

-- Server-controlled timestamps: clients can't extend how long data is kept.
create or replace function public.set_live_row_times()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.expires_at := public.plan_live_window_end(new.plan_id);
  if tg_table_name = 'plan_locations' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger plan_locations_times
before insert or update on public.plan_locations
for each row execute function public.set_live_row_times();

create trigger plan_alerts_times
before insert on public.plan_alerts
for each row execute function public.set_live_row_times();

-- ---------- Row-level security ----------

alter table public.plan_locations enable row level security;
alter table public.plan_alerts enable row level security;

revoke all on table public.plan_locations from public, anon, authenticated;
revoke all on table public.plan_alerts from public, anon, authenticated;
grant select, insert, update, delete on table public.plan_locations to authenticated;
grant select, insert, update on table public.plan_alerts to authenticated;

-- Members read only their own plans' data.
create policy "Members read plan locations"
on public.plan_locations for select to authenticated
using ((select public.can_access_plan(plan_id)));

-- Only you write your own row, and only during the game-day window.
-- (The foreign key to plan_members also requires membership.)
create policy "Share own location during window"
on public.plan_locations for insert to authenticated
with check (user_id = (select auth.uid()) and public.is_live_window_open(plan_id));

create policy "Update own location during window"
on public.plan_locations for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and public.is_live_window_open(plan_id));

-- Stop sharing: allowed any time.
create policy "Delete own location"
on public.plan_locations for delete to authenticated
using (user_id = (select auth.uid()));

create policy "Members read plan alerts"
on public.plan_alerts for select to authenticated
using ((select public.can_access_plan(plan_id)));

create policy "Create own alert during window"
on public.plan_alerts for insert to authenticated
with check (user_id = (select auth.uid()) and public.is_live_window_open(plan_id));

-- The late person updates/dismisses only their own alerts.
create policy "Update own alert"
on public.plan_alerts for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- ---------- Cleanup ----------

create or replace function public.purge_expired_live_data()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.plan_locations where expires_at <= now();
  delete from public.plan_alerts where expires_at <= now();
$$;

revoke all on function public.plan_live_window_bounds(timestamptz, jsonb) from public, anon;
revoke all on function public.plan_live_window(uuid) from public, anon;
revoke all on function public.is_live_window_open(uuid) from public, anon;
revoke all on function public.plan_live_window_end(uuid) from public, anon, authenticated;
revoke all on function public.set_live_row_times() from public, anon, authenticated;
revoke all on function public.purge_expired_live_data() from public, anon;
grant execute on function public.plan_live_window_bounds(timestamptz, jsonb) to authenticated;
grant execute on function public.plan_live_window(uuid) to authenticated;
grant execute on function public.is_live_window_open(uuid) to authenticated;
grant execute on function public.purge_expired_live_data() to authenticated;

-- The API purges expired rows on every live request. If pg_cron is available,
-- also purge every 15 minutes so data is removed even when nobody opens the app.
do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'purge-expired-live-data';
  perform cron.schedule('purge-expired-live-data', '*/15 * * * *', 'select public.purge_expired_live_data()');
exception when others then
  raise notice 'pg_cron not available (%); expired rows are still purged by the API.', sqlerrm;
end;
$cron$;
