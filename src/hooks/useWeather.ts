import { useState, useEffect, useRef } from 'react';
import { City } from '../data/cities';
import { Coordinate, Route } from '../data/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RunCondition = 'great' | 'good' | 'fair' | 'tough';

export interface HourlySlice {
  hour: number;
  tempC: number;
  precipPct: number;
  condition: RunCondition;
}

export interface WeatherData {
  tempC: number;
  feelsLikeC: number;
  /** Rain chance for the relevant run window (not “raining now”) */
  precipPct: number;
  precipMm: number;
  rainingNow: boolean;
  /** Short rain status: “76% rain”, “Raining”, etc. */
  rainLabel: string;
  windKph: number;
  uvIndex: number;
  weatherCode: number;
  description: string;
  condition: RunCondition;
  bestRunWindow: string;
  isMonsoon: boolean;
  fetchedAt: number;
  lat: number;
  lng: number;
}

export interface UseWeatherOptions {
  city: City;
  /** Forecast location — defaults to city center */
  at?: Coordinate;
  /** Cache key — use route id when fetching at route start */
  cacheKey?: string;
}

type CityThresholds = Pick<City, 'heatWarningAboveC' | 'coldWarningBelowC' | 'monsoonMonths'>;

// ─── WMO weather code → description ──────────────────────────────────────────

/** Open-Meteo returns local times without a Z suffix — parse hour directly. */
function hourFromApiTime(isoLocal: string): number {
  return parseInt(isoLocal.slice(11, 13), 10);
}

function isRainCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 99);
}

function isRainingNow(code: number, precipMm: number): boolean {
  return precipMm > 0.05 || isRainCode(code);
}

function runWindowForHour(localHour: number): { start: number; end: number } {
  if (localHour < 12) {
    return { start: 5, end: 10 };
  }
  if (localHour < 17) {
    return { start: localHour, end: Math.min(localHour + 3, 16) };
  }
  return { start: 17, end: 21 };
}

/** e.g. "5–10am", "5–9pm" — same style as Apple Weather hourly context */
function formatRunWindow(start: number, end: number): string {
  const h12 = (h: number) => h % 12 || 12;
  const suffix = (h: number) => (h < 12 ? 'am' : 'pm');
  if (start === end) return `${h12(start)}${suffix(start)}`;
  if (suffix(start) === suffix(end)) {
    return `${h12(start)}–${h12(end)}${suffix(start)}`;
  }
  return `${h12(start)}${suffix(start)}–${h12(end)}${suffix(end)}`;
}

function maxPrecipChanceInWindow(hourly: HourlySlice[], start: number, end: number): number {
  const slice = hourly.filter(h => h.hour >= start && h.hour <= end);
  if (!slice.length) return 0;
  return Math.max(...slice.map(h => h.precipPct));
}

/**
 * Chance-of-precip wording (like Apple Weather / Weather Channel), not “% rain”
 * which sounds like it’s raining right now.
 */
function buildRainLabel(
  rainingNow: boolean,
  precipMm: number,
  runChancePct: number,
  windowStart: number,
  windowEnd: number,
): string {
  if (rainingNow) {
    if (precipMm >= 2) return 'Raining now';
    if (precipMm > 0.05) return 'Light rain now';
    return 'Rain nearby';
  }
  const window = formatRunWindow(windowStart, windowEnd);
  if (runChancePct < 10) return `Dry · ${window}`;
  return `${Math.round(runChancePct)}% chance · ${window}`;
}

function describeCode(code: number): string {
  if (code === 0)           return 'Clear sky';
  if (code <= 3)            return 'Partly cloudy';
  if (code <= 48)           return 'Foggy';
  if (code <= 55)           return 'Light drizzle';
  if (code <= 65)           return 'Rain';
  if (code <= 67)           return 'Freezing rain';
  if (code <= 77)           return 'Snow';
  if (code <= 82)           return 'Rain showers';
  if (code <= 86)           return 'Snow showers';
  if (code <= 99)           return 'Thunderstorm';
  return 'Unknown';
}

function scoreCondition(
  tempC: number,
  precipPct: number,
  windKph: number,
  uvIndex: number,
  city: CityThresholds,
): RunCondition {
  const tempOk = tempC >= city.coldWarningBelowC && tempC <= city.heatWarningAboveC;
  const tempWarm = tempC > city.heatWarningAboveC && tempC <= city.heatWarningAboveC + 6;
  const precipOk = precipPct < 25;
  const windOk = windKph < 25;
  const uvOk = uvIndex < 8;

  if (tempOk && precipOk && windOk && uvOk) return 'great';
  if ((tempOk || tempWarm) && precipOk && windOk) return 'good';
  if (precipPct < 60 && windKph < 40) return 'fair';
  return 'tough';
}

function findBestWindow(hourly: HourlySlice[]): string {
  const candidates = hourly.filter(
    h => (h.hour >= 5 && h.hour <= 9) || (h.hour >= 18 && h.hour <= 21),
  );
  if (candidates.length === 0) return 'Check conditions before heading out';

  const ranked = [...candidates].sort((a, b) => {
    const order: Record<RunCondition, number> = { great: 0, good: 1, fair: 2, tough: 3 };
    if (order[a.condition] !== order[b.condition]) {
      return order[a.condition] - order[b.condition];
    }
    return a.precipPct - b.precipPct;
  });

  const best = ranked[0];
  const endHour = best.hour + 2;
  const period = best.hour < 12 ? 'AM' : 'PM';
  const h12 = best.hour % 12 || 12;
  const h12end = endHour % 12 || 12;
  const endPeriod = endHour < 12 ? 'AM' : endHour < 24 && endHour >= 12 ? 'PM' : 'AM';
  return `Best: ${h12} – ${h12end} ${period === endPeriod ? period : `${period}/${endPeriod}`}`;
}

/** Query params shared by single + batched forecast requests. */
function forecastParamFields() {
  return {
    current: [
      'temperature_2m',
      'apparent_temperature',
      'precipitation',
      'precipitation_probability',
      'wind_speed_10m',
      'uv_index',
      'weather_code',
    ].join(','),
    hourly: [
      'temperature_2m',
      'precipitation',
      'precipitation_probability',
      'wind_speed_10m',
      'uv_index',
      'weather_code',
    ].join(','),
    forecast_days: '1',
  };
}

/**
 * Turn one Open-Meteo forecast object into our WeatherData.
 * Pure — shared by the single-location hook and the batched route hook.
 */
export function parseForecast(
  data: any,
  city: CityThresholds & Pick<City, 'monsoonMonths'>,
  lat: number,
  lng: number,
): WeatherData {
  const c = data.current;
  const h = data.hourly;
  const times = h.time as string[];
  const currentTime = c.time as string;
  const currentHour = hourFromApiTime(currentTime);
  const currentMonth = parseInt(currentTime.slice(5, 7), 10);

  const hourly: HourlySlice[] = times.map((t: string, i: number) => {
    const hour = hourFromApiTime(t);
    const tempC = h.temperature_2m[i] as number;
    const precipPct = (h.precipitation_probability[i] as number) ?? 0;
    const windKph = h.wind_speed_10m[i] as number;
    const uvIndex = h.uv_index[i] as number;
    return {
      hour,
      tempC,
      precipPct,
      condition: scoreCondition(tempC, precipPct, windKph, uvIndex, city),
    };
  });

  const tempC = c.temperature_2m as number;
  const feelsLikeC = c.apparent_temperature as number;
  const precipMm = (c.precipitation as number) ?? 0;
  const windKph = c.wind_speed_10m as number;
  const uvIndex = c.uv_index as number;
  const weatherCode = c.weather_code as number;
  const rainingNow = isRainingNow(weatherCode, precipMm);

  const runWindow = runWindowForHour(currentHour);
  const runChancePct = maxPrecipChanceInWindow(hourly, runWindow.start, runWindow.end);
  const precipPct = rainingNow ? Math.max(runChancePct, 80) : runChancePct;
  const rainLabel = buildRainLabel(
    rainingNow,
    precipMm,
    runChancePct,
    runWindow.start,
    runWindow.end,
  );

  const isMonsoon = !!city.monsoonMonths?.includes(currentMonth);

  return {
    tempC,
    feelsLikeC,
    precipPct,
    precipMm,
    rainingNow,
    rainLabel,
    windKph,
    uvIndex,
    weatherCode,
    description: describeCode(weatherCode),
    condition: scoreCondition(tempC, precipPct, windKph, uvIndex, city),
    bestRunWindow: findBestWindow(hourly),
    isMonsoon,
    fetchedAt: Date.now(),
    lat,
    lng,
  };
}

function cacheKeyFor(city: City, at?: Coordinate, cacheKey?: string): string {
  if (cacheKey) return cacheKey;
  if (at) {
    return `${city.id}:${at.lat.toFixed(3)},${at.lng.toFixed(3)}`;
  }
  return city.id;
}

const CACHE_MS = 30 * 60 * 1000;
const cache = new Map<string, WeatherData>();

export function useWeather({ city, at, cacheKey }: UseWeatherOptions) {
  const lat = at?.lat ?? city.lat;
  const lng = at?.lng ?? city.lng;
  const key = cacheKeyFor(city, at, cacheKey);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const cached = cache.get(key);
    if (cached?.rainLabel && Date.now() - cached.fetchedAt < CACHE_MS) {
      setWeather(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      timezone: city.timezone,
      ...forecastParamFields(),
    });

    fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: controller.signal,
    })
      .then(r => {
        if (!r.ok) throw new Error(`Weather API error: ${r.status}`);
        return r.json();
      })
      .then(data => {
        const result = parseForecast(data, city, lat, lng);
        cache.set(key, result);
        setWeather(result);
        setLoading(false);
      })
      .catch(err => {
        if ((err as Error).name === 'AbortError') return;
        setError('Could not load weather');
        setLoading(false);
      });

    return () => controller.abort();
  }, [
    key,
    lat,
    lng,
    city.timezone,
    city.heatWarningAboveC,
    city.coldWarningBelowC,
    city.monsoonMonths,
  ]);

  return { weather, loading, error, atRoute: !!at };
}

// ─── Per-route weather (batched) ──────────────────────────────────────────────

function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

/**
 * Forecast for every route's *start location* in one batched Open-Meteo request
 * (comma-separated coords → array response). Captures real intra-city weather
 * differences — e.g. SF's foggy coast vs. sunny inland. Returns a map keyed by
 * route id. Coordinates are de-duplicated and cached per location.
 */
export function useRouteWeather(city: City, routes: Route[]) {
  const [weatherByRoute, setWeatherByRoute] = useState<Map<string, WeatherData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Stable signature so the effect only re-runs when the route set/city changes.
  const signature = routes
    .map(r => `${r.id}@${coordKey(r.startLocation.lat, r.startLocation.lng)}`)
    .join('|');

  useEffect(() => {
    if (routes.length === 0) {
      setWeatherByRoute(new Map());
      setLoading(false);
      return;
    }

    // Build the map from cache and figure out which unique coords still need fetching.
    const next = new Map<string, WeatherData>();
    const missing = new Map<string, Coordinate>(); // coordKey -> coord
    for (const r of routes) {
      const ck = coordKey(r.startLocation.lat, r.startLocation.lng);
      const cached = cache.get(ck);
      if (cached?.rainLabel && Date.now() - cached.fetchedAt < CACHE_MS) {
        next.set(r.id, cached);
      } else if (!missing.has(ck)) {
        missing.set(ck, r.startLocation);
      }
    }

    if (missing.size === 0) {
      setWeatherByRoute(next);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const coords = [...missing.values()];
    const params = new URLSearchParams({
      latitude: coords.map(c => c.lat.toFixed(4)).join(','),
      longitude: coords.map(c => c.lng.toFixed(4)).join(','),
      timezone: city.timezone,
      ...forecastParamFields(),
    });

    fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`Weather API error: ${r.status}`);
        return r.json();
      })
      .then(data => {
        // Open-Meteo returns an array for multiple coords, an object for one.
        const list = Array.isArray(data) ? data : [data];
        list.forEach((entry, i) => {
          const coord = coords[i];
          if (!coord) return;
          const parsed = parseForecast(entry, city, coord.lat, coord.lng);
          cache.set(coordKey(coord.lat, coord.lng), parsed);
        });
        const merged = new Map<string, WeatherData>();
        for (const r of routes) {
          const w = cache.get(coordKey(r.startLocation.lat, r.startLocation.lng));
          if (w) merged.set(r.id, w);
        }
        setWeatherByRoute(merged);
        setLoading(false);
      })
      .catch(err => {
        if ((err as Error).name === 'AbortError') return;
        setError('Could not load weather');
        setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, city.timezone, city.heatWarningAboveC, city.coldWarningBelowC, city.monsoonMonths]);

  return { weatherByRoute, loading, error };
}
