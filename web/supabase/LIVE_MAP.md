# Live group map API (migration `20260926230000_live_group_map.sql`)

All endpoints: `401 { error: "Please sign in." }` signed out, `404 { error: "Plan not found." }` if not a member,
errors as `{ "error": "readable message" }`, `Cache-Control: private, no-store`.

**Game-day window:** from 3 hours before the plan's arrive-by time to 2 hours after the estimated end of the game
(Linc 3h15, Citizens Bank Park 3h, arena 2h30, same as `estimatedGameEnd()` in `lib/game-day.ts`).

| Method | Path | Sends → gets back |
| --- | --- | --- |
| PUT | `/api/plans/[id]/location` | `{ lat, lng, accuracy }` → `{ sharing: true, expiresAt }`. **403** outside the window, with a message like "Location sharing opens on game day (Sun, Oct 11, 10:15 AM, 3 hours before your arrival time)." or "Location sharing has ended for this game." |
| DELETE | `/api/plans/[id]/location` | → `{ sharing: false }` (row deleted right away; works any time) |
| GET | `/api/plans/[id]/locations` | → `{ locations: [{ userId, name, lat, lng, accuracy, updatedAt, isYou }], window: { startsAt, endsAt } }` |
| GET | `/api/plans/[id]/locations/[userId]/eta` | → `{ target: { kind, name, at }, etaAt, minutes, lateByMinutes, calculatedAt }` or `{ target: null }`. **404** if they aren't sharing, **502** if Google Routes fails |
| POST | `/api/plans/[id]/alerts` | `{ minutesLate: 5 \| 15 \| 30, note? }` (note ≤ 140 chars) → **201** `{ alert }`. **403** outside the window |
| GET | `/api/plans/[id]/alerts?since=ISO` | → `{ alerts: [{ id, userId, name, kind, minutesLate, target, eta, note, createdAt, isYou }] }`, newest first, max 50 |
| POST | `/api/plans/[id]/alerts/[alertId]/dismiss` | → `{ dismissed: true }`. **403** if it isn't your alert |

Details:

- `kind` on alerts is `"manual"` or `"auto"`. `target` is `{ kind: "stop" | "stadium" | "kickoff", name, at }` or `null`.
- **Next stop** = whichever comes first in time among pregame stops, the stadium at the arrive-by time, and kickoff.
  `name` is the place name (fresh from Google) for stops, the venue name for stadium/kickoff.
- **ETA** uses Google Routes from the friend's live spot: walking if under 1.5 km, otherwise the plan's travel mode.
  `lateByMinutes` is `0` when on time. ETAs are never stored.
- **Manual alert** `eta` = the target time + `minutesLate` (no Routes call).
- **Automatic alerts** run inside `PUT /location`, at most once every 3 minutes per person: if the ETA to the next
  stop is 10+ minutes late, one `auto` alert is created for that stop. It's only updated (new `createdAt`, so
  `?since=` picks it up again) if it gets 10+ more minutes worse.
- **Dismiss** hides the alert from the late person's own list; the rest of the crew still sees it.
- Only one location row per person (overwritten, no history). Locations and alerts expire at the end of the window
  and are purged on every live request (plus every 15 minutes via pg_cron if Supabase allows it). Leaving or
  deleting a plan removes them immediately.
- Alerts store a Google place ID for stop targets, never place names.
