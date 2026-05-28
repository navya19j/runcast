import { useState, useEffect, useRef } from 'react';
import { City } from '../data/cities';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RunCondition = 'great' | 'good' | 'fair' | 'tough';

export interface HourlySlice {
  hour: number;        // 0-23 local time
  tempC: number;
  precipPct: number;
  condition: RunCondition;
}

export interface WeatherData {
  tempC: number;
  feelsLikeC: number;
  precipPct: number;       // precipitation probability % (next hour)
  windKph: number;
  uvIndex: number;
  weatherCode: number;     // WMO weather code
  description: string;
  condition: RunCondition;
  bestRunWindow: string;   // e.g. "Best: 6 – 8 AM" or "Best: 7 – 9 PM"
  isMonsoon: boolean;
  fetchedAt: number;       // Date.now()
}

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

// ─── Running condition score ──────────────────────────────────────────────────
// City-aware: Mumbai's normal is 28°C, SF's normal is 16°C

function scoreCondition(
  tempC: number,
  precipPct: number,
  windKph: number,
  uvIndex: number,
  city: City,
): RunCondition {
  const tempOk  = tempC >= city.coldWarningBelowC && tempC <= city.heatWarningAboveC;
  const tempWarm = tempC > city.heatWarningAboveC && tempC <= city.heatWarningAboveC + 6;
  const precipOk = precipPct < 25;
  const windOk   = windKph < 25;
  const uvOk     = uvIndex < 8;

  if (tempOk && precipOk && windOk && uvOk)   return 'great';
  if ((tempOk || tempWarm) && precipOk && windOk) return 'good';
  if (precipPct < 60 && windKph < 40)         return 'fair';
  return 'tough';
}

// ─── Find the best 2-hour window to run today ─────────────────────────────────

function findBestWindow(hourly: HourlySlice[], city: City): string {
  // Prefer early morning (5-9) or evening (18-21) — practical running windows
  const candidates = hourly.filter(
    h => (h.hour >= 5 && h.hour <= 9) || (h.hour >= 18 && h.hour <= 21),
  );
  if (candidates.length === 0) return 'Check conditions before heading out';

  const ranked = [...candidates].sort((a, b) => {
    const order: Record<RunCondition, number> = { great: 0, good: 1, fair: 2, tough: 3 };
    if (order[a.condition] !== order[b.condition])
      return order[a.condition] - order[b.condition];
    return a.precipPct - b.precipPct;
  });

  const best = ranked[0];
  const period = best.hour < 12 ? 'AM' : 'PM';
  const h12    = best.hour % 12 || 12;
  const h12end = (best.hour + 2) % 12 || 12;
  const endPeriod = (best.hour + 2) < 12 ? 'AM' : 'PM';
  return `Best: ${h12} – ${h12end} ${period === endPeriod ? endPeriod : period + '/' + endPeriod}`;
}

// ─── Cache — avoid re-fetching within 30 minutes ─────────────────────────────

const CACHE_MS = 30 * 60 * 1000;
const cache = new Map<string, WeatherData>();

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWeather(city: City) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const cached = cache.get(city.id);
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
      latitude:  String(city.lat),
      longitude: String(city.lng),
      timezone:  city.timezone,
      current:   [
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
        const c    = data.current;
        const h    = data.hourly;
        const now  = new Date();
        const currentMonth = now.getMonth() + 1;

        // Build hourly slices for today
        const hourly: HourlySlice[] = (h.time as string[]).map((t: string, i: number) => {
          const hour = new Date(t).getHours();
          const tempC = h.temperature_2m[i] as number;
          const precipPct = h.precipitation_probability[i] as number;
          const windKph = h.wind_speed_10m[i] as number;
          const uvIndex = h.uv_index[i] as number;
          return {
            hour,
            tempC,
            precipPct,
            condition: scoreCondition(tempC, precipPct, windKph, uvIndex, city),
          };
        });

        const tempC       = c.temperature_2m as number;
        const feelsLikeC  = c.apparent_temperature as number;
        const precipPct   = c.precipitation_probability as number;
        const windKph     = c.wind_speed_10m as number;
        const uvIndex     = c.uv_index as number;
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
          condition:   scoreCondition(tempC, precipPct, windKph, uvIndex, city),
          bestRunWindow: findBestWindow(hourly, city),
          isMonsoon,
          fetchedAt: Date.now(),
        };

        cache.set(city.id, result);
        setWeather(result);
        setLoading(false);
      })
      .catch(err => {
        if ((err as Error).name === 'AbortError') return;
        setError('Could not load weather');
        setLoading(false);
      });

    return () => controller.abort();
  }, [city.id]);   // re-fetch only when city changes

  return { weather, loading, error };
}
