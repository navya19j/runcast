import { useSyncExternalStore } from 'react';
import { Mode } from '../data/types';
import {
  getSnapshot,
  subscribe,
  getRouteRating,
  getAudioRating,
  setRouteRating,
  setAudioRating,
} from '../utils/ratingsStore';

/**
 * Subscribe to the on-device ratings store. Re-renders when any rating changes
 * (e.g. saved on the run-complete screen, reflected on the route detail screen).
 */
export function useRatings() {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    routeRating: (routeId: string) => getRouteRating(routeId),
    audioRating: (routeId: string, mode: Mode) => getAudioRating(routeId, mode),
    rateRoute: setRouteRating,
    rateAudio: setAudioRating,
  };
}
