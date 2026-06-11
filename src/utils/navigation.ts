import { Coordinate } from '../data/types';
import { distanceMetres } from './geo';

export type TurnKind =
  | 'slight_left'
  | 'left'
  | 'sharp_left'
  | 'slight_right'
  | 'right'
  | 'sharp_right';

export interface NavCue {
  id: string;
  location: Coordinate;
  distanceAlongM: number;
  kind: TurnKind;
  message: string;
}

export interface RouteSnap {
  distanceAlongM: number;
  distanceToRouteM: number;
}

export type NavNudge =
  | { type: 'turn'; message: string; cue: NavCue }
  | { type: 'off_route'; message: string };

const MIN_TURN_DEG = 38;
const MIN_CUE_SPACING_M = 75;
const LOOK_POINTS = 4;

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

function turnDeltaDeg(incoming: number, outgoing: number): number {
  let d = outgoing - incoming;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function classifyTurn(deltaDeg: number): TurnKind | null {
  const a = Math.abs(deltaDeg);
  if (a < MIN_TURN_DEG) return null;
  if (deltaDeg < 0) {
    if (a < 55) return 'slight_left';
    if (a < 100) return 'left';
    return 'sharp_left';
  }
  if (a < 55) return 'slight_right';
  if (a < 100) return 'right';
  return 'sharp_right';
}

const TURN_MESSAGES: Record<TurnKind, string> = {
  slight_left: 'Slight left ahead',
  left: 'Turn left ahead',
  sharp_left: 'Sharp left ahead',
  slight_right: 'Slight right ahead',
  right: 'Turn right ahead',
  sharp_right: 'Sharp right ahead',
};

function projectOntoSegment(
  p: Coordinate,
  a: Coordinate,
  b: Coordinate,
): { t: number; distM: number } {
  // Scale longitude differences by cos(lat) so the dot-product projection
  // uses geographic distances rather than raw degrees.  Without this,
  // E-W segments are over-weighted by ~1/cos(lat) ≈ 27% at SF latitude.
  const cosLat = Math.cos((a.lat * Math.PI) / 180);
  const dx = (b.lng - a.lng) * cosLat;
  const dy = b.lat - a.lat;
  if (dx === 0 && dy === 0) {
    return { t: 0, distM: distanceMetres(p, a) };
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.lng - a.lng) * cosLat * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy),
    ),
  );
  const lat = a.lat + t * (b.lat - a.lat);
  const lng = a.lng + t * (b.lng - a.lng);
  return { t, distM: distanceMetres(p, { lat, lng }) };
}

/** Nearest point on the route polyline + distance travelled from the start. */
export function snapToRoute(position: Coordinate, coords: Coordinate[]): RouteSnap {
  if (coords.length < 2) {
    return {
      distanceAlongM: 0,
      distanceToRouteM: distanceMetres(position, coords[0] ?? position),
    };
  }

  let bestDist = Infinity;
  let bestAlong = 0;
  let accumulated = 0;

  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const segLen = distanceMetres(a, b);
    const { t, distM } = projectOntoSegment(position, a, b);
    const along = accumulated + t * segLen;
    if (distM < bestDist) {
      bestDist = distM;
      bestAlong = along;
    }
    accumulated += segLen;
  }

  return { distanceAlongM: bestAlong, distanceToRouteM: bestDist };
}

/** Detect turn cues from a route polyline (smoothed over several points). */
export function buildNavCues(coords: Coordinate[]): NavCue[] {
  if (coords.length < LOOK_POINTS * 2 + 1) return [];

  const raw: NavCue[] = [];

  for (let i = LOOK_POINTS; i < coords.length - LOOK_POINTS; i++) {
    const prev = coords[i - LOOK_POINTS];
    const curr = coords[i];
    const next = coords[i + LOOK_POINTS];

    const incoming = bearingDeg(prev, curr);
    const outgoing = bearingDeg(curr, next);
    const kind = classifyTurn(turnDeltaDeg(incoming, outgoing));
    if (!kind) continue;

    let distAlong = 0;
    for (let j = 1; j <= i; j++) {
      distAlong += distanceMetres(coords[j - 1], coords[j]);
    }

    raw.push({
      id: `turn-${i}`,
      location: curr,
      distanceAlongM: distAlong,
      kind,
      message: TURN_MESSAGES[kind],
    });
  }

  const severity = (k: TurnKind) =>
    k.startsWith('sharp') ? 3 : k.includes('slight') ? 1 : 2;

  const merged: NavCue[] = [];
  for (const cue of raw) {
    const last = merged[merged.length - 1];
    if (last && cue.distanceAlongM - last.distanceAlongM < MIN_CUE_SPACING_M) {
      if (severity(cue.kind) > severity(last.kind)) {
        merged[merged.length - 1] = cue;
      }
      continue;
    }
    merged.push(cue);
  }

  return merged;
}
