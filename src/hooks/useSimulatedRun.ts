/**
 * Walks a route polyline virtually — for testing nav nudges and POI triggers indoors.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Coordinate } from '../data/types';
import { distanceMetres } from '../utils/geo';

const TICK_MS = 1000;
const DEFAULT_SPEED_MPS = 2.8; // ~6 min/km
const OFF_ROUTE_OFFSET_M = 55;

interface SimState {
  position: Coordinate | null;
  distanceCoveredM: number;
  pacingSecPerM: number | null;
}

function bearingDeg(a: Coordinate, b: Coordinate): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function offsetPerpendicular(
  point: Coordinate,
  bearing: number,
  metres: number,
): Coordinate {
  const rad = (bearing + 90) * (Math.PI / 180);
  const dLat = (metres * Math.cos(rad)) / 111_320;
  const dLng =
    (metres * Math.sin(rad)) / (111_320 * Math.cos((point.lat * Math.PI) / 180));
  return { lat: point.lat + dLat, lng: point.lng + dLng };
}

function lerpCoord(a: Coordinate, b: Coordinate, t: number): Coordinate {
  return {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };
}

export function useSimulatedRun(
  coords: Coordinate[],
  active: boolean,
  options?: { speedMps?: number; offRoute?: boolean },
) {
  const [state, setState] = useState<SimState>({
    position: coords[0] ?? null,
    distanceCoveredM: 0,
    pacingSecPerM: null,
  });

  const segIndexRef = useRef(0);
  const segProgressRef = useRef(0);
  const totalDistRef = useRef(0);
  const speed = options?.speedMps ?? DEFAULT_SPEED_MPS;
  const offRoute = options?.offRoute ?? false;

  const reset = useCallback(() => {
    segIndexRef.current = 0;
    segProgressRef.current = 0;
    totalDistRef.current = 0;
    setState({
      position: coords[0] ?? null,
      distanceCoveredM: 0,
      pacingSecPerM: 1 / speed,
    });
  }, [coords, speed]);

  useEffect(() => {
    if (!active || coords.length < 2) return;

    const interval = setInterval(() => {
      const i = segIndexRef.current;
      if (i >= coords.length - 1) return;

      const a = coords[i];
      const b = coords[i + 1];
      const segLen = distanceMetres(a, b);
      if (segLen < 0.1) {
        segIndexRef.current += 1;
        segProgressRef.current = 0;
        return;
      }

      const step = speed * (TICK_MS / 1000);
      let remaining = step + segProgressRef.current * segLen;

      while (remaining > 0 && segIndexRef.current < coords.length - 1) {
        const from = coords[segIndexRef.current];
        const to = coords[segIndexRef.current + 1];
        const len = distanceMetres(from, to);
        if (len < 0.1) {
          segIndexRef.current += 1;
          segProgressRef.current = 0;
          continue;
        }
        if (remaining >= len) {
          totalDistRef.current += len;
          remaining -= len;
          segIndexRef.current += 1;
          segProgressRef.current = 0;
        } else {
          segProgressRef.current = remaining / len;
          totalDistRef.current += remaining;
          remaining = 0;
        }
      }

      const idx = Math.min(segIndexRef.current, coords.length - 2);
      const from = coords[idx];
      const to = coords[idx + 1];
      let position = lerpCoord(from, to, segProgressRef.current);

      if (offRoute) {
        const brg = bearingDeg(from, to);
        position = offsetPerpendicular(position, brg, OFF_ROUTE_OFFSET_M);
      }

      setState({
        position,
        distanceCoveredM: totalDistRef.current,
        pacingSecPerM: 1 / speed,
      });
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [active, coords, speed, offRoute]);

  useEffect(() => {
    if (active) reset();
  }, [active, coords]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, reset };
}
