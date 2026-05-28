import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { Coordinate } from '../data/types';
import { distanceMetres } from '../utils/geo';

const PACE_WINDOW_SEC = 30; // rolling window for pace calculation
const MIN_ACCURACY_M = 20;  // ignore readings worse than this

interface GPSState {
  position: Coordinate | null;
  accuracyM: number | null;
  distanceCoveredM: number;
  pacingSecPerM: number | null; // null until enough data
  hasPermission: boolean;
  error: string | null;
}

interface PositionSample {
  position: Coordinate;
  timestamp: number; // ms
  distanceSoFarM: number;
}

export function useGPS(active: boolean) {
  const [state, setState] = useState<GPSState>({
    position: null,
    accuracyM: null,
    distanceCoveredM: 0,
    pacingSecPerM: null,
    hasPermission: false,
    error: null,
  });

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastPositionRef = useRef<Coordinate | null>(null);
  const totalDistanceRef = useRef(0);
  const samplesRef = useRef<PositionSample[]>([]);

  const requestPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setState(s => ({ ...s, error: 'Location permission denied', hasPermission: false }));
      return false;
    }
    setState(s => ({ ...s, hasPermission: true, error: null }));
    return true;
  }, []);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    if (!active || !state.hasPermission) {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      return;
    }

    let mounted = true;

    (async () => {
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 5, // update every 5 metres
        },
        (loc) => {
          if (!mounted) return;
          if (loc.coords.accuracy && loc.coords.accuracy > MIN_ACCURACY_M) return;

          const newPos: Coordinate = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          };
          const now = loc.timestamp;

          // Accumulate distance
          if (lastPositionRef.current) {
            const delta = distanceMetres(lastPositionRef.current, newPos);
            // Filter out GPS jumps (> 30m/s = 108 km/h)
            if (delta / 2 < 30) {
              totalDistanceRef.current += delta;
            }
          }
          lastPositionRef.current = newPos;

          // Rolling pace calculation
          const sample: PositionSample = {
            position: newPos,
            timestamp: now,
            distanceSoFarM: totalDistanceRef.current,
          };
          samplesRef.current.push(sample);

          // Keep only samples within the rolling window
          const cutoff = now - PACE_WINDOW_SEC * 1000;
          samplesRef.current = samplesRef.current.filter(s => s.timestamp >= cutoff);

          let pacingSecPerM: number | null = null;
          if (samplesRef.current.length >= 2) {
            const oldest = samplesRef.current[0];
            const newest = samplesRef.current[samplesRef.current.length - 1];
            const deltaM = newest.distanceSoFarM - oldest.distanceSoFarM;
            const deltaSec = (newest.timestamp - oldest.timestamp) / 1000;
            if (deltaM > 5) {
              pacingSecPerM = deltaSec / deltaM;
            }
          }

          setState(s => ({
            ...s,
            position: newPos,
            accuracyM: loc.coords.accuracy ?? null,
            distanceCoveredM: totalDistanceRef.current,
            pacingSecPerM,
          }));
        },
      );
    })();

    return () => {
      mounted = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [active, state.hasPermission]);

  const reset = useCallback(() => {
    totalDistanceRef.current = 0;
    lastPositionRef.current = null;
    samplesRef.current = [];
    setState(s => ({ ...s, distanceCoveredM: 0, pacingSecPerM: null }));
  }, []);

  return { ...state, reset };
}
