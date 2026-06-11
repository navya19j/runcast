import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Route } from '../data/types';
import { buildRouteGpx, gpxFileName } from './gpx';

export type ExportResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'error' };

/**
 * Write the route's GPX to a cache file and open the native share sheet so the
 * runner can send it to Garmin Connect, Strava, a watch app, Files, AirDrop, etc.
 * GPX is the lingua franca those apps import — no API keys or OAuth needed.
 */
export async function exportRouteGpx(route: Route): Promise<ExportResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, reason: 'unavailable' };
    }

    const file = new File(Paths.cache, gpxFileName(route));
    // Overwrite any stale export of the same route.
    if (file.exists) file.delete();
    file.create();
    file.write(buildRouteGpx(route));

    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/gpx+xml',
      UTI: 'com.topografix.gpx',
      dialogTitle: `Export ${route.name} to your watch`,
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
