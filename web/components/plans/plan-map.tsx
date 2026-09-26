"use client";
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";
import type { PlanStop, SavedPlan } from "@/lib/saved-plans";

type LatLng = { lat: number; lng: number };

const stopPinColors = {
  before: { background: "#fbbf24", borderColor: "#92400e", glyphColor: "#451a03" },
  after: { background: "#a78bfa", borderColor: "#4c1d95", glyphColor: "#ffffff" },
};

function isValidPoint(lat: unknown, lng: unknown): lat is number {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

// Zooms the map so the stadium and every stop are visible.
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

export function PlanMap({ venue, stops = [] }: { venue: SavedPlan["game"]["venue"]; stops?: PlanStop[] }) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const lat = venue.latitude;
  const lng = venue.longitude;
  if (!key || !isValidPoint(lat, lng)) {
    return <p className="rounded-xl bg-white/5 p-6">Map unavailable. The map needs a configured browser key and verified venue coordinates. Your schedule is still available.</p>;
  }
  if (error) return <p role="alert" className="rounded-xl bg-amber-200/10 p-6 text-amber-100">The map couldn’t load. Check the browser key restrictions and refresh. Your schedule is still available.</p>;

  const mappedStops = stops.filter(stop => stop.place && isValidPoint(stop.place.location.lat, stop.place.location.lng));
  const points = [{ lat, lng: lng as number }, ...mappedStops.map(stop => stop.place!.location)];

  return <div>
    {loading && <p role="status" className="mb-3 text-sm text-slate-300">Loading venue map…</p>}
    <APIProvider apiKey={key} onLoad={() => setLoading(false)} onError={() => setError(true)}>
      <div className="h-[360px] overflow-hidden rounded-2xl sm:h-[480px]" aria-label={`Map showing ${venue.name}${mappedStops.length ? ` and ${mappedStops.length} planned ${mappedStops.length === 1 ? "stop" : "stops"}` : ""}`}>
        <Map defaultCenter={{ lat, lng: lng as number }} defaultZoom={15} mapId="DEMO_MAP_ID" gestureHandling="cooperative">
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
          <FitToPoints points={points} />
        </Map>
      </div>
    </APIProvider>
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
      <li className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-red-500" />{venue.name}</li>
      {mappedStops.some(stop => stop.slot === "before") && <li className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-amber-400" />Pregame stops</li>}
      {mappedStops.some(stop => stop.slot === "after") && <li className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-violet-400" />After-game stops</li>}
    </ul>
    <p className="mt-2 text-xs text-slate-400">This view shows planned places, not live member locations.</p>
  </div>;
}
