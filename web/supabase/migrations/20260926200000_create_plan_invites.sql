-- Invite links for saved plans. Every read/write goes through the security
-- definer functions below; clients get no direct table access.
create table public.plan_invites (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  token text not null unique check (token ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index plan_invites_plan_id_idx on public.plan_invites (plan_id);

alter table public.plan_invites enable row level security;
revoke all on table public.plan_invites from public, anon, authenticated;

-- Display name shown to other members. Never returns a full email address:
-- profile name if set, otherwise the part of the email before "@".
create or replace function public.plan_display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    nullif(split_part(u.email, '@', 1), ''),
    'Guest'
  )
  from auth.users u
  where u.id = p_user_id;
$$;

-- Leaders and co-leaders create a 7-day invite link.
--   not signed in        -> 28000
--   not a member / none  -> P0002 (API: 404)
--   plain member         -> 42501 (API: 403)
create or replace function public.create_plan_invite(p_plan_id uuid)
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  viewer_role text;
  new_token text := replace(gen_random_uuid()::text, '-', '')
                 || replace(gen_random_uuid()::text, '-', '');
  new_expiry timestamptz := now() + interval '7 days';
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in.' using errcode = '28000';
  end if;

  select m.role into viewer_role
  from public.plan_members m
  where m.plan_id = p_plan_id and m.user_id = (select auth.uid());

  if viewer_role is null then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;
  if viewer_role not in ('leader', 'co_leader') then
    raise exception 'Only the plan leader can invite friends.' using errcode = '42501';
  end if;

  insert into public.plan_invites (plan_id, token, created_by, expires_at)
  values (p_plan_id, new_token, (select auth.uid()), new_expiry);

  return query select new_token, new_expiry;
end;
$$;

-- Public preview of an invite. Returns no row for an unknown token, and only
-- status = 'expired' (no plan details) for an expired one. Exposes the game,
-- venue and inviter's display name only: no origin, itinerary, route,
-- preferences or member list.
create or replace function public.get_invite_preview(p_token text)
returns table (
  status text,
  plan_id uuid,
  title text,
  game jsonb,
  invited_by text,
  expires_at timestamptz,
  already_member boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  invite public.plan_invites%rowtype;
begin
  select * into invite from public.plan_invites i where i.token = p_token;
  if not found then
    return;
  end if;

  if invite.expires_at <= now() then
    return query select 'expired'::text, null::uuid, null::text, null::jsonb,
      null::text, invite.expires_at, false;
    return;
  end if;

  return query
  select
    'ok'::text,
    -- The plan id is not secret: reading a plan still requires membership.
    p.id,
    p.title,
    p.game,
    public.plan_display_name(invite.created_by),
    invite.expires_at,
    is_member
  from public.plans p
  cross join lateral (
    select exists (
      select 1 from public.plan_members m
      where m.plan_id = p.id and m.user_id = (select auth.uid())
    ) as is_member
  ) membership
  where p.id = invite.plan_id;
end;
$$;

-- Join a plan from an invite. Idempotent: an existing member keeps their role.
--   not signed in  -> 28000
--   unknown token  -> P0002 (API: 404)
--   expired token  -> 22023 with message 'expired' (API: 410)
create or replace function public.accept_plan_invite(p_token text)
returns table (plan_id uuid, already_member boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  invite public.plan_invites%rowtype;
  inserted_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in.' using errcode = '28000';
  end if;

  select * into invite from public.plan_invites i where i.token = p_token;
  if not found then
    raise exception 'Invite not found.' using errcode = 'P0002';
  end if;
  if invite.expires_at <= now() then
    raise exception 'expired' using errcode = '22023';
  end if;

  insert into public.plan_members (plan_id, user_id, role)
  values (invite.plan_id, (select auth.uid()), 'member')
  on conflict (plan_id, user_id) do nothing;
  get diagnostics inserted_count = row_count;

  return query select invite.plan_id, inserted_count = 0;
end;
$$;

-- Members of a plan, visible only to members of that plan.
create or replace function public.get_plan_members(p_plan_id uuid)
returns table (user_id uuid, name text, role text)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, public.plan_display_name(m.user_id), m.role
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

revoke all on function public.plan_display_name(uuid) from public, anon, authenticated;
revoke all on function public.create_plan_invite(uuid) from public, anon;
revoke all on function public.get_invite_preview(text) from public;
revoke all on function public.accept_plan_invite(text) from public, anon;
revoke all on function public.get_plan_members(uuid) from public, anon;

grant execute on function public.create_plan_invite(uuid) to authenticated;
grant execute on function public.get_invite_preview(text) to anon, authenticated;
grant execute on function public.accept_plan_invite(text) to authenticated;
grant execute on function public.get_plan_members(uuid) to authenticated;
