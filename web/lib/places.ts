// Server-only helpers for place suggestions and plan stops (Places API New).
//
// Google policy: only place IDs may be stored. Names, addresses, ratings and
// prices are fetched fresh on every request and never written to the database.

const NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const DETAILS_URL = "https://places.googleapis.com/v1/places/";
const GOOGLE_TIMEOUT_MS = 8_000;

export const MAX_STOPS = 6;
export const TAILGATE_PLACE_ID = "tailgate";
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{1,300}$/;

// ---------- Contract types (agreed with Daniel) ----------

export type LatLng = { lat: number; lng: number };
export type StopSlot = "before" | "after";

export type SuggestedPlace = {
  placeId: string;
  name: string;
  category: string;
  // 0 = free, 1 = $, 2 = $$, 3 = $$$, 4 = $$$$; null when Google doesn't know.
  priceLevel: number | null;
  rating: number | null;
  address: string;
  location: LatLng;
  walkMinutes: number;
  mapsUrl: string;
};

export type SavedStop = { placeId: string; slot: StopSlot; time: string };

export type PlanStop = SavedStop & {
  // null if Google couldn't return details right now.
  place: { name: string; address: string; location: LatLng; category: string } | null;
};

export type PlanVenue = {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

// ---------- Errors ----------

export class PlacesError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function apiKey() {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) throw new PlacesError("Place suggestions are not configured yet.", 503);
  return key;
}

// ---------- Philly geography ----------

// The Linc, Citizens Bank Park and the 76ers' arena (and Temple football at the
// Linc) share the South Philly sports complex, which has few restaurants within
// walking distance. Search 2.5 km around the venue, plus East Passyunk near the
// Broad Street Line when the venue is in the complex.
const SPORTS_COMPLEX: LatLng = { lat: 39.9055, lng: -75.1695 };
const PASSYUNK: LatLng = { lat: 39.9295, lng: -75.1645 };
const VENUE_RADIUS_M = 2_500;
const PASSYUNK_RADIUS_M = 1_000;

export function distanceMeters(a: LatLng, b: LatLng) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

// Straight-line distance, stretched 25% for street grid, at ~4.8 km/h.
// Free to compute; no paid routing call.
export function walkMinutes(a: LatLng, b: LatLng) {
  return Math.max(1, Math.ceil((distanceMeters(a, b) * 1.25) / 80));
}

export function venueLocation(venue: PlanVenue | undefined | null): LatLng | null {
  const lat = venue?.latitude;
  const lng = venue?.longitude;
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
}

function inSportsComplex(location: LatLng) {
  return distanceMeters(location, SPORTS_COMPLEX) < 2_000;
}

// ---------- Preferences -> Google types and budget ----------

const BAR_TYPES = ["bar", "sports_bar", "pub", "bar_and_grill"];
const FOOD_TYPES = ["restaurant"];

export function typesFor(slot: StopSlot, pregame: unknown) {
  if (slot === "before" && pregame === "Food") return FOOD_TYPES;
  if (slot === "before" && pregame === "Bar / hangout") return BAR_TYPES;
  return [...BAR_TYPES, ...FOOD_TYPES];
}

// "$ — Budget-friendly" -> 1, "$$ — Mid-range" -> 2, "$$$ — Treat ourselves" -> 4.
export function maxPriceLevel(budget: unknown) {
  const dollars = typeof budget === "string" ? budget.match(/^\$+/)?.[0].length ?? 0 : 0;
  if (dollars === 1) return 1;
  if (dollars === 2) return 2;
  return 4;
}

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// ---------- Google responses ----------

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  priceLevel?: string;
  rating?: number;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
};

function categoryOf(place: GooglePlace) {
  const label = place.primaryTypeDisplayName?.text?.trim();
  if (label) return label;
  const type = place.primaryType?.replace(/_/g, " ").trim();
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : "Place";
}

function locationOf(place: GooglePlace): LatLng | null {
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
}

async function googleFetch(url: string, init: RequestInit, fieldMask: string) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      headers: {
        ...(init.headers ?? {}),
        "X-Goog-Api-Key": apiKey(),
        "X-Goog-FieldMask": fieldMask,
      },
    });
  } catch (caught) {
    if (caught instanceof PlacesError) throw caught;
    throw new PlacesError("Place suggestions are temporarily unavailable. Please try again.", 502);
  }
  if (!response.ok) {
    // Logged server-side so a disabled API or bad key is easy to spot.
    console.error("Places API error", response.status, (await response.text()).slice(0, 500));
    throw new PlacesError("Place suggestions are temporarily unavailable. Please try again.", 502);
  }
  return response.json();
}

const NEARBY_FIELDS = [
  "places.id",
  "places.displayName",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.priceLevel",
  "places.rating",
  "places.formattedAddress",
  "places.location",
  "places.googleMapsUri",
].join(",");

async function searchNearby(center: LatLng, radius: number, types: string[]) {
  const data = await googleFetch(NEARBY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      includedTypes: types,
      maxResultCount: 20,
      rankPreference: "POPULARITY",
      languageCode: "en",
      regionCode: "us",
      locationRestriction: {
        circle: { center: { latitude: center.lat, longitude: center.lng }, radius },
      },
    }),
  }, NEARBY_FIELDS);
  return (data?.places ?? []) as GooglePlace[];
}

function tailgatePlace(venue: PlanVenue, location: LatLng): SuggestedPlace {
  return {
    placeId: TAILGATE_PLACE_ID,
    name: `Tailgate at ${venue.name}`,
    category: "Tailgate",
    priceLevel: null,
    rating: null,
    address: `Stadium parking lots, ${venue.address || venue.name}`,
    location,
    walkMinutes: 5,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name} parking`)}`,
  };
}

export async function suggestPlaces(options: {
  slot: StopSlot;
  venue: PlanVenue;
  preferences: Record<string, unknown>;
}): Promise<SuggestedPlace[]> {
  const venueAt = venueLocation(options.venue);
  if (!venueAt) {
    throw new PlacesError("This game's venue has no map location, so nearby places can't be suggested.", 422);
  }

  const types = typesFor(options.slot, options.preferences.pregame);
  const nearComplex = inSportsComplex(venueAt);
  const searches = [searchNearby(venueAt, VENUE_RADIUS_M, types)];
  if (nearComplex) searches.push(searchNearby(PASSYUNK, PASSYUNK_RADIUS_M, types));
  const results = (await Promise.all(searches)).flat();

  const budget = maxPriceLevel(options.preferences.budget);
  const seen = new Set<string>();
  const places: SuggestedPlace[] = [];

  for (const place of results) {
    const location = locationOf(place);
    const name = place.displayName?.text?.trim();
    if (!place.id || !name || !location || seen.has(place.id)) continue;
    seen.add(place.id);

    const priceLevel = place.priceLevel ? PRICE_LEVELS[place.priceLevel] ?? null : null;
    // Unknown prices are kept; known prices above the budget are dropped.
    if (priceLevel !== null && priceLevel > budget) continue;

    places.push({
      placeId: place.id,
      name,
      category: categoryOf(place),
      priceLevel,
      rating: typeof place.rating === "number" ? place.rating : null,
      address: place.formattedAddress ?? "",
      location,
      walkMinutes: walkMinutes(location, venueAt),
      mapsUrl: place.googleMapsUri ??
        `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(place.id)}&query=${encodeURIComponent(name)}`,
    });
  }

  places.sort((a, b) => a.walkMinutes - b.walkMinutes || (b.rating ?? 0) - (a.rating ?? 0));

  // Tailgating is the real pregame at the sports complex.
  if (options.slot === "before" && nearComplex) {
    places.unshift(tailgatePlace(options.venue, venueAt));
  }
  return places;
}

// ---------- Stops ----------

const DETAILS_FIELDS = "id,displayName,formattedAddress,location,primaryType,primaryTypeDisplayName";

async function placeDetails(placeId: string) {
  const place = (await googleFetch(
    `${DETAILS_URL}${encodeURIComponent(placeId)}?languageCode=en&regionCode=us`,
    { method: "GET" },
    DETAILS_FIELDS,
  )) as GooglePlace;
  const location = locationOf(place);
  const name = place.displayName?.text?.trim();
  if (!name || !location) return null;
  return { name, address: place.formattedAddress ?? "", location, category: categoryOf(place) };
}

// Reads stops saved in plans.itinerary.stops, ignoring anything malformed.
export function savedStops(itinerary: unknown): SavedStop[] {
  const stops = (itinerary as { stops?: unknown } | null)?.stops;
  if (!Array.isArray(stops)) return [];
  return stops.filter((stop): stop is SavedStop =>
    Boolean(stop) &&
    typeof stop.placeId === "string" &&
    (stop.slot === "before" || stop.slot === "after") &&
    typeof stop.time === "string");
}

// Adds fresh place details to saved stops. One lookup per distinct place;
// a failed lookup gives place: null instead of failing the whole plan.
export async function withPlaceDetails(stops: SavedStop[], venue: PlanVenue): Promise<PlanStop[]> {
  const ids = [...new Set(stops.map((stop) => stop.placeId))];
  const details = new Map<string, PlanStop["place"]>();

  await Promise.all(ids.map(async (id) => {
    if (id === TAILGATE_PLACE_ID) {
      const at = venueLocation(venue);
      details.set(id, at ? {
        name: `Tailgate at ${venue.name}`,
        address: `Stadium parking lots, ${venue.address || venue.name}`,
        location: at,
        category: "Tailgate",
      } : null);
      return;
    }
    try {
      details.set(id, await placeDetails(id));
    } catch (caught) {
      console.error("Place details failed for", id, caught instanceof Error ? caught.message : caught);
      details.set(id, null);
    }
  }));

  return stops.map((stop) => ({ ...stop, place: details.get(stop.placeId) ?? null }));
}

// Validates PUT /stops input. Throws PlacesError(400) with a readable message.
export function parseStops(
  value: unknown,
  rules: { targetArrivalTime: string; gameStartsAt: string | undefined },
): SavedStop[] {
  const stops = (value as { stops?: unknown } | null)?.stops;
  if (!Array.isArray(stops)) throw new PlacesError("Send { stops: [...] }.", 400);
  if (stops.length > MAX_STOPS) throw new PlacesError(`A plan can have at most ${MAX_STOPS} stops.`, 400);

  const arrival = Date.parse(rules.targetArrivalTime);
  const kickoff = rules.gameStartsAt ? Date.parse(rules.gameStartsAt) : NaN;
  const seen = new Set<string>();

  const parsed = stops.map((stop: unknown, index): SavedStop => {
    const label = `Stop ${index + 1}`;
    const s = stop as Partial<Record<"placeId" | "slot" | "time", unknown>> | null;
    if (!s || typeof s !== "object") throw new PlacesError(`${label} is invalid.`, 400);
    if (typeof s.placeId !== "string" || !PLACE_ID_PATTERN.test(s.placeId)) {
      throw new PlacesError(`${label} has an invalid placeId.`, 400);
    }
    if (s.slot !== "before" && s.slot !== "after") {
      throw new PlacesError(`${label} slot must be "before" or "after".`, 400);
    }
    if (typeof s.time !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(s.time) || !Number.isFinite(Date.parse(s.time))) {
      throw new PlacesError(`${label} time must be an ISO 8601 timestamp with a timezone.`, 400);
    }
    const time = Date.parse(s.time);
    // Pregame stops happen around the stadium: after you arrive, before kickoff.
    if (s.slot === "before" && time < arrival) {
      throw new PlacesError(`${label} must be after you arrive at the stadium area.`, 400);
    }
    if (s.slot === "before" && Number.isFinite(kickoff) && time >= kickoff) {
      throw new PlacesError(`${label} must be before kickoff.`, 400);
    }
    if (s.slot === "after" && Number.isFinite(kickoff) && time <= kickoff) {
      throw new PlacesError(`${label} must be after kickoff.`, 400);
    }
    const key = `${s.slot}:${s.placeId}`;
    if (seen.has(key)) throw new PlacesError(`${label} is already in the plan.`, 400);
    seen.add(key);
    return { placeId: s.placeId, slot: s.slot, time: new Date(time).toISOString() };
  });

  return parsed.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}
