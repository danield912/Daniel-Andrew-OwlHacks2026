# Saved plans (Supabase)

## Apply the schema

Run `migrations/20260926160000_create_saved_plans.sql` once, either:

- Supabase dashboard → SQL Editor → paste the file → Run, or
- `supabase db push` if the CLI is linked to the project.

It creates `plans` and `plan_members`, enables RLS, and adds the
`create_plan_with_leader` RPC. Browser/anon roles cannot insert or update
either table directly; creation goes only through the RPC, which sets the
creator from `auth.uid()` and inserts the leader membership in the same
transaction. `(created_by, client_request_id)` is unique, so retries (even
concurrent ones) return the same plan.

## API (see `lib/saved-plan-api.ts`)

| Endpoint | Success | Notes |
| --- | --- | --- |
| `POST /api/plans` | `201 { plan: { id } }` (`200` on idempotent retry) | Body: SavePlanInput + `clientRequestId` (UUID) |
| `GET /api/plans` | `200 { plans: SavedPlan[] }` | Only plans the viewer is a member of, newest first |
| `GET /api/plans/[id]` | `200 { plan: SavedPlan }` | `404` if absent or not a member |

Errors are `{ "error": "Readable message" }`; unauthenticated calls get
`401 { "error": "Please sign in." }` (no redirect). Responses are
`Cache-Control: private, no-store`.

`SavedPlan` = `gameId, origin, travelMode, targetArrivalTime, preferences,
itinerary, routeSnapshot, routeCalculatedAt` plus `id, title, role, createdAt,
game`. `role` is the viewer's role (`leader | co_leader | member`). `game` is
looked up server-side from Ticketmaster by `gameId`:
`{ name, startsAt, venue: { name, address, latitude, longitude } }`
(coordinates are numbers or `null`). All timestamps are ISO 8601 with a
timezone; display in America/New_York.

`routeSnapshot` is the client's last `/api/plan` result and is **not** a live
ETA — show it with `routeCalculatedAt`. Saving never triggers a new routing call.

## Testing the Joined tab

Sign up a second test user, then run `snippets/add_test_member.sql` in the SQL
editor with the plan id and that user's email.

## Open item

Check Google Maps Platform terms on caching Routes API content before keeping
`route_snapshot` long-term (e.g. purge or re-fetch it after the game).
