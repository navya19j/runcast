import * as Location from 'expo-location';
import type { Coordinate } from '../data/types';

const RECENT_MAX_AGE_MS = 10 * 60 * 1000;
const FIX_TIMEOUT_MS = 6000;

export function toCoordinate(pos: Location.LocationObject): Coordinate {
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

/** Prime the OS location cache while the home screen is visible. */
export function warmUpLocation(): void {
  void Location.getForegroundPermissionsAsync().then(({ status }) => {
    if (status !== 'granted') return;
    void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }).catch(() => {});
  });
}

/**
 * Fast fix for picking a start point — last-known first, then balanced/low GPS.
 * Avoids High accuracy, which can take 10–15s on a cold start.
 */
export async function getQuickPosition(): Promise<Location.LocationObject> {
  const recent = await Location.getLastKnownPositionAsync({ maxAge: RECENT_MAX_AGE_MS });
  if (recent) return recent;

  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GPS timeout')), FIX_TIMEOUT_MS),
      ),
    ]);
  } catch {
    const stale = await Location.getLastKnownPositionAsync({
      maxAge: 24 * 60 * 60 * 1000,
    });
    if (stale) return stale;

    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GPS timeout')), FIX_TIMEOUT_MS),
      ),
    ]);
  }
}

/** Refine a coarse fix without blocking the UI. */
export async function refinePosition(
  onUpdate: (pos: Location.LocationObject) => void,
): Promise<void> {
  const pos = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<null>(resolve => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
  ]);
  if (pos) onUpdate(pos);
}
