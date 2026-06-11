/**
 * Background Location Task
 * ────────────────────────
 * Must be defined at module scope — expo-task-manager requires task definitions
 * to run synchronously when the module is first loaded, before any component
 * mounts. Import this file in App.tsx (before any React code) to register it.
 *
 * When the OS suspends the app mid-run, this task keeps location updates
 * flowing so useGPS can continue updating distance/pace and useProximity
 * can keep firing audio cues.
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

export const BACKGROUND_LOCATION_TASK = 'RUNCAST_BACKGROUND_LOCATION';

// Lightweight subscriber list — avoids an external EventEmitter dependency.
// useGPS registers a handler here; the task fires it for every bg location fix.
type LocationHandler = (loc: Location.LocationObject) => void;
const handlers = new Set<LocationHandler>();

export const locationEmitter = {
  on:  (handler: LocationHandler) => handlers.add(handler),
  off: (handler: LocationHandler) => handlers.delete(handler),
};

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[BackgroundLocation] task error:', error.message);
    return;
  }
  const { locations } = data as { locations: Location.LocationObject[] };
  locations.forEach(loc => handlers.forEach(h => h(loc)));
});
