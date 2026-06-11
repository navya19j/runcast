import { City, cityHasMonsoon, resolveMonsoonSafe } from '../data/cities';
import { Route } from '../data/types';
import { WeatherData, RunCondition } from '../hooks/useWeather';

export type ConditionRating = 'ideal' | 'good' | 'fair' | 'poor';

export interface RouteCondition {
  rating: ConditionRating;
  /** Short label for the pill, e.g. "Great now" */
  label: string;
  /** One-line "why" tuned to this route + weather, e.g. "Shaded — holds up in the heat" */
  reason: string;
}

const RATING_ORDER: Record<ConditionRating, number> = {
  ideal: 0,
  good: 1,
  fair: 2,
  poor: 3,
};

const LABELS: Record<ConditionRating, string> = {
  ideal: 'Great now',
  good: 'Good now',
  fair: 'Fair now',
  poor: 'Tough now',
};

/** Map the base weather score to our rating scale. */
function baseRating(condition: RunCondition): ConditionRating {
  switch (condition) {
    case 'great': return 'ideal';
    case 'good':  return 'good';
    case 'fair':  return 'fair';
    case 'tough': return 'poor';
  }
}

function step(rating: ConditionRating, delta: number): ConditionRating {
  const order = Object.keys(RATING_ORDER) as ConditionRating[];
  const idx = Math.min(order.length - 1, Math.max(0, RATING_ORDER[rating] + delta));
  return order[idx];
}

/** Numeric rank for sorting — lower is better. */
export function conditionRank(rating: ConditionRating): number {
  return RATING_ORDER[rating];
}

/**
 * Combine this route's *own* live weather with its physical traits (shade, heat
 * exposure, monsoon-safety, lighting) into a single "good to run now" verdict.
 * `weather` is the forecast at the route's start location, so two trails in the
 * same city can score differently (microclimates) and differently again once
 * their shade/exposure is taken into account.
 */
export function scoreRouteConditions(
  route: Route,
  city: City,
  weather: WeatherData | null,
): RouteCondition {
  if (!weather) {
    return { rating: 'good', label: '—', reason: '' };
  }

  let rating = baseRating(weather.condition);
  let reason = '';

  const hot = weather.tempC > city.heatWarningAboveC;
  const hotIsh = weather.tempC > city.heatWarningAboveC - 3;
  const highUv = weather.uvIndex >= 8;
  const rainLikely = weather.rainingNow || weather.precipPct >= 50;
  const monsoonSafe = resolveMonsoonSafe(route, city);

  // ── Rain / monsoon dominates the verdict ──────────────────────────────────
  if (weather.isMonsoon && cityHasMonsoon(city)) {
    if (monsoonSafe === true) {
      rating = step(rating, -1);
      reason = 'Paved promenade — holds up in the monsoon';
    } else if (monsoonSafe === false) {
      rating = step(rating, 2);
      reason = 'Gets messy and slippery in the monsoon';
    }
  } else if (rainLikely) {
    if (route.surface && /paved|promenade|boardwalk|track/i.test(route.surface)) {
      reason = reason || 'Paved — fine if it drizzles';
    } else {
      rating = step(rating, 1);
      reason = 'Could get muddy if the rain lands';
    }
  }

  // ── Heat / sun exposure, weighted by shade ────────────────────────────────
  if (!reason && (hot || (hotIsh && highUv))) {
    if (route.shade === 'good') {
      reason = 'Shaded — holds up in the heat';
    } else if (route.shade === 'none' || route.heatWarning === 'high') {
      rating = step(rating, hot ? 2 : 1);
      reason = hot ? 'Exposed — hot and sunny right now' : 'Little shade for this sun';
    } else {
      rating = step(rating, 1);
      reason = 'Warm out — carry water';
    }
  }

  // ── Wind / cold (minor) ───────────────────────────────────────────────────
  if (!reason && weather.windKph >= 35) {
    rating = step(rating, 1);
    reason = 'Windy along the front right now';
  }
  if (!reason && weather.tempC < city.coldWarningBelowC) {
    reason = 'Crisp — layer up before you head out';
  }

  // ── Fallbacks keyed to the rating ─────────────────────────────────────────
  if (!reason) {
    if (rating === 'ideal') reason = `Clear skies · ${Math.round(weather.tempC)}°`;
    else if (rating === 'good') reason = `Decent conditions · ${Math.round(weather.tempC)}°`;
    else reason = weather.rainLabel;
  }

  return { rating, label: LABELS[rating], reason };
}
