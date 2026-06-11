import { useState, useEffect } from 'react';
import { Coordinate } from '../data/types';

export interface ElevationPoint {
  distanceKm: number;
  elevationM: number;
}

export interface ElevationData {
  points: ElevationPoint[];
  gainM: number;
  lossM: number;
  maxM: number;
  minM: number;
}

const CACHE = new Map<string, ElevationData>();
const MAX_SAMPLES = 40; // Open-Meteo batch limit is generous; 40 gives good resolution

function downsample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  return Array.from({ length: n }, (_, i) => arr[Math.round(i * (arr.length - 1) / (n - 1))]);
}

function haversineKm(a: Coordinate, b: Coordinate): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function useElevation(coordinates: Coordinate[], routeId: string) {
  const [data, setData]       = useState<ElevationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const cached = CACHE.get(routeId);
    if (cached) { setData(cached); setLoading(false); return; }

    const sampled = downsample(coordinates, MAX_SAMPLES);
    const lats = sampled.map(c => c.lat).join(',');
    const lngs = sampled.map(c => c.lng).join(',');

    // Compute cumulative distances for x-axis
    const distances: number[] = [0];
    for (let i = 1; i < sampled.length; i++) {
      distances.push(distances[i - 1] + haversineKm(sampled[i - 1], sampled[i]));
    }

    fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`)
      .then(r => {
        if (!r.ok) throw new Error(`Elevation API ${r.status}`);
        return r.json();
      })
      .then((json: { elevation: number[] }) => {
        const elevations = json.elevation;
        let gainM = 0, lossM = 0;

        for (let i = 1; i < elevations.length; i++) {
          const diff = elevations[i] - elevations[i - 1];
          if (diff > 0.5) gainM += diff;        // ignore noise < 0.5m
          else if (diff < -0.5) lossM -= diff;
        }

        const result: ElevationData = {
          points: elevations.map((e, i) => ({ distanceKm: distances[i], elevationM: e })),
          gainM:  Math.round(gainM),
          lossM:  Math.round(lossM),
          maxM:   Math.round(Math.max(...elevations)),
          minM:   Math.round(Math.min(...elevations)),
        };

        CACHE.set(routeId, result);
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        setError('Elevation unavailable');
        setLoading(false);
      });
  }, [routeId]);

  return { elevation: data, elevLoading: loading, elevError: error };
}
