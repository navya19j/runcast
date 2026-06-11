/**
 * useGPS
 * ──────
 * Manages GPS tracking for an active run.
 *
 * Permission model:
 *   1. Requests foreground permission on first mount.
 *   2. When `active` becomes true, upgrades to background permission so the
 *      app can keep tracking when the phone screen turns off mid-run.
 *
 * Location sources (layered for reliability):
 *   - Foreground: `watchPositionAsync` — lowest latency, used when app is visible.
 *   - Background: `startLocationUpdatesAsync` with a TaskManager task — fires
 *     even when the OS suspends the UI. Events bridge back via `locationEmitter`.
 *
 * Both paths feed the same `handleLocation` function so distance and pace
 * calculations are identical regardless of whether the app is foregrounded.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Coordinate } from '../data/types';
import { distanceMetres } from '../utils/geo';
import {
  BACKGROUND_LOCATION_TASK,
  locationEmitter,
} from '../tasks/backgroundLocation';

const PACE_WINDOW_SEC = 30;    // rolling window for pace calculation
const MIN_ACCURACY_M  = 20;    // ignore readings noisier than this
const MAX_SPEED_MS    = 12;    // ~43 km/h — filter GPS jumps above this

interface GPSState {
  position:          Coordinate | null;
  accuracyM:         number | null;
  distanceCoveredM:  number;
  pacingSecPerM:     number | null;  // null until enough data
  hasPermission:     boolean;
  hasBackground:     boolean;        // whether background permission is granted
  error:             string | null;
}

interface PositionSample {
  position:       Coordinate;
  timestamp:      number;  // ms
  distanceSoFarM: number;
}

export function useGPS(active: boolean) {
  const [state, setState] = useState<GPSState>({
    position:         null,
    accuracyM:        null,
    distanceCoveredM: 0,
    pacingSecPerM:    null,
    hasPermission:    false,
    hasBackground:    false,
    error:            null,
  });

  const fgSubscriptionRef  = useRef<Location.LocationSubscription | null>(null);
  const lastPositionRef    = useRef<Coordinate | null>(null);
  const totalDistanceRef   = useRef(0);
  const samplesRef         = useRef<PositionSample[]>([]);

  // ── Process a raw location update (shared by fg + bg paths) ──────────────
  const handleLocation = useCallback((loc: Location.LocationObject) => {
    if (loc.coords.accuracy && loc.coords.accuracy > MIN_ACCURACY_M) return;

    const newPos: Coordinate = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
    };
    const now = loc.timestamp;

    // Accumulate distance — filter out GPS jumps
    if (lastPositionRef.current) {
      const delta     = distanceMetres(lastPositionRef.current, newPos);
      const elapsed   = 2;  // roughly 2 s between fixes
      const speedMs   = delta / elapsed;
      if (speedMs < MAX_SPEED_MS) {
        totalDistanceRef.current += delta;
      }
    }
    lastPositionRef.current = newPos;

    // Rolling pace window
    const sample: PositionSample = {
      position:       newPos,
      timestamp:      now,
      distanceSoFarM: totalDistanceRef.current,
    };
    samplesRef.current.push(sample);

    const cutoff = now - PACE_WINDOW_SEC * 1000;
    samplesRef.current = samplesRef.current.filter(s => s.timestamp >= cutoff);

    let pacingSecPerM: number | null = null;
    if (samplesRef.current.length >= 2) {
      const oldest  = samplesRef.current[0];
      const newest  = samplesRef.current[samplesRef.current.length - 1];
      const deltaM  = newest.distanceSoFarM - oldest.distanceSoFarM;
      const deltaSec = (newest.timestamp - oldest.timestamp) / 1000;
      if (deltaM > 5) pacingSecPerM = deltaSec / deltaM;
    }

    setState(s => ({
      ...s,
      position:         newPos,
      accuracyM:        loc.coords.accuracy ?? null,
      distanceCoveredM: totalDistanceRef.current,
      pacingSecPerM,
    }));
  }, []);

  // ── Step 1: Request foreground permission on mount ────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState(s => ({ ...s, error: 'Location permission denied', hasPermission: false }));
        return;
      }
      setState(s => ({ ...s, hasPermission: true, error: null }));
    })();
  }, []);

  // ── Step 2: When run starts, upgrade to background permission ─────────────
  useEffect(() => {
    if (!active || !state.hasPermission) return;

    (async () => {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      const granted = status === 'granted';
      setState(s => ({ ...s, hasBackground: granted }));

      if (!granted) {
        // Background permission denied — foreground-only tracking still works.
        // The app will track while visible but may pause when screen locks.
        console.info('[useGPS] Background permission not granted — foreground only');
      }
    })();
  }, [active, state.hasPermission]);

  // ── Step 3: Start foreground watcher (low-latency, runs while app visible) ─
  useEffect(() => {
    if (!active || !state.hasPermission) {
      fgSubscriptionRef.current?.remove();
      fgSubscriptionRef.current = null;
      return;
    }

    let mounted = true;

    (async () => {
      fgSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy:         Location.Accuracy.BestForNavigation,
          timeInterval:     2000,
          distanceInterval: 5,
        },
        (loc) => { if (mounted) handleLocation(loc); },
      );
    })();

    return () => {
      mounted = false;
      fgSubscriptionRef.current?.remove();
      fgSubscriptionRef.current = null;
    };
  }, [active, state.hasPermission, handleLocation]);

  // ── Step 4: Start background task (survives screen-off / app suspension) ──
  useEffect(() => {
    if (!active || !state.hasBackground) return;

    (async () => {
      // Avoid double-registering
      const already = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
      if (already) return;

      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy:         Location.Accuracy.Balanced,   // less aggressive in bg = better battery
        timeInterval:     5000,                         // 5 s between bg fixes
        distanceInterval: 10,                           // or every 10 m
        foregroundService: {
          notificationTitle:    'RunCast is tracking your run',
          notificationBody:     'Audio commentary is active.',
          notificationColor:    '#F5A623',
        },
        // iOS: allow background location updates
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
      });
    })();

    return () => {
      // Stop the background task when the run ends
      Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
    };
  }, [active, state.hasBackground]);

  // ── Step 5: Bridge background task events → state ─────────────────────────
  useEffect(() => {
    if (!active) return;
    locationEmitter.on(handleLocation);
    return () => { locationEmitter.off(handleLocation); };
  }, [active, handleLocation]);

  // ── Cleanup: stop background task when component unmounts ─────────────────
  useEffect(() => {
    return () => {
      Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
    };
  }, []);

  const reset = useCallback(() => {
    totalDistanceRef.current = 0;
    lastPositionRef.current  = null;
    samplesRef.current       = [];
    setState(s => ({ ...s, distanceCoveredM: 0, pacingSecPerM: null }));
  }, []);

  return { ...state, reset };
}
