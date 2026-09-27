// Server-only: live SEPTA service status for the lines on someone's route.
// Uses SEPTA's free public API (www3.septa.org/api): service alerts for every
// line, plus live vehicle lateness for buses and trolleys (TransitView).
// Subway lines (B1, L1) have alerts only; SEPTA doesn't publish live train delays.

const ALERTS_URL = "https://www3.septa.org/api/Alerts/index.php";
const TRANSITVIEW_URL = "https://www3.septa.org/api/TransitView/index.php";
const CACHE_MS = 60_000;
const TIMEOUT_MS = 8_000;

export type LineLevel = "normal" | "info" | "detour" | "delays" | "alert" | "suspended" | "unknown";

export type LineStatus = {
  line: string; // as it appears on the route, e.g. "B1", "17", "T3"
  name: string; // e.g. "Broad Street Line (B1)"
  mode: "subway" | "bus" | "trolley" | "rail";
  level: LineLevel;
  headline: string;
  detail: string | null;
  avgLateMinutes: number | null; // buses/trolleys only
  vehicles: number | null;
  checkedAt: string;
};

// SEPTA's 2025 line names (B1, L1, T1…) mapped to the IDs its API still uses.
const SUBWAY: Record<string, { alertIds: string[]; name: string; mode: LineStatus["mode"] }> = {
  B1: { alertIds: ["rr_route_bsl"], name: "Broad Street Line (B1)", mode: "subway" },
  B2: { alertIds: ["rr_route_bsl"], name: "Broad Street Line express (B2)", mode: "subway" },
  B3: { alertIds: ["rr_route_bsl"], name: "Broad-Ridge Spur (B3)", mode: "subway" },
  BSL: { alertIds: ["rr_route_bsl"], name: "Broad Street Line", mode: "subway" },
  L1: { alertIds: ["rr_route_mfl"], name: "Market-Frankford Line (L1)", mode: "subway" },
  MFL: { alertIds: ["rr_route_mfl"], name: "Market-Frankford Line", mode: "subway" },
  M1: { alertIds: ["rr_route_nhsl"], name: "Norristown High Speed Line (M1)", mode: "rail" },
};
const TROLLEY: Record<string, string> = { T1: "10", T2: "34", T3: "13", T4: "11", T5: "36", G1: "15", D1: "101", D2: "102" };

// "Take B1 from Cecil B. Moore to NRG" -> "B1"
export function linesFromSteps(steps: string[] | undefined) {
  const lines: string[] = [];
  for (const step of steps ?? []) {
    const match = step.match(/^Take (.+?) from /i);
    if (match && !lines.includes(match[1].trim())) lines.push(match[1].trim());
  }
  return lines;
}

type AlertRow = {
  route_id: string;
  route_name?: string;
  isdelays?: string;
  isalert?: string;
  issuspended?: string;
  isdetour?: string;
  isadvisory?: string;
  alert?: string;
  advisory?: string;
  last_updated?: string;
};

const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function getJson(url: string) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`SEPTA ${response.status}`);
  return response.json();
}

const yes = (value: string | undefined) => /^y/i.test(value ?? "");

function plainText(html: string | undefined) {
  if (!html) return "";
  return html
    .replace(/<\/(p|h\d|li|div)>/gi, ". ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "’")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .replace(/(\. )+/g, ". ")
    .trim()
    .replace(/^\.\s*/, "");
}

function firstSentences(text: string, max = 220) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf(". ");
  return (end > 60 ? cut.slice(0, end + 1) : `${cut.trim()}…`);
}

function describe(line: string) {
  const upper = line.toUpperCase();
  if (SUBWAY[upper]) return { ...SUBWAY[upper], transitView: null as string | null };
  if (TROLLEY[upper]) return { alertIds: [`trolley_route_${TROLLEY[upper]}`], name: `Trolley ${upper}`, mode: "trolley" as const, transitView: TROLLEY[upper] };
  if (/^\d{1,3}[A-Z]?$/.test(upper)) return { alertIds: [`bus_route_${upper}`], name: `Bus ${upper}`, mode: "bus" as const, transitView: upper };
  return null; // e.g. Regional Rail names or non-SEPTA lines
}

// Live status for each line on a route. Never throws; unknown on SEPTA errors.
export async function lineStatuses(lines: string[]): Promise<LineStatus[]> {
  const checkedAt = new Date().toISOString();
  let alerts: AlertRow[] | null = null;
  try {
    alerts = await cached("alerts", async () => (await getJson(ALERTS_URL)) as AlertRow[]);
  } catch {
    alerts = null;
  }

  return Promise.all(lines.slice(0, 6).map(async (line): Promise<LineStatus> => {
    const info = describe(line);
    if (!info) {
      return { line, name: line, mode: "rail", level: "unknown", headline: "No live status for this line", detail: null, avgLateMinutes: null, vehicles: null, checkedAt };
    }
    const rows = (alerts ?? []).filter(row => info.alertIds.includes(row.route_id));
    const main = rows[0];

    // Live bus/trolley lateness: average of vehicles currently running late.
    let avgLateMinutes: number | null = null;
    let vehicles: number | null = null;
    if (info.transitView) {
      try {
        const data = await cached(`tv:${info.transitView}`, () => getJson(`${TRANSITVIEW_URL}?route=${encodeURIComponent(info.transitView!)}`)) as { bus?: Array<{ late?: number }> };
        const late = (data.bus ?? []).map(bus => Number(bus.late)).filter(Number.isFinite);
        vehicles = late.length;
        avgLateMinutes = late.length ? Math.round(late.reduce((sum, value) => sum + Math.max(0, value), 0) / late.length) : null;
      } catch {
        vehicles = null;
      }
    }

    const alertText = firstSentences(plainText(main?.alert));
    const advisoryText = firstSentences(plainText(main?.advisory));
    const noun = info.mode === "bus" ? "Buses" : info.mode === "trolley" ? "Trolleys" : "Trains";

    let level: LineLevel = "normal";
    let headline = `${noun} running normally`;
    let detail: string | null = null;
    if (!alerts && avgLateMinutes === null) {
      level = "unknown"; headline = "SEPTA status unavailable right now";
    } else if (rows.some(row => yes(row.issuspended))) {
      level = "suspended"; headline = "Service suspended"; detail = alertText || advisoryText || null;
    } else if (rows.some(row => yes(row.isdelays))) {
      level = "delays"; headline = "Delays reported"; detail = alertText || null;
    } else if (rows.some(row => yes(row.isalert)) && alertText) {
      level = "alert"; headline = "Service alert"; detail = alertText;
    } else if (avgLateMinutes !== null && avgLateMinutes >= 5) {
      level = "delays"; headline = `${noun} running ~${avgLateMinutes} min late`;
    } else if (rows.some(row => yes(row.isdetour))) {
      level = "detour"; headline = "Detour in effect"; detail = advisoryText || null;
    } else if (rows.some(row => yes(row.isadvisory)) && advisoryText) {
      level = "info"; headline = `${noun} running · service notice`; detail = advisoryText;
    }
    if (level === "normal" && vehicles) headline = `${noun} running normally · ${vehicles} on the road`;

    return { line, name: info.name, mode: info.mode, level, headline, detail, avgLateMinutes, vehicles, checkedAt };
  }));
}
