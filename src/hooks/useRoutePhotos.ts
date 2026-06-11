import { useSyncExternalStore } from 'react';
import {
  getSnapshot,
  subscribe,
  getRoutePhotos,
  capturePhoto,
  pickPhotos,
  removePhoto,
} from '../utils/photosStore';

/** Subscribe to on-device run photos for a route. */
export function useRoutePhotos(routeId: string) {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    photos: getRoutePhotos(routeId),
    capture: () => capturePhoto(routeId),
    pick: () => pickPhotos(routeId),
    remove: (uri: string) => removePhoto(routeId, uri),
  };
}
