import { useRef, useEffect, useCallback } from 'react';
import { Coordinate, POI, Mode } from '../data/types';
import { distanceMetres, paceAdjustedTriggerDistance } from '../utils/geo';

interface UseProximityOptions {
  position: Coordinate | null;
  pois: POI[];
  mode: Mode;
  active: boolean;
  pacingSecPerM: number | null;
  onTrigger: (poi: POI, audioFile: string) => void;
}

// Default pace assumption: 9 min/mile ≈ 5.6 min/km ≈ 0.089 sec/m (inverted: 11.2 m/s — no wait)
// 9 min/mile = 540 sec/mile = 540/1609 sec/m ≈ 0.335 sec/m
const DEFAULT_PACE_SEC_PER_M = 0.335;

export function useProximity({
  position,
  pois,
  mode,
  active,
  pacingSecPerM,
  onTrigger,
}: UseProximityOptions) {
  const playedRef = useRef<Set<string>>(new Set());
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  const reset = useCallback(() => {
    playedRef.current = new Set();
  }, []);

  useEffect(() => {
    if (!active || !position) return;

    const pace = pacingSecPerM ?? DEFAULT_PACE_SEC_PER_M;

    for (const poi of pois) {
      if (playedRef.current.has(poi.id)) continue;

      const clip = poi.clips[mode];
      if (!clip || !clip.audioFile) continue;

      const adjustedTrigger = paceAdjustedTriggerDistance(
        poi.triggerDistanceM,
        clip.durationSec,
        pace,
      );

      const dist = distanceMetres(position, poi.location);

      if (dist <= adjustedTrigger) {
        playedRef.current.add(poi.id);
        onTriggerRef.current(poi, clip.audioFile);
        break; // only trigger one POI per position update
      }
    }
  }, [position, pois, mode, active, pacingSecPerM]);

  return { reset, playedCount: playedRef.current.size };
}
