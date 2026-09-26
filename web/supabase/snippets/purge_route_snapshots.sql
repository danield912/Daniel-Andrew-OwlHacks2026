-- Run in the Supabase SQL editor (admin role). Removes stored Google route
-- results while keeping the rest of each plan. The API then returns
-- routeSnapshot: null and routeCalculatedAt: null for these plans.

-- Option A: purge routes for games that ended more than a day ago.
update public.plans
set route_snapshot = null, route_calculated_at = null
where route_snapshot is not null
  and (game->>'startsAt')::timestamptz < now() - interval '1 day';

-- Option B: purge every stored route.
-- update public.plans set route_snapshot = null, route_calculated_at = null
-- where route_snapshot is not null;

-- Option C (permanent): drop the columns entirely. Also remove the two RPC
-- parameters in create_plan_with_leader and the fields in lib/saved-plan-api.ts.
-- alter table public.plans drop column route_snapshot, drop column route_calculated_at;
