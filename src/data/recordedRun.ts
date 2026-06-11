import { Coordinate } from './types';

/** A spoken memo a runner dropped during a run. Location is optional — a note
 *  is always worth keeping even if GPS hasn't locked yet (e.g. indoors). */
export interface VoiceNote {
  id: string;
  location: Coordinate | null;
  audioUri: string;      // persisted file uri (documents dir)
  durationSec: number;
  atSec: number;         // seconds into the run when recorded
}

/** A run the user recorded themselves — their own route + voice notes + photos. */
export interface RecordedRun {
  id: string;
  name: string;
  createdAt: number;     // epoch ms
  cityId?: string;
  coordinates: Coordinate[];
  distanceM: number;
  durationSec: number;
  voiceNotes: VoiceNote[];
  photoUris: string[];
}
