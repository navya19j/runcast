import { City, cityHasMonsoon, resolveMonsoonSafe } from '../data/cities';
import { Route } from '../data/types';
import { routeShapeLabel } from './routeLabels';

/** One scannable line for list cards */
export function routeListSubtitle(route: Route): string {
  const parts = [`${route.distanceKm} km`, routeShapeLabel(route)];
  if (route.bestTime) {
    const short = route.bestTime.split('—')[0].split('.')[0].trim();
    if (short.length <= 28) parts.push(short);
  }
  return parts.join(' · ');
}

/** Short hook for detail — prefer local tip, else first sentence of description */
export function routeHook(route: Route): string {
  if (route.localTip) {
    const first = route.localTip.split('.')[0].trim();
    return first.endsWith('…') ? first : `${first}.`;
  }
  const desc = route.description.split('.')[0].trim();
  return desc ? `${desc}.` : route.description;
}

/** Short scannable tags for list cards */
export function routeQuickTags(route: Route): string[] {
  const tags: string[] = [];
  if (route.surface) {
    const s = route.surface.toLowerCase();
    tags.push(s.charAt(0).toUpperCase() + s.slice(1));
  }
  if (route.waterOnRoute === true) tags.push('Water');
  if (route.soloFemaleSafe === true) tags.push('Solo ok');
  // monsoon tags omitted — use routeTraits(..., includeMonsoon) with city context
  return tags.slice(0, 4);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trim()}…`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Compact, never-truncated phrasing for the "best time to run" value. */
export function conciseBestTime(raw: string): string {
  const s = raw.toLowerCase();
  const morning = /morning|dawn|sunrise|early/.test(s);
  const evening = /evening|dusk|sunset/.test(s);
  const night = /night/.test(s);
  if (morning && evening) return 'Dawn & dusk';
  if (morning) return 'Mornings';
  if (evening) return 'Evenings';
  if (night) return 'After dark';
  if (/midday|noon|afternoon/.test(s)) return 'Daytime';
  if (/any ?time|all day|anytime/.test(s)) return 'Anytime';
  // Fallback: first 1–2 words, capitalised, never mid-word.
  const words = raw.trim().split(/\s+/).slice(0, 2).join(' ');
  return cap(words);
}

/** Compact phrasing for the gradient/grade value. */
export function conciseGrade(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('flat')) return 'Flat';
  if (s.includes('steep')) return 'Steep';
  if (s.includes('hill')) return 'Hilly';
  if (s.includes('rolling') || s.includes('undulat')) return 'Rolling';
  if (s.includes('gentle') || s.includes('gradual')) return 'Gentle';
  if (s.includes('climb')) return 'Climbs';
  return cap(raw.trim().split(/\s+/)[0]);
}

/** Compact stat cells for the route detail grid */
export function routeSpecGrid(route: Route): { label: string; value: string }[] {
  const specs: { label: string; value: string }[] = [];

  if (route.surface) {
    specs.push({ label: 'Surface', value: cap(route.surface) });
  }
  if (route.gradientCharacter) {
    specs.push({ label: 'Grade', value: conciseGrade(route.gradientCharacter) });
  }
  if (route.elevationGainM !== undefined) {
    specs.push({ label: 'Climb', value: `↑${route.elevationGainM} m` });
  }
  if (route.bestTime) {
    const short = route.bestTime.split('—')[0].split('.')[0].trim();
    specs.push({ label: 'Best time', value: conciseBestTime(short) });
  }
  if (route.shade) {
    specs.push({ label: 'Shade', value: cap(route.shade) });
  }
  if (route.pois.length > 0) {
    specs.push({ label: 'Audio', value: `${route.pois.length} stops` });
  }

  return specs.slice(0, 6);
}

export function routeSafetyPreview(route: Route, city?: City): string {
  const parts: string[] = [];
  if (route.soloFemaleSafe === true) parts.push('Solo safe');
  else if (route.soloFemaleSafe === false) parts.push('Go with company');
  if (route.waterOnRoute === true) parts.push('Water on route');
  else if (route.waterOnRoute === false) parts.push('Bring water');
  const monsoon = city ? resolveMonsoonSafe(route, city) : route.monsoonSafe;
  if (city && cityHasMonsoon(city)) {
    if (monsoon === true) parts.push('Monsoon ok');
    else if (monsoon === false) parts.push('Avoid monsoon');
  }
  if (route.lighting === 'fully lit') parts.push('Lit at night');
  return parts.join(' · ');
}

export function routeLogisticsPreview(route: Route): string {
  const parts: string[] = [];
  if (route.transitToStart) parts.push(truncate(route.transitToStart, 40));
  if (route.postRunFood) parts.push(truncate(route.postRunFood, 36));
  return parts.join(' · ');
}

export function routeLocalPreview(route: Route): string {
  if (route.localTip) return truncate(route.localTip.split('.')[0], 72);
  if (route.historicalHook) return truncate(route.historicalHook.split('.')[0], 72);
  return '';
}

/** Only show warnings that matter before a run */
export function routeRunWarnings(route: Route, city?: City): string[] {
  const warnings: string[] = [];
  if (route.soloFemaleSafe === false) warnings.push('Best at dawn with company');
  if (route.headphonesSafe === false) warnings.push('Skip headphones');
  if (route.heatWarning === 'high') warnings.push('High heat — go early');
  const monsoonSafe = city ? resolveMonsoonSafe(route, city) : route.monsoonSafe;
  if (city && cityHasMonsoon(city) && monsoonSafe === false) {
    warnings.push('Avoid monsoon');
  }
  if (route.lighting === 'none') warnings.push('No lighting after dark');
  return warnings;
}
