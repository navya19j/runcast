import React, { useMemo } from 'react';
import { Polyline } from 'react-native-maps';
import { Route } from '../data/types';

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

export type RouteMapFocus = 'solo' | 'ghost';

interface Props {
  route: Route;
  focus: RouteMapFocus;
}

function RouteOverlay({ route, focus }: Props) {
  const lineCoords = useMemo(
    () => route.coordinates.map(c => ({ latitude: c.lat, longitude: c.lng })),
    [route.coordinates],
  );

  const isSolo = focus === 'solo';

  return (
    <Polyline
      coordinates={lineCoords}
      strokeColor={isSolo ? AMBER : ghostColorForRoute(route.id)}
      strokeWidth={isSolo ? 5 : 2}
      lineCap="round"
      lineJoin="round"
      tappable={false}
    />
  );
}

export default React.memo(RouteOverlay);
