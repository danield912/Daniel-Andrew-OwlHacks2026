-- Crew starting points, role management, and stop suggestions.
--
-- Roles (a tier list):
--   leader     edits stops directly, approves/declines suggestions, changes
--              roles, removes people, invites, deletes the plan
--   co_leader  invites friends, suggests stops, leaves
--   member     suggests stops, leaves
--
-- Error codes used by the API:
--   28000 not signed in (401) · P0002 not found / not a member (404)
--   42501 not allowed for your role (403) · 22023 invalid request (400)

-- ---------- 1. Each member's own starting point and trip ----------
-- Members come from different places, so each has their own address,
-- map coordinates, travel mode and route to the stadium.
alter table public.plan_members
  add column if not exists origin text
    check (origin is null or char_length(origin) between 2 and 200),
  add column if not exists origin_lat double precision
    check (origin_lat is null or origin_lat between -90 and 90),
  add column if not exists origin_lng double precision
    check (origin_lng is null or origin_lng between -180 and 180),
  add column if not exists travel_mode text
    check (travel_mode is null or travel_mode in ('TRANSIT', 'DRIVE')),
  add column if not exists route_snapshot jsonb
    check (route_snapshot is null or jsonb_typeof(route_snapshot) = 'object'),
  add column if not exists route_calculated_at timestamptz,
  add column if not exists start_updated_at timestamptz;

-- Existing plans: the creator's start is the plan's original address.
update public.plan_members m
set origin = p.origin,
    travel_mode = p.travel_mode,
    route_snapshot = p.route_snapshot,
    route_calculated_at = p.route_calculated_at,
    start_updated_at = now()
from public.plans p
where m.plan_id = p.id
  and m.user_id = p.created_by
  and m.origin is null;

-- Any member sets (or updates) their own start. Never someone else's.
create or replace function public.set_my_start(
  p_plan_id uuid,
  p_origin text,
  p_lat double precision,
  p_lng double precision,
  p_travel_mode text,
  p_route jsonb,
  p_route_calculated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in.' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.plan_members
    where plan_id = p_plan_id and user_id = (select auth.uid())
  ) then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;
  if p_origin is null or char_length(trim(p_origin)) not between 2 and 200
    or p_travel_mode not in ('TRANSIT', 'DRIVE')
    or (p_lat is null) <> (p_lng is null)
    or (p_route is not null and jsonb_typeof(p_route) <> 'object')
    or ((p_route is null) <> (p_route_calculated_at is null)) then
    raise exception 'Invalid starting point.' using errcode = '22023';
  end if;

  update public.plan_members
  set origin = trim(p_origin),
      origin_lat = p_lat,
      origin_lng = p_lng,
      travel_mode = p_travel_mode,
      route_snapshot = p_route,
      route_calculated_at = p_route_calculated_at,
      start_updated_at = now()
  where plan_id = p_plan_id and user_id = (select auth.uid());
end;
$$;

-- Members now come back with their starting points. The return type changes,
-- so the old function is dropped first.
drop function if exists public.get_plan_members(uuid);

create function public.get_plan_members(p_plan_id uuid)
returns table (
  user_id uuid,
  name text,
  role text,
  origin text,
  origin_lat double precision,
  origin_lng double precision,
  travel_mode text,
  route_snapshot jsonb,
  route_calculated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, public.plan_display_name(m.user_id), m.role,
         m.origin, m.origin_lat, m.origin_lng, m.travel_mode,
         m.route_snapshot, m.route_calculated_at
  from public.plan_members m
  where m.plan_id = p_plan_id
    and exists (
      select 1 from public.plan_members viewer
      where viewer.plan_id = p_plan_id and viewer.user_id = (select auth.uid())
    )
  order by
    case m.role when 'leader' then 0 when 'co_leader' then 1 else 2 end,
    m.created_at,
    m.user_id;
$$;

-- ---------- 2. Leader manages the crew ----------

create or replace function public.require_plan_leader(p_plan_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_role text;
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in.' using errcode = '28000';
  end if;
  select role into viewer_role from public.plan_members
  where plan_id = p_plan_id and user_id = (select auth.uid());
  if viewer_role is null then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;
  if viewer_role <> 'leader' then
    raise exception 'Only the plan leader can do that.' using errcode = '42501';
  end if;
end;
$$;

-- Promote to co-leader or move back to member. The leader's own role can't
-- be changed here (there is always exactly one leader).
create or replace function public.set_member_role(p_plan_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_plan_leader(p_plan_id);
  if p_role not in ('co_leader', 'member') then
    raise exception 'Role must be co-leader or member.' using errcode = '22023';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You can’t change your own role.' using errcode = '22023';
  end if;
  update public.plan_members set role = p_role
  where plan_id = p_plan_id and user_id = p_user_id;
  if not found then
    raise exception 'That person isn’t in this plan.' using errcode = 'P0002';
  end if;
end;
$$;

-- Remove someone from the plan. Their live location and alerts go with them
-- (foreign keys cascade), and their pending suggestions are withdrawn.
create or replace function public.remove_member(p_plan_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_plan_leader(p_plan_id);
  if p_user_id = (select auth.uid()) then
    raise exception 'You can’t remove yourself. Delete the plan instead.' using errcode = '22023';
  end if;
  delete from public.plan_members where plan_id = p_plan_id and user_id = p_user_id;
  if not found then
    raise exception 'That person isn’t in this plan.' using errcode = 'P0002';
  end if;
  delete from public.plan_stop_suggestions
  where plan_id = p_plan_id and suggested_by = p_user_id and status = 'pending';
end;
$$;

-- ---------- 3. Stops: leader edits, everyone else suggests ----------

create table if not exists public.plan_stop_suggestions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  suggested_by uuid not null references auth.users (id) on delete cascade,
  place_id text not null check (place_id ~ '^[A-Za-z0-9_-]+$' and char_length(place_id) <= 300),
  slot text not null check (slot in ('before', 'after')),
  stop_time timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);

create index if not exists plan_stop_suggestions_plan_idx
  on public.plan_stop_suggestions (plan_id, created_at desc);
-- One open suggestion per place and slot, so the leader isn't asked twice.
create unique index if not exists plan_stop_suggestions_open_once_idx
  on public.plan_stop_suggestions (plan_id, place_id, slot) where status = 'pending';

alter table public.plan_stop_suggestions enable row level security;
revoke all on table public.plan_stop_suggestions from anon, authenticated;
grant select on table public.plan_stop_suggestions to authenticated;

drop policy if exists "Members read suggestions" on public.plan_stop_suggestions;
create policy "Members read suggestions"
on public.plan_stop_suggestions for select to authenticated
using ((select public.can_access_plan(plan_id)));

-- Same time rules as stops: pregame between arrival and kickoff; after-game after kickoff.
create or replace function public.check_stop_time(p_plan_id uuid, p_slot text, p_time timestamptz)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  arrival timestamptz;
  kickoff timestamptz;
begin
  select target_arrival_time, (game->>'startsAt')::timestamptz into arrival, kickoff
  from public.plans where id = p_plan_id;
  if p_slot = 'before' and p_time < arrival then
    raise exception 'Pregame stops must be after you arrive at the stadium area.' using errcode = '22023';
  end if;
  if p_slot = 'before' and kickoff is not null and p_time >= kickoff then
    raise exception 'Pregame stops must be before kickoff.' using errcode = '22023';
  end if;
  if p_slot = 'after' and kickoff is not null and p_time <= kickoff then
    raise exception 'After-game stops must be after kickoff.' using errcode = '22023';
  end if;
end;
$$;

-- Co-leaders and members suggest a stop for the leader to approve.
create or replace function public.suggest_stop(p_plan_id uuid, p_place_id text, p_slot text, p_time timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in.' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.plan_members
    where plan_id = p_plan_id and user_id = (select auth.uid())
  ) then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;
  if coalesce(p_place_id, '') !~ '^[A-Za-z0-9_-]+$' or char_length(p_place_id) > 300
    or p_slot not in ('before', 'after') or p_time is null then
    raise exception 'Invalid suggestion.' using errcode = '22023';
  end if;
  perform public.check_stop_time(p_plan_id, p_slot, p_time);
  if (select count(*) from public.plan_stop_suggestions
      where plan_id = p_plan_id and suggested_by = (select auth.uid()) and status = 'pending') >= 6 then
    raise exception 'You already have 6 suggestions waiting. Wait for the leader to review them.' using errcode = '22023';
  end if;
  if exists (select 1 from public.plan_stop_suggestions
             where plan_id = p_plan_id and place_id = p_place_id and slot = p_slot and status = 'pending') then
    raise exception 'Someone already suggested this spot. The leader will review it.' using errcode = '22023';
  end if;
  insert into public.plan_stop_suggestions (plan_id, suggested_by, place_id, slot, stop_time)
  values (p_plan_id, (select auth.uid()), p_place_id, p_slot, p_time)
  returning id into new_id;
  return new_id;
end;
$$;

-- Leader approves (adds the stop to the plan) or declines a suggestion.
create or replace function public.review_stop_suggestion(p_suggestion_id uuid, p_approve boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  suggestion public.plan_stop_suggestions%rowtype;
  current_stops jsonb;
begin
  select * into suggestion from public.plan_stop_suggestions where id = p_suggestion_id for update;
  if not found then
    raise exception 'Suggestion not found.' using errcode = 'P0002';
  end if;
  perform public.require_plan_leader(suggestion.plan_id);
  if suggestion.status <> 'pending' then
    raise exception 'This suggestion was already reviewed.' using errcode = '22023';
  end if;

  if p_approve then
    perform public.check_stop_time(suggestion.plan_id, suggestion.slot, suggestion.stop_time);
    select coalesce(itinerary->'stops', '[]'::jsonb) into current_stops
    from public.plans where id = suggestion.plan_id for update;
    if jsonb_array_length(current_stops) >= 6 then
      raise exception 'The plan already has 6 stops. Remove one first.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from jsonb_array_elements(current_stops) s
      where s->>'placeId' = suggestion.place_id and s->>'slot' = suggestion.slot
    ) then
      update public.plans
      set itinerary = coalesce(itinerary, '{}'::jsonb) || jsonb_build_object(
        'stops',
        current_stops || jsonb_build_array(jsonb_build_object(
          'placeId', suggestion.place_id,
          'slot', suggestion.slot,
          'time', to_char(suggestion.stop_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ))
      )
      where id = suggestion.plan_id;
    end if;
  end if;

  update public.plan_stop_suggestions
  set status = case when p_approve then 'approved' else 'declined' end,
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
  where id = p_suggestion_id;
  return suggestion.plan_id;
end;
$$;

-- The person who suggested a stop can withdraw it while it's still waiting.
create or replace function public.withdraw_stop_suggestion(p_suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in.' using errcode = '28000';
  end if;
  delete from public.plan_stop_suggestions
  where id = p_suggestion_id and suggested_by = (select auth.uid()) and status = 'pending';
  if not found then
    raise exception 'Suggestion not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- Suggestions a viewer should see: every open one, plus their own recent results.
create or replace function public.get_stop_suggestions(p_plan_id uuid)
returns table (
  id uuid,
  place_id text,
  slot text,
  stop_time timestamptz,
  status text,
  suggested_by uuid,
  suggested_by_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.place_id, s.slot, s.stop_time, s.status, s.suggested_by,
         public.plan_display_name(s.suggested_by), s.created_at
  from public.plan_stop_suggestions s
  where s.plan_id = p_plan_id
    and exists (
      select 1 from public.plan_members viewer
      where viewer.plan_id = p_plan_id and viewer.user_id = (select auth.uid())
    )
    and (
      s.status = 'pending'
      or (s.suggested_by = (select auth.uid()) and s.reviewed_at > now() - interval '3 days')
    )
  order by s.created_at desc
  limit 50;
$$;

-- Only the leader edits the stop list directly now; everyone else suggests.
create or replace function public.set_plan_stops(p_plan_id uuid, p_stops jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  stop jsonb;
  stop_time timestamptz;
  normalized jsonb := '[]'::jsonb;
begin
  perform public.require_plan_leader(p_plan_id);

  if jsonb_typeof(p_stops) is distinct from 'array' or jsonb_array_length(p_stops) > 6 then
    raise exception 'A plan can have at most 6 stops.' using errcode = '22023';
  end if;

  perform 1 from public.plans where id = p_plan_id for update;

  for stop in select value from jsonb_array_elements(p_stops) loop
    if jsonb_typeof(stop) is distinct from 'object'
      or coalesce(stop->>'placeId', '') !~ '^[A-Za-z0-9_-]+$'
      or char_length(stop->>'placeId') > 300
      or coalesce(stop->>'slot', '') not in ('before', 'after')
      or coalesce(stop->>'time', '') !~ '(Z|[+-]\d{2}:\d{2})$' then
      raise exception 'Invalid stop.' using errcode = '22023';
    end if;

    begin
      stop_time := (stop->>'time')::timestamptz;
    exception when others then
      raise exception 'Invalid stop time.' using errcode = '22023';
    end;

    perform public.check_stop_time(p_plan_id, stop->>'slot', stop_time);

    normalized := normalized || jsonb_build_array(jsonb_build_object(
      'placeId', stop->>'placeId',
      'slot', stop->>'slot',
      'time', to_char(stop_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ));
  end loop;

  update public.plans
  set itinerary = coalesce(itinerary, '{}'::jsonb) || jsonb_build_object('stops', normalized)
  where id = p_plan_id;

  return normalized;
end;
$$;

-- ---------- Permissions ----------
revoke all on function public.set_my_start(uuid, text, double precision, double precision, text, jsonb, timestamptz) from public, anon;
revoke all on function public.get_plan_members(uuid) from public, anon;
revoke all on function public.require_plan_leader(uuid) from public, anon, authenticated;
revoke all on function public.set_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
revoke all on function public.check_stop_time(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.suggest_stop(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.review_stop_suggestion(uuid, boolean) from public, anon;
revoke all on function public.withdraw_stop_suggestion(uuid) from public, anon;
revoke all on function public.get_stop_suggestions(uuid) from public, anon;
revoke all on function public.set_plan_stops(uuid, jsonb) from public, anon;

grant execute on function public.set_my_start(uuid, text, double precision, double precision, text, jsonb, timestamptz) to authenticated;
grant execute on function public.get_plan_members(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.suggest_stop(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.review_stop_suggestion(uuid, boolean) to authenticated;
grant execute on function public.withdraw_stop_suggestion(uuid) to authenticated;
grant execute on function public.get_stop_suggestions(uuid) to authenticated;
grant execute on function public.set_plan_stops(uuid, jsonb) to authenticated;
