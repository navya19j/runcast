import { useState, useEffect, useRef } from 'react';
import { City } from '../data/cities';
import { Coordinate } from '../data/types';

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
  precipPct: number;
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
    if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
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
      current: [
        'temperature_2m',
        'apparent_temperature',
        'precipitation_probability',
        'wind_speed_10m',
        'uv_index',
        'weather_code',
      ].join(','),
      hourly: [
        'temperature_2m',
        'precipitation_probability',
        'wind_speed_10m',
        'uv_index',
      ].join(','),
      forecast_days: '1',
    });

    fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: controller.signal,
    })
      .then(r => {
        if (!r.ok) throw new Error(`Weather API error: ${r.status}`);
        return r.json();
      })
      .then(data => {
        const c = data.current;
        const h = data.hourly;
        const currentMonth = new Date().getMonth() + 1;
        const nowHour = new Date().getHours();

        const hourly: HourlySlice[] = (h.time as string[]).map((t: string, i: number) => {
          const hour = new Date(t).getHours();
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
        let precipPct = c.precipitation_probability as number | null;
        if (precipPct == null && h.time) {
          const idx = (h.time as string[]).findIndex((t: string) => new Date(t).getHours() === nowHour);
          if (idx >= 0) precipPct = h.precipitation_probability[idx] as number;
        }
        precipPct = precipPct ?? 0;

        const windKph = c.wind_speed_10m as number;
        const uvIndex = c.uv_index as number;
        const weatherCode = c.weather_code as number;

        const isMonsoon = !!(
          city.monsoonMonths?.includes(currentMonth) && precipPct > 60
        );

        const result: WeatherData = {
          tempC,
          feelsLikeC,
          precipPct,
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
