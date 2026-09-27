"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  alertHeadline,
  liveRequest,
  LiveError,
  metersBetween,
  windowState,
  type LateAlert,
  type LiveLocation,
  type LiveWindow,
} from "@/lib/live-client";
import { useToast } from "@/components/gp/toast";

type ShareStatus = "off" | "asking" | "on" | "denied" | "unavailable";

const POLL_OPEN_MS = 15_000;
const POLL_CLOSED_MS = 60_000;
const SEND_EVERY_MS = 30_000;
const SEND_IF_MOVED_M = 40;

export type Live = ReturnType<typeof useLive>;

// Everything live for one plan: friends' locations, your own sharing, and
// "might be late" alerts (with toasts and browser notifications for new ones).
export function useLive(planId: string) {
  const toast = useToast();
  const [now, setNow] = useState(() => Date.now());
  const [locations, setLocations] = useState<LiveLocation[]>([]);
  const [liveWindow, setLiveWindow] = useState<LiveWindow | null>(null);
  const [alerts, setAlerts] = useState<LateAlert[]>([]);
  const [connected, setConnected] = useState(true);
  const [share, setShare] = useState<ShareStatus>("off");
  const [shareError, setShareError] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const seen = useRef<Map<string, string> | null>(null); // alert id -> createdAt already shown
  const watchId = useRef<number | null>(null);
  const lastSent = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const base = `/api/plans/${encodeURIComponent(planId)}`;

  useEffect(() => {
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const notify = useCallback((alert: LateAlert) => {
    const body = [alert.note, alert.eta ? `New ETA ${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(alert.eta))}` : ""].filter(Boolean).join(" · ");
    toast.error({ title: `⚠️ ${alertHeadline(alert)}`, body: body || undefined });
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
      try { new Notification(`⚠️ ${alertHeadline(alert)}`, { body, tag: alert.id }); } catch { /* some browsers only allow this from a service worker */ }
    }
  }, [toast]);

  const refresh = useCallback(async () => {
    setNow(Date.now());
    try {
      const [loc, al] = await Promise.all([
        liveRequest(`${base}/locations`),
        liveRequest(`${base}/alerts`),
      ]);
      setConnected(true);
      setLocations(loc.locations ?? []);
      setLiveWindow(loc.window ?? null);
      const list = (al.alerts ?? []) as LateAlert[];
      // Toast only alerts that are new since the page opened, and not your own.
      if (seen.current) {
        for (const alert of [...list].reverse()) {
          if (!alert.isYou && seen.current.get(alert.id) !== alert.createdAt) notify(alert);
        }
      }
      seen.current = new Map(list.map(alert => [alert.id, alert.createdAt]));
      setAlerts(list);
    } catch (caught) {
      if (caught instanceof LiveError && caught.status === 401) return;
      setConnected(false);
    }
  }, [base, notify]);

  const state = windowState(liveWindow, now);

  // Poll: every 15 seconds on game day, every minute otherwise; pause when hidden.
  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, state === "open" ? POLL_OPEN_MS : POLL_CLOSED_MS);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh, state]);

  // ---------- Sharing your location ----------

  const send = useCallback(async (lat: number, lng: number, accuracy: number) => {
    const previous = lastSent.current;
    const moved = previous ? metersBetween(previous, { lat, lng }) : Infinity;
    if (previous && Date.now() - previous.at < SEND_EVERY_MS && moved < SEND_IF_MOVED_M) return;
    lastSent.current = { at: Date.now(), lat, lng };
    try {
      await liveRequest(`${base}/location`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, accuracy: Math.min(Math.round(accuracy), 100_000) }),
      }, "We couldn’t share your location.");
      setShareError("");
    } catch (caught) {
      setShareError(caught instanceof Error ? caught.message : "We couldn’t share your location.");
      if (caught instanceof LiveError && caught.status === 403) stopWatching();
    }
  }, [base]);

  function stopWatching() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    lastSent.current = null;
    setShare("off");
  }

  const startSharing = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setShare("unavailable");
      setShareError("This browser can’t share location.");
      return;
    }
    setShare("asking");
    setShareError("");
    watchId.current = navigator.geolocation.watchPosition(
      position => {
        setShare("on");
        send(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
      },
      error => {
        stopWatching();
        if (error.code === error.PERMISSION_DENIED) {
          setShare("denied");
          setShareError("Location is blocked for this site. Allow it in your browser’s site settings (the icon next to the address), then try again.");
        } else {
          setShare("unavailable");
          setShareError("We couldn’t get your location. Check that location services are on, then try again.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
  }, [send]);

  const stopSharing = useCallback(async () => {
    stopWatching();
    try {
      await liveRequest(`${base}/location`, { method: "DELETE" }, "We couldn’t stop sharing.");
      toast.info("You stopped sharing your location");
      refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn’t stop sharing.");
    }
  }, [base, refresh, toast]);

  // Leaving the page stops sharing, so friends never see a stale pin.
  useEffect(() => {
    const leave = () => {
      if (watchId.current === null) return;
      navigator.geolocation.clearWatch(watchId.current);
      fetch(`${base}/location`, { method: "DELETE", keepalive: true }).catch(() => undefined);
    };
    window.addEventListener("pagehide", leave);
    return () => { window.removeEventListener("pagehide", leave); leave(); };
  }, [base]);

  // ---------- Alerts ----------

  const sendLate = useCallback(async (minutesLate: 5 | 15 | 30, note: string) => {
    const data = await liveRequest(`${base}/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutesLate, note: note || undefined }),
    }, "We couldn’t send your alert.");
    const alert = data.alert as LateAlert;
    seen.current?.set(alert.id, alert.createdAt);
    setAlerts(current => [alert, ...current]);
    return alert;
  }, [base]);

  const dismiss = useCallback(async (alertId: string) => {
    await liveRequest(`${base}/alerts/${encodeURIComponent(alertId)}/dismiss`, { method: "POST" }, "We couldn’t dismiss this alert.");
    setAlerts(current => current.filter(alert => alert.id !== alertId));
  }, [base]);

  const enableNotifications = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") toast.success("Notifications on 🔔 You’ll hear when someone’s running late");
  }, [toast]);

  // Latest alert per person (for pin colors and cards), newest first already.
  const latestAlert = useMemo(() => {
    const map = new Map<string, LateAlert>();
    for (const alert of alerts) if (!map.has(alert.userId)) map.set(alert.userId, alert);
    return map;
  }, [alerts]);

  return {
    now,
    connected,
    window: liveWindow,
    state,
    locations,
    alerts,
    latestAlert,
    share,
    shareError,
    startSharing,
    stopSharing,
    sendLate,
    dismiss,
    permission,
    enableNotifications,
    refresh,
  };
}
