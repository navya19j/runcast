import { useSyncExternalStore } from 'react';
import {
  getSnapshot,
  subscribe,
  getRun,
  saveRun,
  deleteRun,
} from '../utils/recordedRunsStore';

/** Subscribe to the user's recorded runs. */
export function useRecordedRuns() {
  const runs = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { runs, getRun, saveRun, deleteRun };
}
