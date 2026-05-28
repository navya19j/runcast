import { Coordinate } from '../data/types';

const EARTH_RADIUS_M = 6371000;

/** Haversine distance in metres between two coordinates */
export function distanceMetres(a: Coordinate, b: Coordinate): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Total route distance in metres */
export function routeLengthMetres(coords: Coordinate[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += distanceMetres(coords[i - 1], coords[i]);
  }
  return total;
}

/**
 * Returns how far along a route a position is (0-1).
 * Finds the closest segment on the route.
 */
export function progressAlongRoute(
  position: Coordinate,
  coords: Coordinate[],
): number {
  if (coords.length < 2) return 0;
  let closestIdx = 0;
  let closestDist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = distanceMetres(position, coords[i]);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  }
  const totalLength = routeLengthMetres(coords);
  if (totalLength === 0) return 0;
  const coveredLength = routeLengthMetres(coords.slice(0, closestIdx + 1));
  return Math.min(coveredLength / totalLength, 1);
}

/**
 * Given pace in seconds-per-metre, returns how many metres ahead
 * to trigger a clip so it starts playing just before the runner arrives.
 */
export function paceAdjustedTriggerDistance(
  baseTriggerM: number,
  clipDurationSec: number,
  paceSecPerM: number,
  bufferSec = 3,
): number {
  const timeNeeded = clipDurationSec + bufferSec;
  const distanceNeeded = timeNeeded * paceSecPerM; // metres needed to cover the clip
  return Math.max(baseTriggerM, distanceNeeded);
}
