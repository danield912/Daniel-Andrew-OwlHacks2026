create table public.plans (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete restrict,
  client_request_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  game_id text not null check (char_length(game_id) between 1 and 200),
  game jsonb not null check (jsonb_typeof(game) = 'object'),
  origin text not null check (char_length(origin) between 2 and 200),
  travel_mode text not null check (travel_mode in ('TRANSIT', 'DRIVE')),
  target_arrival_time timestamptz not null,
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  itinerary jsonb not null check (jsonb_typeof(itinerary) = 'object'),
  route_snapshot jsonb not null check (jsonb_typeof(route_snapshot) = 'object'),
  route_calculated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, client_request_id)
);

create table public.plan_members (
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('leader', 'co_leader', 'member')),
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

create index plans_created_by_created_at_idx
  on public.plans (created_by, created_at desc, id desc);

create index plan_members_user_id_plan_id_idx
  on public.plan_members (user_id, plan_id);

create or replace function public.set_plan_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger plans_set_updated_at
before update on public.plans
for each row execute function public.set_plan_updated_at();

-- This function intentionally bypasses RLS for the membership lookup. Calling
-- it from policies avoids an RLS recursion between plans and plan_members.
create or replace function public.can_access_plan(requested_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.plans
    where id = requested_plan_id
      and created_by = (select auth.uid())
  )
  or exists (
    select 1
    from public.plan_members
    where plan_id = requested_plan_id
      and user_id = (select auth.uid())
  );
$$;

alter table public.plans enable row level security;
alter table public.plan_members enable row level security;

revoke all on table public.plans from anon, authenticated;
revoke all on table public.plan_members from anon, authenticated;
grant select on table public.plans to authenticated;
grant select on table public.plan_members to authenticated;

create policy "Members can read accessible plans"
on public.plans for select to authenticated
using ((select public.can_access_plan(id)));

create policy "Members can read other members of accessible plans"
on public.plan_members for select to authenticated
using ((select public.can_access_plan(plan_id)));

-- Creating a plan must be atomic: a saved plan without its leader membership
-- is never observable. The API calls only this function, not direct inserts.
create or replace function public.create_plan_with_leader(
  p_client_request_id uuid,
  p_title text,
  p_game_id text,
  p_game jsonb,
  p_origin text,
  p_travel_mode text,
  p_target_arrival_time timestamptz,
  p_preferences jsonb,
  p_itinerary jsonb,
  p_route_snapshot jsonb,
  p_route_calculated_at timestamptz
)
returns table (id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  saved_plan_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in.' using errcode = '28000';
  end if;

  insert into public.plans (
    created_by,
    client_request_id,
    title,
    game_id,
    game,
    origin,
    travel_mode,
    target_arrival_time,
    preferences,
    itinerary,
    route_snapshot,
    route_calculated_at
  )
  values (
    (select auth.uid()),
    p_client_request_id,
    p_title,
    p_game_id,
    p_game,
    p_origin,
    p_travel_mode,
    p_target_arrival_time,
    p_preferences,
    p_itinerary,
    p_route_snapshot,
    p_route_calculated_at
  )
  on conflict (created_by, client_request_id) do nothing
  returning plans.id into saved_plan_id;

  if saved_plan_id is not null then
    insert into public.plan_members (plan_id, user_id, role)
    values (saved_plan_id, (select auth.uid()), 'leader');

    return query select saved_plan_id, true;
    return;
  end if;

  select plans.id into saved_plan_id
  from public.plans
  where created_by = (select auth.uid())
    and client_request_id = p_client_request_id;

  return query select saved_plan_id, false;
end;
$$;

revoke all on function public.can_access_plan(uuid) from public;
revoke all on function public.create_plan_with_leader(
  uuid, text, text, jsonb, text, text, timestamptz, jsonb, jsonb, jsonb, timestamptz
) from public;
-- Supabase grants EXECUTE to anon directly (not only through PUBLIC), so the
-- anon role must be revoked explicitly.
revoke all on function public.can_access_plan(uuid) from anon;
revoke all on function public.create_plan_with_leader(
  uuid, text, text, jsonb, text, text, timestamptz, jsonb, jsonb, jsonb, timestamptz
) from anon;
revoke all on function public.set_plan_updated_at() from public, anon, authenticated;
grant execute on function public.can_access_plan(uuid) to authenticated;
grant execute on function public.create_plan_with_leader(
  uuid, text, text, jsonb, text, text, timestamptz, jsonb, jsonb, jsonb, timestamptz
) to authenticated;
