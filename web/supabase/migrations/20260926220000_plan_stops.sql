-- Plan stops live in plans.itinerary.stops as [{ placeId, slot, time }].
-- Only Google place IDs are stored (the one Places field Google allows us to
-- keep); names and addresses are looked up fresh when the plan loads.
--
--   not signed in            -> 28000 (API: 401)
--   no plan / not a member   -> P0002 (API: 404)
--   plain member             -> 42501 (API: 403)
--   invalid stops            -> 22023 (API: 400)
create or replace function public.set_plan_stops(p_plan_id uuid, p_stops jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_role text;
  arrival timestamptz;
  kickoff timestamptz;
  stop jsonb;
  stop_time timestamptz;
  normalized jsonb := '[]'::jsonb;
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
    raise exception 'Only the plan leader or co-leader can change stops.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_stops) is distinct from 'array' or jsonb_array_length(p_stops) > 6 then
    raise exception 'A plan can have at most 6 stops.' using errcode = '22023';
  end if;

  select p.target_arrival_time, (p.game->>'startsAt')::timestamptz
  into arrival, kickoff
  from public.plans p
  where p.id = p_plan_id
  for update;

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

    if stop->>'slot' = 'before' and stop_time >= arrival then
      raise exception 'Before-game stops must be before stadium arrival.' using errcode = '22023';
    end if;
    if stop->>'slot' = 'after' and kickoff is not null and stop_time <= kickoff then
      raise exception 'After-game stops must be after kickoff.' using errcode = '22023';
    end if;

    -- Keep only the three allowed keys; drop anything else the client sent.
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

revoke all on function public.set_plan_stops(uuid, jsonb) from public, anon;
grant execute on function public.set_plan_stops(uuid, jsonb) to authenticated;
