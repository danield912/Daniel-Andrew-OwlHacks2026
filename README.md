# Philly GamePlan

Plan a whole game day with friends. Pick an upcoming **Eagles, Phillies, 76ers or Temple football** game,
set when you want to be at the stadium, and get a route and leave-by time from wherever you're starting.
Save the plan, invite friends with a link, add pregame and postgame stops near the venue (bars,
restaurants, or a tailgate), and see everyone's day on one schedule and map.

Built for OwlHacks 2026 by Daniel Dada and Andrew Kirkpatrick.

## Features

- **Upcoming games** for the four Philly teams, with sport and team on every game.
- **Arrive-by planning:** transit or driving route that gets you there on time (Google Routes).
- **Saved plans** with roles (leader, co-leader, member), **invite links**, and a members list.
- **Stops near the venue:** suggestions filtered by your pregame choice and budget, walk times,
  and a tailgate option at the South Philly sports complex.
- **Delete / leave** plans, and friendly error messages when an outside service is down.

## APIs and services

| Service | Used for |
| --- | --- |
| [Supabase](https://supabase.com) | Sign-in (email + password) and the Postgres database, with row-level security |
| [Ticketmaster Discovery API](https://developer.ticketmaster.com/) | Upcoming games, start times and venues |
| [Google Routes API](https://developers.google.com/maps/documentation/routes) | Transit/driving routes and leave-by times |
| [Google Places API (New)](https://developers.google.com/maps/documentation/places/web-service/op-overview) | Nearby bars and restaurants, fresh place details |
| [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript) | The plan map (browser key) |

Following Google's terms, only Place IDs are stored; names and addresses are fetched fresh each time.

## Run it locally

Requirements: Node.js 20+ and npm.

```bash
cd web
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                   # http://localhost:3000
```

| Variable | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Cloud browser key (Maps JavaScript API), restricted to your site's domains |
| `GOOGLE_MAPS_SERVER_API_KEY` | Google Cloud server key with **Routes API** and **Places API (New)** enabled |
| `TICKETMASTER_API_KEY` | Ticketmaster developer account (Consumer Key) |

### Database

In the Supabase **SQL Editor**, run each file in `web/supabase/migrations/` once, **in filename order**.
All of them are safe to re-run. API details for each part are in [`web/supabase/README.md`](web/supabase/README.md).

## Deploy (Vercel)

1. **Import** the GitHub repo in Vercel and set **Root Directory = `web`** (framework: Next.js).
2. **Environment variables:** add all five variables above (Production and Preview), then redeploy.
3. **Supabase → Authentication → URL Configuration:** set **Site URL** to the Vercel URL and add
   `https://<your-app>.vercel.app/**` to **Redirect URLs** (keep `http://localhost:3000/**` for local dev),
   so confirmation emails open the live site instead of localhost.
4. **Google Cloud → Credentials → browser key → Website restrictions:** add `https://<your-app>.vercel.app/*`,
   or the map won't load.
5. Open the Vercel link on a phone: sign in, plan, save, add stops, check the map.

Location sharing (the live group map) only works over **https**, so test it on the Vercel link.

## Project layout

```
web/app/api/        API routes (games, route planning, plans, invites, stops, suggestions)
web/app/, components/  Pages and UI
web/lib/            Shared server and client helpers
web/supabase/       SQL migrations and API notes
```
