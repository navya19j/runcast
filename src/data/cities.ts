import { Route } from './types';
import SF_EMBARCADERO_ROUTE from './routes/sf_embarcadero';
import MUMBAI_BANDRA_WATERFRONT, {
  MUMBAI_COASTAL_PROMENADE,
} from './routes/mumbai_bandra_waterfront';

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
  // Running context hints shown in weather card
  heatWarningAboveC: number;   // city-specific heat threshold
  coldWarningBelowC: number;
  monsoonMonths?: number[];    // months (1-12) with heavy rain risk
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
    routes: [SF_EMBARCADERO_ROUTE],
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
    routes: [MUMBAI_BANDRA_WATERFRONT, MUMBAI_COASTAL_PROMENADE],
    heatWarningAboveC: 32,   // Mumbai is always warm — only flag extreme heat
    coldWarningBelowC: 15,
    monsoonMonths: [6, 7, 8, 9],
  },
];
