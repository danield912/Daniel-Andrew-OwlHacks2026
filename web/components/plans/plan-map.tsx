"use client";
import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";
import { useState } from "react";
import type { SavedPlan } from "@/lib/saved-plans";

export function PlanMap({ venue }: { venue: SavedPlan["game"]["venue"] }) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const lat = venue.latitude;
  const lng = venue.longitude;
  if (!key || typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return <p className="rounded-xl bg-white/5 p-6">Map unavailable. The map needs a configured browser key and verified venue coordinates. Your schedule is still available.</p>;
  }
  if (error) return <p role="alert" className="rounded-xl bg-amber-200/10 p-6 text-amber-100">The map couldn’t load. Check the browser key restrictions and refresh. Your schedule is still available.</p>;
  return <div>
    {loading && <p role="status" className="mb-3 text-sm text-slate-300">Loading venue map…</p>}
    <APIProvider apiKey={key} onLoad={() => setLoading(false)} onError={() => setError(true)}>
      <div className="h-[360px] overflow-hidden rounded-2xl sm:h-[480px]" aria-label={`Map showing ${venue.name}`}>
        <Map defaultCenter={{ lat, lng }} defaultZoom={15} mapId="DEMO_MAP_ID" gestureHandling="cooperative">
          <AdvancedMarker position={{ lat, lng }} title={`Event: ${venue.name}`}>
            <Pin background="#ef4444" borderColor="#991b1b" glyphColor="#ffffff" scale={1.4} />
          </AdvancedMarker>
        </Map>
      </div>
    </APIProvider>
    <p className="mt-3 text-sm text-slate-300">Red marker: {venue.name}. This view shows the venue, not live member locations.</p>
  </div>;
}
