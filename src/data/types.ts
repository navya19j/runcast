export type Mode = 'history' | 'food' | 'sightseeing' | 'local';

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface AudioClip {
  script: string;
  audioFile: string | null; // relative path under assets/audio/, null until generated
  durationSec: number;      // estimated — used for pace-adjusted triggering
}

export interface POI {
  id: string;
  name: string;
  location: Coordinate;
  triggerDistanceM: number; // meters ahead of POI to start clip
  clips: Partial<Record<Mode, AudioClip>>;
}

/** Rich metadata sourced from curated_routes.json — all fields optional so existing routes aren't broken */
export interface RouteMetadata {
  loop?: boolean;            // true = returns to start, false = point-to-point
  elevationGainM?: number;
  surface?: string;
  surfaceQuality?: string;
  shade?: 'none' | 'partial' | 'good';
  gradientCharacter?: string;
  width?: string;
  obstacles?: string;
  bestTime?: string;
  monsoonSafe?: boolean;
  bestSeason?: string;
  crowdLevels?: Record<string, string>;
  lighting?: 'none' | 'partial' | 'fully lit';
  soloFemaleSafe?: boolean;
  headphonesSafe?: boolean;
  whoItsFor?: string;
  bestUse?: string;
  heatWarning?: 'low' | 'moderate' | 'high';
  waterOnRoute?: boolean;
  restroomsOnRoute?: boolean;
  transitToStart?: string;
  postRunFood?: string;
  localTip?: string;
  instagramMoment?: string;
  historicalHook?: string;
  neighbourhoodVibe?: string;
  landmarks?: string[];
  poiDensity?: 'low' | 'medium' | 'high';
  contentRichness?: { history: number; food: number; architecture: number; local_life: number };
  runClubUsage?: string[];
  eventAssociation?: string | null;
  communityRating?: number;
}

export interface Route extends RouteMetadata {
  id: string;
  city: string;
  name: string;
  description: string;
  distanceKm: number;
  startLocation: Coordinate;
  coordinates: Coordinate[]; // ordered path points
  pois: POI[];
}

export type RunState = 'idle' | 'running' | 'paused' | 'finished';

export interface RunProgress {
  state: RunState;
  distanceCoveredM: number;
  elapsedSec: number;
  currentPosition: Coordinate | null;
  playedPOIIds: Set<string>;
  activePOI: POI | null;
}
