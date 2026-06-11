import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { RecordedRun } from '../data/recordedRun';

/**
 * On-device store for runs the user recorded. Metadata + the GPS path live in
 * AsyncStorage; voice-note audio and photos are copied into a per-run folder in
 * the documents dir (the recorder/picker hand back cache URIs that the OS can
 * reclaim). External-store shape so screens subscribe via useSyncExternalStore.
 */

const KEY = 'runcast:runs:v1';

let state: RecordedRun[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

async function load() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as RecordedRun[];
  } catch {
    /* start empty */
  } finally {
    loaded = true;
    emit();
  }
}

void load();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSnapshot(): RecordedRun[] {
  return state;
}

export function getRun(id: string): RecordedRun | null {
  return state.find(r => r.id === id) ?? null;
}

export function isLoaded(): boolean {
  return loaded;
}

function runDir(runId: string): Directory {
  const runs = new Directory(Paths.document, 'runs');
  if (!runs.exists) runs.create();
  const dir = new Directory(runs, runId);
  if (!dir.exists) dir.create();
  return dir;
}

async function persistFile(runId: string, srcUri: string, prefix: string): Promise<string> {
  const ext = (srcUri.split('.').pop() ?? '').split('?')[0].slice(0, 4) || 'dat';
  const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const dest = new File(runDir(runId), name);
  await new File(srcUri).copy(dest);
  return dest.uri;
}

/** Save (or replace) a run, copying any temp audio/photo files into its folder. */
export async function saveRun(run: RecordedRun): Promise<void> {
  const marker = `/runs/${run.id}/`;
  const voiceNotes = await Promise.all(
    run.voiceNotes.map(async n =>
      n.audioUri.includes(marker)
        ? n
        : { ...n, audioUri: await persistFile(run.id, n.audioUri, 'note') },
    ),
  );
  const photoUris = await Promise.all(
    run.photoUris.map(async u =>
      u.includes(marker) ? u : persistFile(run.id, u, 'photo'),
    ),
  );
  const saved: RecordedRun = { ...run, voiceNotes, photoUris };
  state = [saved, ...state.filter(r => r.id !== run.id)];
  persist();
  emit();
}

export function deleteRun(id: string) {
  state = state.filter(r => r.id !== id);
  persist();
  emit();
  try {
    const dir = new Directory(new Directory(Paths.document, 'runs'), id);
    if (dir.exists) dir.delete();
  } catch {
    /* folder already gone */
  }
}
