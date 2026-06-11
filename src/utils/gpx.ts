import { Route } from '../data/types';

/** Escape the five XML special characters for safe attribute/text content. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Filesystem-safe base name for the exported file, e.g. "marine-drive-loop". */
export function gpxFileName(route: Route): string {
  const slug = route.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || route.id;
  return `${slug}.gpx`;
}

/**
 * Build a GPX 1.1 document for a route. Emits a `<trk>` (course line) plus a
 * `<wpt>` for each POI so Garmin/Strava show the audio stops as course points.
 * The output imports cleanly into Garmin Connect (Courses), Strava (Routes),
 * and any watch app that accepts GPX.
 */
export function buildRouteGpx(route: Route): string {
  const name = xmlEscape(route.name);
  const desc = xmlEscape(route.description ?? '');

  const trkpts = route.coordinates
    .map(c => `<trkpt lat="${c.lat.toFixed(6)}" lon="${c.lng.toFixed(6)}" />`)
    .join('');

  const wpts = route.pois
    .map(p =>
      `<wpt lat="${p.location.lat.toFixed(6)}" lon="${p.location.lng.toFixed(6)}">` +
      `<name>${xmlEscape(p.name)}</name>` +
      `</wpt>`,
    )
    .join('');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<gpx version="1.1" creator="RunCast" xmlns="http://www.topografix.com/GPX/1/1">` +
    `<metadata><name>${name}</name>${desc ? `<desc>${desc}</desc>` : ''}</metadata>` +
    wpts +
    `<trk><name>${name}</name><trkseg>${trkpts}</trkseg></trk>` +
    `</gpx>`
  );
}
