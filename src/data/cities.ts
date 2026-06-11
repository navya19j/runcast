import { Route } from './types';
import SF_EMBARCADERO_ROUTE from './routes/sf_embarcadero';
import MUMBAI_BANDRA_WATERFRONT, {
  MUMBAI_COASTAL_PROMENADE,
} from './routes/mumbai_bandra_waterfront';
import {
  SF_GG_PARK_LAP,
  SF_OCEAN_BEACH,
  SF_BATTERIES_TO_BLUFFS,
  SF_CRISSY_TO_BAKER,
  SF_BERNAL_HEIGHTS,
  SF_LANDS_END,
  SF_GLEN_CANYON_TWIN_PEAKS,
  MUMBAI_MARINE_DRIVE,
  MUMBAI_POWAI_LAKE,
  MUMBAI_SHIVAJI_PARK,
  MUMBAI_WORLI_SEAFACE,
  MUMBAI_PRIYADARSHINI_PARK,
} from './routes/curated';
import {
  MUMBAI_BANDRA_WORLI_COASTAL,
  MUMBAI_JUHU_BEACH,
  MUMBAI_DANDA_VERSOVA,
  MUMBAI_MAHALAXMI_RACECOURSE,
} from './routes/mumbai_extended';
import {
  SF_ANGEL_ISLAND,
  SF_ATTPARK_VISTA,
  SF_CRISSY_FORT_POINT,
  SF_BRIDGE_LANDS_END,
  SF_PRESIDIO_GG_LOOP,
  SF_THE_PRESIDIO,
  SF_CANDLESTICK_MCLAREN,
  MUMBAI_PALM_BEACH_NAVI,
  MUMBAI_RAJIV_GANDHI_JOGGERS,
} from './routes/expansion';

export interface City {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
  mapRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  routes: Route[];
  /** Editorial picks — shown first on the home screen */
  recommendedRouteIds?: string[];
  /** Paved waterfront routes — named in monsoon weather hints */
  monsoonPromenadeRouteIds?: string[];
  // Running context hints shown in weather card
  heatWarningAboveC: number;   // city-specific heat threshold
  coldWarningBelowC: number;
  monsoonMonths?: number[];    // months (1-12) with heavy rain risk
}

export function cityHasMonsoon(city: City): boolean {
  return (city.monsoonMonths?.length ?? 0) > 0;
}

/** Paved promenade list wins over per-route flags for monsoon guidance */
export function resolveMonsoonSafe(
  route: Route,
  city: City,
): boolean | undefined {
  if (!cityHasMonsoon(city)) return undefined;
  if (city.monsoonPromenadeRouteIds?.includes(route.id)) return true;
  return route.monsoonSafe;
}

export const CITIES: City[] = [
  {
    id: 'san_francisco',
    name: 'San Francisco',
    country: 'US',
    lat: 37.7749,
    lng: -122.4194,
    timezone: 'America/Los_Angeles',
    mapRegion: {
      latitude: 37.796,
      longitude: -122.405,
      latitudeDelta: 0.065,
      longitudeDelta: 0.065,
    },
    routes: [
      SF_EMBARCADERO_ROUTE,
      SF_GG_PARK_LAP,
      SF_OCEAN_BEACH,
      SF_BATTERIES_TO_BLUFFS,
      SF_CRISSY_TO_BAKER,
      SF_BERNAL_HEIGHTS,
      SF_LANDS_END,
      SF_GLEN_CANYON_TWIN_PEAKS,
      SF_ANGEL_ISLAND,
      SF_ATTPARK_VISTA,
      SF_CRISSY_FORT_POINT,
      SF_BRIDGE_LANDS_END,
      SF_PRESIDIO_GG_LOOP,
      SF_THE_PRESIDIO,
      SF_CANDLESTICK_MCLAREN,
    ],
    recommendedRouteIds: [
      'sf_embarcadero_loop',
      'sf_gg_park_big_lap',
      'sf_lands_end',
      'sf_batteries_to_bluffs',
    ],
    heatWarningAboveC: 26,
    coldWarningBelowC: 8,
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    country: 'IN',
    lat: 19.076,
    lng: 72.877,
    timezone: 'Asia/Kolkata',
    mapRegion: {
      latitude: 19.035,
      longitude: 72.832,
      latitudeDelta: 0.10,
      longitudeDelta: 0.10,
    },
    routes: [
      MUMBAI_BANDRA_WATERFRONT,
      MUMBAI_COASTAL_PROMENADE,
      MUMBAI_BANDRA_WORLI_COASTAL,
      MUMBAI_MARINE_DRIVE,
      MUMBAI_WORLI_SEAFACE,
      MUMBAI_MAHALAXMI_RACECOURSE,
      MUMBAI_JUHU_BEACH,
      MUMBAI_DANDA_VERSOVA,
      MUMBAI_POWAI_LAKE,
      MUMBAI_SHIVAJI_PARK,
      MUMBAI_PRIYADARSHINI_PARK,
      MUMBAI_PALM_BEACH_NAVI,
      MUMBAI_RAJIV_GANDHI_JOGGERS,
    ],
    recommendedRouteIds: [
      'mumbai_bandra_soul',
      'mumbai_coastal_promenade',
      'mumbai_marine_drive',
      'mumbai_bandra_worli_coastal',
    ],
    monsoonPromenadeRouteIds: [
      'mumbai_marine_drive',
      'mumbai_worli_seaface',
      'mumbai_bandra_soul',
      'mumbai_coastal_promenade',
      'mumbai_bandra_worli_coastal',
    ],
    heatWarningAboveC: 32,   // Mumbai is always warm — only flag extreme heat
    coldWarningBelowC: 15,
    monsoonMonths: [6, 7, 8, 9],
  },
];
