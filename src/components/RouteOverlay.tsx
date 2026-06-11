import React, { useMemo } from 'react';
import { Polyline, Circle } from 'react-native-maps';
import { Route } from '../data/types';
import { simplifyForMap } from '../utils/geo';

const AMBER = '#F5A623';

/** Muted palette so overlapping routes stay distinguishable in overview mode. */
const GHOST_PALETTE = [
  'rgba(147,197,253,0.55)',  // blue
  'rgba(167,243,208,0.55)',  // mint
  'rgba(253,186,116,0.55)',  // peach
  'rgba(196,181,253,0.55)',  // lavender
  'rgba(252,165,165,0.55)',  // rose
  'rgba(103,232,249,0.55)',  // cyan
  'rgba(253,224,71,0.5)',    // gold
  'rgba(134,239,172,0.5)',   // green
];

function ghostColorForRoute(routeId: string): string {
  let hash = 0;
  for (let i = 0; i < routeId.length; i++) {
    hash = (hash + routeId.charCodeAt(i) * (i + 1)) % GHOST_PALETTE.length;
  }
  return GHOST_PALETTE[hash];
}

export type RouteMapFocus = 'solo' | 'ghost' | 'faint';

interface Props {
  route: Route;
  focus: RouteMapFocus;
  /** Downsample path for city overview maps */
  maxPoints?: number;
}

function RouteOverlay({ route, focus, maxPoints }: Props) {
  const lineCoords = useMemo(() => {
    const path = maxPoints
      ? simplifyForMap(route.coordinates, maxPoints)
      : route.coordinates;
    return path.map(c => ({ latitude: c.lat, longitude: c.lng }));
  }, [route.coordinates, maxPoints]);

  const isSolo = focus === 'solo';
  const strokeColor = isSolo
    ? AMBER
    : focus === 'faint'
      ? 'rgba(255,255,255,0.14)'
      : ghostColorForRoute(route.id);
  const strokeWidth = isSolo ? 5 : focus === 'faint' ? 1 : 2.5;

  const start = route.startLocation;
  const end = route.coordinates[route.coordinates.length - 1];

  return (
    <>
      <Polyline
        coordinates={lineCoords}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        lineCap="round"
        lineJoin="round"
        tappable={false}
      />
      {isSolo && (
        <>
          <Circle
            center={{ latitude: start.lat, longitude: start.lng }}
            radius={18}
            fillColor={AMBER}
            strokeColor="#FFFFFF"
            strokeWidth={2}
            zIndex={10}
          />
          {end && (end.lat !== start.lat || end.lng !== start.lng) && (
            <Circle
              center={{ latitude: end.lat, longitude: end.lng }}
              radius={12}
              fillColor="rgba(255,255,255,0.92)"
              strokeColor={AMBER}
              strokeWidth={2}
              zIndex={9}
            />
          )}
        </>
      )}
    </>
  );
}

export default React.memo(RouteOverlay);
