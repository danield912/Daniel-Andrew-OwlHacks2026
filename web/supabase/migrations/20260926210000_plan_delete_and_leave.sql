-- Deleting and leaving plans. Clients still have no direct DELETE rights;
-- these functions check the caller's membership and role first.
--
-- Deleting a plan cascades to plan_members and plan_invites (both reference
-- plans(id) on delete cascade), so its members and invite links go with it.

--   not signed in           -> 28000 (API: 401)
--   no plan / not a member  -> P0002 (API: 404)
--   member but not leader   -> 42501 (API: 403)
create or replace function public.delete_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_role text;
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in.' using errcode = '28000';
  end if;

  select m.role into viewer_role
  from public.plan_members m
  where m.plan_id = p_plan_id and m.user_id = (select auth.uid())
  for update;

  if viewer_role is null then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;
  if viewer_role <> 'leader' then
    raise exception 'Only the plan leader can delete this plan.' using errcode = '42501';
  end if;

  delete from public.plans where id = p_plan_id;
end;
$$;

-- Removes only the caller's own membership.
--   not signed in           -> 28000 (API: 401)
--   no plan / not a member  -> P0002 (API: 404)
--   caller is the leader    -> GP400 (API: 400 "Delete the plan instead")
create or replace function public.leave_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_role text;
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in.' using errcode = '28000';
  end if;

  select m.role into viewer_role
  from public.plan_members m
  where m.plan_id = p_plan_id and m.user_id = (select auth.uid())
  for update;

  if viewer_role is null then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;
  if viewer_role = 'leader' then
    raise exception 'Delete the plan instead' using errcode = 'GP400';
  end if;

  delete from public.plan_members
  where plan_id = p_plan_id and user_id = (select auth.uid());
end;
$$;

revoke all on function public.delete_plan(uuid) from public, anon;
revoke all on function public.leave_plan(uuid) from public, anon;
grant execute on function public.delete_plan(uuid) to authenticated;
grant execute on function public.leave_plan(uuid) to authenticated;
