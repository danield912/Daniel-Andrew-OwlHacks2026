// Server-only: game-day forecast from the U.S. National Weather Service
// (api.weather.gov — free, no key). Hourly forecasts reach about 6 days ahead.

const USER_AGENT = "PhillyGamePlan (OwlHacks student project)";
const POINT_CACHE_MS = 24 * 60 * 60_000;
const FORECAST_CACHE_MS = 30 * 60_000;

export type WeatherHour = {
  at: string;
  label: string; // "Arrive", "Kickoff", "Later"
  temperature: number;
  unit: "F" | "C";
  forecast: string; // e.g. "Rain Showers"
  precipChance: number | null;
  wind: string;
  isDaytime: boolean;
  emoji: string;
};

export type GameWeather =
  | { available: true; hours: WeatherHour[]; checkedAt: string }
  | { available: false; reason: string };

type Period = {
  startTime: string;
  endTime: string;
  temperature: number;
  temperatureUnit: "F" | "C";
  shortForecast: string;
  probabilityOfPrecipitation?: { value: number | null };
  windSpeed: string;
  isDaytime: boolean;
};

const cache = new Map<string, { at: number; value: unknown }>();

async function nws<T>(url: string, maxAge: number): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < maxAge) return hit.value as T;
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
  });
  if (!response.ok) throw new Error(`NWS ${response.status}`);
  const value = await response.json();
  cache.set(url, { at: Date.now(), value });
  return value as T;
}

export function weatherEmoji(forecast: string, isDaytime: boolean) {
  const text = forecast.toLowerCase();
  if (/thunder/.test(text)) return "⛈️";
  if (/snow|flurr|sleet/.test(text)) return "🌨️";
  if (/rain|shower|drizzle/.test(text)) return "🌧️";
  if (/fog|haze/.test(text)) return "🌫️";
  if (/partly|mostly sunny|mostly clear/.test(text)) return isDaytime ? "⛅" : "🌙";
  if (/cloud|overcast/.test(text)) return "☁️";
  if (/wind/.test(text)) return "💨";
  return isDaytime ? "☀️" : "🌙";
}

// Forecast at the stadium for each requested moment (e.g. arrival, kickoff).
export async function gameWeather(lat: number, lng: number, moments: Array<{ at: string; label: string }>): Promise<GameWeather> {
  const point = `https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`;
  let periods: Period[];
  try {
    const meta = await nws<{ properties?: { forecastHourly?: string } }>(point, POINT_CACHE_MS);
    const hourlyUrl = meta.properties?.forecastHourly;
    if (!hourlyUrl) return { available: false, reason: "No forecast for this location." };
    const hourly = await nws<{ properties?: { periods?: Period[] } }>(hourlyUrl, FORECAST_CACHE_MS);
    periods = hourly.properties?.periods ?? [];
  } catch {
    return { available: false, reason: "The weather service isn’t responding right now." };
  }
  if (!periods.length) return { available: false, reason: "No forecast right now." };

  const last = Date.parse(periods[periods.length - 1].endTime);
  const hours: WeatherHour[] = [];
  for (const moment of moments) {
    const time = Date.parse(moment.at);
    if (!Number.isFinite(time) || time > last) continue;
    const period = periods.find(item => time >= Date.parse(item.startTime) && time < Date.parse(item.endTime));
    if (!period) continue;
    hours.push({
      at: moment.at,
      label: moment.label,
      temperature: period.temperature,
      unit: period.temperatureUnit,
      forecast: period.shortForecast,
      precipChance: period.probabilityOfPrecipitation?.value ?? null,
      wind: period.windSpeed,
      isDaytime: period.isDaytime,
      emoji: weatherEmoji(period.shortForecast, period.isDaytime),
    });
  }
  if (!hours.length) {
    const opens = new Date(Date.parse(moments[0]?.at ?? "") - 6 * 24 * 60 * 60_000);
    return {
      available: false,
      reason: Number.isFinite(opens.getTime()) && opens.getTime() > Date.now()
        ? `The forecast shows up about 6 days before the game (around ${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(opens)}).`
        : "No forecast for this game.",
    };
  }
  return { available: true, hours, checkedAt: new Date().toISOString() };
}
