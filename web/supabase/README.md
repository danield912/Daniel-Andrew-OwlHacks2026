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
`route_snapshot` long-term (e.g. purge or re-fetch it after the game). The purge
script was removed for the hackathon so nobody runs it by accident; the plan page
still works if a plan's route is null (it shows the arrive-by time and directions).

## Invites (migration `20260926200000_create_plan_invites.sql`)

Field names follow Daniel's `lib/saved-plans.ts` (`PlanMember`, `InvitePreview`);
`lib/plan-invites-api.ts` mirrors them. Every error is `{ "error": "Readable message" }`
and every response is `Cache-Control: private, no-store`.

| Endpoint | Success | Errors |
| --- | --- | --- |
| `POST /api/plans/[id]/invites` | `201 { invite: { token, url, expiresAt } }` | `401` signed out · `403` member but not leader/co-leader · `404` no plan or not a member |
| `GET /api/invites/[token]` (works signed out) | `200 { invite: InvitePreview }` | `404` made-up link · `410` expired link |
| `POST /api/invites/[token]/accept` | `200 { plan: { id }, joined }` | `401` signed out · `404` made-up link · `410` expired link |

- Links last 7 days; each click makes a new one.
- `InvitePreview` = `{ planId, planTitle, invitedBy, expiresAt, alreadyMember, game: { name, startsAt, venue: { name } } }`.
  Never includes the origin, itinerary, route, preferences or member list.
- Accepting is idempotent: `joined: false` means the viewer was already a member
  (including the leader) and nothing changed.

`GET /api/plans/[id]` now also returns `members: [{ userId, name, role, isYou }]`, leader first.
`name` is the account's profile name if set, otherwise the part of the email
before "@". Full email addresses are never returned.

## Delete and leave (migration `20260926210000_plan_delete_and_leave.sql`)

| Endpoint | Success | Errors |
| --- | --- | --- |
| `DELETE /api/plans/[id]` | `200 { deleted: true }` | `401` signed out · `403` co-leader or member · `404` no plan or not a member |
| `POST /api/plans/[id]/leave` | `200 { left: true }` | `401` signed out · `400 "Delete the plan instead"` leader · `404` no plan or not a member |

- Deleting a plan cascades to its members and invite links, so afterwards
  `GET /api/plans/[id]`, `GET /api/invites/[token]` and its accept all return `404`.
- Leaving removes only the signed-in user; the plan and everyone else stay.
  Someone who left can rejoin with a still-valid invite link.

## Place suggestions and stops (migration `20260926220000_plan_stops.sql`)

Needs **Places API (New)** enabled for `GOOGLE_MAPS_SERVER_API_KEY`. Types are in `lib/places.ts`.

| Endpoint | Success | Errors |
| --- | --- | --- |
| `GET /api/plans/[id]/suggestions?slot=before\|after` | `200 { places: SuggestedPlace[] }` (any member) | `400` bad slot · `401` · `404` · `422` venue has no location · `502` Google failed · `503` key missing |
| `PUT /api/plans/[id]/stops` body `{ stops: [{ placeId, slot, time }] }` | `200 { stops: PlanStop[] }` (replaces all stops) | `400` invalid stops · `401` · `403` plain member · `404` |

- `SuggestedPlace` = `{ placeId, name, category, priceLevel, rating, address, location: { lat, lng }, walkMinutes, mapsUrl }`.
  `priceLevel` is `0–4` (`1` = $) or `null`; `rating` is a number or `null`.
- `GET /api/plans/[id]` now also returns `stops: [{ placeId, slot, time, place: { name, address, location, category } | null }]`,
  sorted by time. `place` is `null` if Google can't return details at that moment.
- Only `placeId`, `slot` and `time` are stored (in `plans.itinerary.stops`); place details are fetched fresh on every load.
- Rules: at most 6 stops; `before` stops must be before the stadium arrival time, `after` stops after kickoff;
  `time` is ISO 8601 with a timezone; no duplicate place in the same slot. Only leader/co-leader can change stops.
- Place types: before + "Food" → restaurants; before + "Bar / hangout" → bars, sports bars, pubs, bar & grills;
  otherwise (and all `after` searches) → both. Places priced above the budget are dropped; unknown prices are kept.
- Search area: 2.5 km around the venue, plus East Passyunk (near the Broad Street Line) for the South Philly
  sports complex. `walkMinutes` is straight-line distance ×1.25 at walking pace, from the venue (no paid route call).
- For `slot=before` at the sports complex, the first result is a **Tailgate** option with `placeId: "tailgate"`
  (no rating/price). It can be saved as a stop like any other place.
- Show "Google Maps" attribution next to place results and link each place with `mapsUrl` (Google policy).
