import { Coordinate, Route } from '../data/types';

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

/** Closest point on a route polyline — for sim scrubbing / resume auto-walk */
export function closestPointOnRoute(
  position: Coordinate,
  coords: Coordinate[],
): { segIndex: number; t: number; point: Coordinate; distanceAlongM: number } {
  if (coords.length === 0) {
    return { segIndex: 0, t: 0, point: position, distanceAlongM: 0 };
  }
  if (coords.length === 1) {
    return { segIndex: 0, t: 0, point: coords[0], distanceAlongM: 0 };
  }

  const cosLat = Math.cos((position.lat * Math.PI) / 180);
  let best = {
    segIndex: 0,
    t: 0,
    point: coords[0],
    distanceAlongM: 0,
    dist: Infinity,
  };
  let alongM = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = distanceMetres(a, b);
    const bdx = (b.lng - a.lng) * cosLat;
    const bdy = b.lat - a.lat;
    let t = 0;
    const denom = bdx * bdx + bdy * bdy;
    if (denom > 1e-14) {
      const adx = (position.lng - a.lng) * cosLat;
      const ady = position.lat - a.lat;
      t = Math.max(0, Math.min(1, (adx * bdx + ady * bdy) / denom));
    }
    const point = {
      lat: a.lat + t * (b.lat - a.lat),
      lng: a.lng + t * (b.lng - a.lng),
    };
    const d = distanceMetres(position, point);
    if (d < best.dist) {
      best = { segIndex: i, t, point, distanceAlongM: alongM + t * segLen, dist: d };
    }
    alongM += segLen;
  }

  return {
    segIndex: best.segIndex,
    t: best.t,
    point: best.point,
    distanceAlongM: best.distanceAlongM,
  };
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
function perpendicularDistance(p: Coordinate, a: Coordinate, b: Coordinate): number {
  // Scale longitude by cos(lat) so the perpendicular distance is computed in
  // geographic space, not raw degree space.
  const cosLat = Math.cos((a.lat * Math.PI) / 180);
  const dx = (b.lng - a.lng) * cosLat;
  const dy = b.lat - a.lat;
  if (dx === 0 && dy === 0) {
    return Math.hypot((p.lng - a.lng) * cosLat, p.lat - a.lat);
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.lng - a.lng) * cosLat * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy),
    ),
  );
  const px = (a.lng + t * (b.lng - a.lng)) * cosLat;
  const py = a.lat + t * (b.lat - a.lat);
  return Math.hypot(p.lng * cosLat - px, p.lat - py);
}

/** Ramer–Douglas–Peucker — preserves corners unlike stride sampling. */
function rdp(coords: Coordinate[], epsilon: number): Coordinate[] {
  if (coords.length < 3) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  let dmax = 0;
  let idx = 0;
  for (let i = 1; i < coords.length - 1; i++) {
    const d = perpendicularDistance(coords[i], first, last);
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax >= epsilon) {
    const left = rdp(coords.slice(0, idx + 1), epsilon);
    const right = rdp(coords.slice(idx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

/** Bounding region that fits a route — for map camera. */
export function routeRegion(route: Route, padding = 1.45) {
  const lats = route.coordinates.map(c => c.lat);
  const lngs = route.coordinates.map(c => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const longitudeDelta = Math.max((maxLng - minLng) * padding, 0.015);
  // Clamp latitude span to at least half the longitude span so that
  // wide E-W routes (GGP, Ocean Beach, etc.) don't collapse into
  // unreadably thin horizontal slivers on the map.
  const latitudeDelta = Math.max((maxLat - minLat) * padding, longitudeDelta * 0.5, 0.015);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}

/** Downsample for map rendering — shape-aware, avoids cutting across loops. */
export function simplifyForMap(coords: Coordinate[], maxPoints = 96): Coordinate[] {
  if (coords.length <= maxPoints) return coords;
  let epsilon = 0.000008; // ~1 m
  let simplified = rdp(coords, epsilon);
  while (simplified.length > maxPoints && epsilon < 0.0005) {
    epsilon *= 1.8;
    simplified = rdp(coords, epsilon);
  }
  return simplified;
}

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
