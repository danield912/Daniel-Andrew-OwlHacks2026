"use client";
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";
import type { PlanMember, PlanStop, SavedPlan } from "@/lib/saved-plans";
import { initialsOf } from "@/components/gp/user";
import { AVATAR_COLORS, avatarIndex } from "./members-list";
import { TONE_LOOK, lateTone, timeAgo, type LateAlert, type LiveLocation } from "@/lib/live-client";

type LatLng = { lat: number; lng: number };

const stopPinColors = {
  before: { background: "#fbbf24", borderColor: "#92400e", glyphColor: "#451a03" },
  after: { background: "#a78bfa", borderColor: "#4c1d95", glyphColor: "#ffffff" },
};

function isValidPoint(lat: unknown, lng: unknown): lat is number {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function milesBetween(a: LatLng, b: LatLng) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

// A round crew pin with the person's initials in their avatar color. Live
// pins pulse; the ring turns amber/red when they might be late. Tappable.
function CrewPin({ member, isLive, alert }: { member: PlanMember; isLive: boolean; alert?: LateAlert }) {
  const color = AVATAR_COLORS[avatarIndex(member.userId)];
  const tone = lateTone(alert?.minutesLate);
  const ring = tone === "on-time" ? "#ffffff" : TONE_LOOK[tone].ring;
  return <div className="flex cursor-pointer flex-col items-center transition-transform hover:scale-110" style={{ transform: "translateY(4px)" }}>
    <span className="relative">
      {isLive && <span className="absolute -inset-1.5 animate-pulse-ring rounded-full" style={{ background: tone === "on-time" ? color : ring }} />}
      <span
        className="relative grid h-10 w-10 place-items-center rounded-full border-[3px] text-sm font-extrabold text-slate-950 shadow-lg"
        style={{ background: color, borderColor: ring, boxShadow: `0 6px 18px -4px ${color}` }}
      >{initialsOf(member.name)}</span>
      {tone !== "on-time" && <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full text-[11px] font-black text-slate-950" style={{ background: ring }}>!</span>}
    </span>
    <span className="-mt-1 h-3 w-3 rotate-45 border-b-[3px] border-r-[3px]" style={{ background: color, borderColor: ring }} />
    <span className="mt-0.5 rounded-full bg-slate-950/80 px-2 py-0.5 text-[11px] font-bold text-white">{member.isYou ? "You" : member.name.split(" ")[0]}{isLive ? " · live" : ""}</span>
  </div>;
}

// Zooms the map so the stadium, stops, and crew are all visible.
function FitToPoints({ points }: { points: LatLng[] }) {
  const map = useMap();
  const signature = points.map(point => `${point.lat},${point.lng}`).join("|");
  useEffect(() => {
    if (!map || points.length < 2) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach(point => bounds.extend(point));
    map.fitBounds(bounds, 64);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);
  return null;
}

export function PlanMap({ venue, stops = [], crew = [], liveLocations = [], alerts, now = Date.now(), onSelect }: {
  venue: SavedPlan["game"]["venue"];
  stops?: PlanStop[];
  crew?: PlanMember[];
  liveLocations?: LiveLocation[];
  alerts?: Map<string, LateAlert>;
  now?: number;
  onSelect?: (userId: string) => void;
}) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const lat = venue.latitude;
  const lng = venue.longitude;
  if (!key || !isValidPoint(lat, lng)) {
    return <p className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-slate-300">🗺️ Map unavailable. The map needs a configured browser key and verified venue coordinates. Your schedule is still available.</p>;
  }
  if (error) return <p role="alert" className="rounded-3xl border border-amber-300/25 bg-amber-300/[0.07] p-6 text-amber-100">The map couldn’t load. Check the browser key restrictions and refresh. Your schedule is still available.</p>;

  const mappedStops = stops.filter(stop => stop.place && isValidPoint(stop.place.location.lat, stop.place.location.lng));
  // A live location (game day, while sharing) wins over the starting point.
  const liveBy = new Map(liveLocations.map(location => [location.userId, location]));
  const spotOf = (member: PlanMember) => {
    const live = liveBy.get(member.userId);
    return live ? { lat: live.lat, lng: live.lng } : member.start?.location ?? null;
  };
  const mappedCrew = crew.filter(member => { const spot = spotOf(member); return spot && isValidPoint(spot.lat, spot.lng); });
  const unmapped = crew.filter(member => !spotOf(member));
  const stadium = { lat, lng: lng as number };
  const points = [stadium, ...mappedStops.map(stop => stop.place!.location), ...mappedCrew.map(member => spotOf(member)!)];

  return <div>
    {loading && <p role="status" className="mb-3 text-sm text-slate-300">Loading venue map…</p>}
    <APIProvider apiKey={key} onLoad={() => setLoading(false)} onError={() => setError(true)}>
      <div className="h-[380px] overflow-hidden rounded-3xl ring-1 ring-white/10 sm:h-[480px]" aria-label={`Map showing ${venue.name}, ${mappedStops.length} planned ${mappedStops.length === 1 ? "stop" : "stops"}, and ${mappedCrew.length} crew ${mappedCrew.length === 1 ? "pin" : "pins"}. Tap a person for their ETA and route.`}>
        <GoogleMap defaultCenter={{ lat, lng: lng as number }} defaultZoom={15} mapId="DEMO_MAP_ID" gestureHandling="cooperative">
          <AdvancedMarker position={{ lat, lng: lng as number }} title={`Event: ${venue.name}`} zIndex={10}>
            <Pin background="#ef4444" borderColor="#991b1b" glyphColor="#ffffff" scale={1.4} />
          </AdvancedMarker>
          {mappedStops.map(stop => <AdvancedMarker
            key={`${stop.slot}-${stop.placeId}-${stop.time}`}
            position={stop.place!.location}
            title={`${stop.slot === "before" ? "Pregame" : "After the game"}: ${stop.place!.name}`}
          >
            <Pin {...stopPinColors[stop.slot]} />
          </AdvancedMarker>)}
          {mappedCrew.map(member => <AdvancedMarker
            key={`crew-${member.userId}`}
            position={spotOf(member)!}
            title={liveBy.has(member.userId) ? `${member.name} (live) — tap for ETA and route` : `${member.name} starts from ${member.start?.origin} — tap for their route`}
            zIndex={alerts?.has(member.userId) ? 40 : member.isYou ? 30 : 20}
            onClick={() => onSelect?.(member.userId)}
          >
            <CrewPin member={member} isLive={liveBy.has(member.userId)} alert={alerts?.get(member.userId)} />
          </AdvancedMarker>)}
          <FitToPoints points={points} />
        </GoogleMap>
      </div>
    </APIProvider>
    <ul className="mt-4 flex flex-wrap gap-2 text-sm text-slate-300">
      <li className="flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-red-500" />{venue.name}</li>
      {mappedStops.some(stop => stop.slot === "before") && <li className="flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-amber-400" />Pregame stops</li>}
      {mappedStops.some(stop => stop.slot === "after") && <li className="flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-violet-400" />After-game stops</li>}
      {mappedCrew.length > 0 && <li className="flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-white bg-mint-300" />{liveLocations.length ? "Crew (live or starting point)" : "Crew starting points"}</li>}
    </ul>
    {crew.length > 0 && <div className="mt-4">
      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Where everyone’s coming from</h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {mappedCrew.map(member => {
          const live = liveBy.get(member.userId);
          const alert = alerts?.get(member.userId);
          const tone = lateTone(alert?.minutesLate);
          return <li key={member.userId}>
            <button type="button" onClick={() => onSelect?.(member.userId)} className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.03] px-3 py-2 text-left text-sm transition hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-mint-300">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold text-slate-950" style={{ background: AVATAR_COLORS[avatarIndex(member.userId)] }} aria-hidden="true">{initialsOf(member.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold text-white">
                  <span className="truncate">{member.isYou ? "You" : member.name}</span>
                  {tone !== "on-time" && <span className={`shrink-0 rounded-full px-1.5 text-[10px] font-bold ${TONE_LOOK[tone].chip}`}>{TONE_LOOK[tone].emoji} {TONE_LOOK[tone].label(alert!.minutesLate)}</span>}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {live ? `📡 Live · ${timeAgo(live.updatedAt, now)} · ${milesBetween({ lat: live.lat, lng: live.lng }, stadium).toFixed(1)} mi from the stadium`
                    : `${member.start!.travelMode === "TRANSIT" ? "🚇" : "🚗"} ${member.start!.origin} · ${milesBetween(member.start!.location!, stadium).toFixed(1)} mi away`}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-mint-300">Route ›</span>
            </button>
          </li>;
        })}
        {unmapped.map(member => <li key={member.userId} className="flex items-center gap-3 rounded-2xl border border-dashed border-white/10 px-3 py-2 text-sm text-slate-400">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xs font-bold" aria-hidden="true">{initialsOf(member.name)}</span>
          <span className="min-w-0 truncate">{member.isYou ? "You haven’t" : `${member.name} hasn’t`} added a starting point yet</span>
        </li>)}
      </ul>
    </div>}
    <p className="mt-3 text-xs text-slate-400">Tap anyone for their ETA and route. Pins show live spots on game day (for people sharing) and starting points otherwise. Only people in this plan can see them.</p>
  </div>;
}
