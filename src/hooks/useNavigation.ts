import { useRef, useEffect, useCallback, useMemo } from 'react';
import { Coordinate } from '../data/types';
import { paceAdjustedTriggerDistance } from '../utils/geo';
import {
  buildNavCues,
  snapToRoute,
  type NavCue,
  type NavNudge,
} from '../utils/navigation';

interface UseNavigationOptions {
  position: Coordinate | null;
  routeCoords: Coordinate[];
  active: boolean;
  pacingSecPerM: number | null;
  canSpeak: () => boolean;
  onNudge: (nudge: NavNudge) => void;
}

const DEFAULT_PACE_SEC_PER_M = 0.335;
const TRIGGER_BASE_M = 32;
const NUDGE_DURATION_SEC = 2.5;
const OFF_ROUTE_M = 45;
const ON_ROUTE_M = 28;
const OFF_ROUTE_COOLDOWN_MS = 90_000;

export function useNavigation({
  position,
  routeCoords,
  active,
  pacingSecPerM,
  canSpeak,
  onNudge,
}: UseNavigationOptions) {
  const cues = useMemo(() => buildNavCues(routeCoords), [routeCoords]);
  const playedRef = useRef<Set<string>>(new Set());
  const offRouteRef = useRef(false);
  const lastOffRouteAt = useRef(0);
  const onNudgeRef = useRef(onNudge);
  const canSpeakRef = useRef(canSpeak);
  onNudgeRef.current = onNudge;
  canSpeakRef.current = canSpeak;

  const reset = useCallback(() => {
    playedRef.current = new Set();
    offRouteRef.current = false;
    lastOffRouteAt.current = 0;
  }, []);

  useEffect(() => {
    if (!active || !position || routeCoords.length < 2) return;

    const snap = snapToRoute(position, routeCoords);
    const pace = pacingSecPerM ?? DEFAULT_PACE_SEC_PER_M;

    if (snap.distanceToRouteM > OFF_ROUTE_M) {
      if (!offRouteRef.current && canSpeakRef.current()) {
        const now = Date.now();
        if (now - lastOffRouteAt.current >= OFF_ROUTE_COOLDOWN_MS) {
          offRouteRef.current = true;
          lastOffRouteAt.current = now;
          onNudgeRef.current({ type: 'off_route', message: "You're off the route" });
        }
      }
    } else if (snap.distanceToRouteM < ON_ROUTE_M) {
      offRouteRef.current = false;
    }

    const triggerM = paceAdjustedTriggerDistance(
      TRIGGER_BASE_M,
      NUDGE_DURATION_SEC,
      pace,
    );

    for (const cue of cues) {
      if (playedRef.current.has(cue.id)) continue;

      const distToCueM = cue.distanceAlongM - snap.distanceAlongM;

      if (distToCueM < -15) {
        playedRef.current.add(cue.id);
        continue;
      }

      if (distToCueM <= triggerM && distToCueM >= -5) {
        if (!canSpeakRef.current()) break;
        playedRef.current.add(cue.id);
        onNudgeRef.current({ type: 'turn', message: cue.message, cue });
        break;
      }
    }
  }, [active, position, routeCoords, cues, pacingSecPerM]);

  return {
    reset,
    cueCount: cues.length,
    onRoute: position
      ? snapToRoute(position, routeCoords).distanceToRouteM <= OFF_ROUTE_M
      : true,
  };
}

export type { NavCue, NavNudge };
