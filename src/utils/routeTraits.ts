import { City, cityHasMonsoon, resolveMonsoonSafe } from '../data/cities';
import { Route } from '../data/types';

export type RouteTraitTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface RouteTrait {
  label: string;
  tone: RouteTraitTone;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Scannable route facts — paved, water, solo safety, monsoon (monsoon cities only), etc. */
export function routeTraits(route: Route, city?: City): RouteTrait[] {
  const traits: RouteTrait[] = [];
  const includeMonsoon = city ? cityHasMonsoon(city) : false;
  const monsoonSafe = city ? resolveMonsoonSafe(route, city) : route.monsoonSafe;

  if (route.surface) {
    traits.push({ label: cap(route.surface), tone: 'neutral' });
  }
  if (route.gradientCharacter) {
    const g = route.gradientCharacter.toLowerCase();
    if (g.includes('flat')) traits.push({ label: 'Flat', tone: 'neutral' });
  }
  if (route.waterOnRoute === true) {
    traits.push({ label: 'Water on route', tone: 'good' });
  } else if (route.waterOnRoute === false) {
    traits.push({ label: 'Bring water', tone: 'warn' });
  }
  if (route.soloFemaleSafe === true) {
    traits.push({ label: 'Solo safe', tone: 'good' });
  } else if (route.soloFemaleSafe === false) {
    traits.push({ label: 'Go with company', tone: 'bad' });
  }
  if (includeMonsoon) {
    if (monsoonSafe === true) {
      traits.push({ label: 'Monsoon ok', tone: 'good' });
    } else if (monsoonSafe === false) {
      traits.push({ label: 'Avoid monsoon', tone: 'bad' });
    }
  }
  if (route.headphonesSafe === false) {
    traits.push({ label: 'Stay alert', tone: 'warn' });
  }
  if (route.lighting === 'fully lit') {
    traits.push({ label: 'Lit at night', tone: 'good' });
  } else if (route.lighting === 'partial') {
    traits.push({ label: 'Partly lit', tone: 'warn' });
  } else if (route.lighting === 'none') {
    traits.push({ label: 'Dark at night', tone: 'bad' });
  }
  if (route.restroomsOnRoute === true) {
    traits.push({ label: 'Restrooms', tone: 'good' });
  }

  return traits;
}
