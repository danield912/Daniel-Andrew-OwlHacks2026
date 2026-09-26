-- Test setup only: run in the Supabase SQL editor (runs as an admin role, so it
-- bypasses RLS). Adds a second signed-up test user to an existing plan so the
-- "Joined" tab can be exercised. Never expose this through the app.
--
-- Replace the two placeholders before running.
insert into public.plan_members (plan_id, user_id, role)
values (
  '<PLAN_ID>'::uuid,                                  -- from GET /api/plans
  (select id from auth.users where email = '<SECOND_TEST_USER_EMAIL>'),
  'member'                                            -- or 'co_leader'
)
on conflict (plan_id, user_id) do update set role = excluded.role;
