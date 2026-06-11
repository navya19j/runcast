import AsyncStorage from '@react-native-async-storage/async-storage';
import { Mode } from '../data/types';

/**
 * Tiny local ratings store. The app has no backend, so a runner's route/audio
 * ratings live on-device. Backed by AsyncStorage, exposed through an external
 * store so any screen can read/subscribe via `useSyncExternalStore`.
 */

const KEY = 'runcast:ratings:v1';

export interface RatingsState {
  /** routeId -> 1..5 */
  routes: Record<string, number>;
  /** `${routeId}:${mode}` -> 1..5 */
  audio: Record<string, number>;
}

let state: RatingsState = { routes: {}, audio: {} };
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {
    /* best-effort; ratings are non-critical */
  });
}

async function load() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RatingsState>;
      state = {
        routes: parsed.routes ?? {},
        audio: parsed.audio ?? {},
      };
    }
  } catch {
    /* corrupt/missing — start empty */
  } finally {
    loaded = true;
    emit();
  }
}

// Kick off the load once at import time.
void load();

export function audioKey(routeId: string, mode: Mode): string {
  return `${routeId}:${mode}`;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSnapshot(): RatingsState {
  return state;
}

export function isLoaded(): boolean {
  return loaded;
}

export function setRouteRating(routeId: string, stars: number) {
  state = { ...state, routes: { ...state.routes, [routeId]: stars } };
  persist();
  emit();
}

export function setAudioRating(routeId: string, mode: Mode, stars: number) {
  state = { ...state, audio: { ...state.audio, [audioKey(routeId, mode)]: stars } };
  persist();
  emit();
}

export function getRouteRating(routeId: string): number | undefined {
  return state.routes[routeId];
}

export function getAudioRating(routeId: string, mode: Mode): number | undefined {
  return state.audio[audioKey(routeId, mode)];
}
