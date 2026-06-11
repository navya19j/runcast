import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

/**
 * On-device run photos, keyed by route id. Captured/picked images are copied
 * into a persistent app folder (the picker's own URIs live in cache and can be
 * reclaimed by the OS), and the index of URIs is mirrored to AsyncStorage.
 */

const KEY = 'runcast:photos:v1';
const PHOTO_DIR = 'route-photos';

type PhotosByRoute = Record<string, string[]>;

let state: PhotosByRoute = {};
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
    if (raw) state = JSON.parse(raw) as PhotosByRoute;
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

export function getSnapshot(): PhotosByRoute {
  return state;
}

export function getRoutePhotos(routeId: string): string[] {
  return state[routeId] ?? [];
}

export function isLoaded(): boolean {
  return loaded;
}

function photosDir(): Directory {
  const dir = new Directory(Paths.document, PHOTO_DIR);
  if (!dir.exists) dir.create();
  return dir;
}

function addUri(routeId: string, uri: string) {
  const existing = state[routeId] ?? [];
  state = { ...state, [routeId]: [...existing, uri] };
  persist();
  emit();
}

export function removePhoto(routeId: string, uri: string) {
  const existing = state[routeId] ?? [];
  state = { ...state, [routeId]: existing.filter(u => u !== uri) };
  persist();
  emit();
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* file already gone */
  }
}

/** Copy a picked/captured image into the persistent photo folder, return its uri. */
async function persistImage(routeId: string, srcUri: string): Promise<string> {
  const src = new File(srcUri);
  const ext = (srcUri.split('.').pop() ?? 'jpg').split('?')[0].slice(0, 4) || 'jpg';
  const dest = new File(photosDir(), `${routeId}-${Date.now()}.${ext}`);
  await src.copy(dest);
  return dest.uri;
}

export type AddPhotoResult =
  | { ok: true }
  | { ok: false; reason: 'denied' | 'cancelled' | 'error' };

/** Snap a new photo with the camera and attach it to the route. */
export async function capturePhoto(routeId: string): Promise<AddPhotoResult> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'denied' };
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.length) return { ok: false, reason: 'cancelled' };
    addUri(routeId, await persistImage(routeId, result.assets[0].uri));
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Pick existing photos from the library and attach them to the route. */
export async function pickPhotos(routeId: string): Promise<AddPhotoResult> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'denied' };
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsMultipleSelection: true,
      mediaTypes: ['images'],
    });
    if (result.canceled || !result.assets?.length) return { ok: false, reason: 'cancelled' };
    for (const asset of result.assets) {
      addUri(routeId, await persistImage(routeId, asset.uri));
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
