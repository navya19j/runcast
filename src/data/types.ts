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

export interface Route {
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
