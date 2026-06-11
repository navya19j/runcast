import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { Polyline, Marker, Circle } from 'react-native-maps';
import { MAP_PROVIDER } from '../utils/mapProvider';
import MapCanvas from './MapCanvas';
import { Coordinate, POI, Mode } from '../data/types';
import { distanceMetres } from '../utils/geo';

interface RunMapProps {
  routeCoords: Coordinate[];
  pois: POI[];
  mode: Mode;
  userPosition: Coordinate | null;
  activePOIId: string | null;
  startLocation: Coordinate;
}

const MODE_COLORS: Record<Mode, string> = {
  history:     '#E8834A',
  food:        '#4CAF50',
  sightseeing: '#2196F3',
  local:       '#9C27B0',
};

const FOLLOW_MIN_MOVE_M = 35;
const GESTURE_COOLDOWN_MS = 12000;

export default function RunMap({
  routeCoords,
  pois,
  mode,
  userPosition,
  activePOIId,
  startLocation,
}: RunMapProps) {
  const mapRef = useRef<MapView>(null);
  const color  = MODE_COLORS[mode];
  const userGesturingRef = useRef(false);
  const gestureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFollowRef = useRef<Coordinate | null>(null);

  const lineCoords = useMemo(
    () => routeCoords.map(c => ({ latitude: c.lat, longitude: c.lng })),
    [routeCoords],
  );

  const pauseFollow = useCallback(() => {
    userGesturingRef.current = true;
    if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
    gestureTimerRef.current = setTimeout(() => {
      userGesturingRef.current = false;
    }, GESTURE_COOLDOWN_MS);
  }, []);

  const onRegionChangeStart = useCallback((_region: unknown, details?: { isGesture?: boolean }) => {
    if (details?.isGesture) pauseFollow();
  }, [pauseFollow]);

  useEffect(() => {
    if (!userPosition || userGesturingRef.current) return;
    const last = lastFollowRef.current;
    if (last && distanceMetres(last, userPosition) < FOLLOW_MIN_MOVE_M) return;
    lastFollowRef.current = userPosition;
    mapRef.current?.animateToRegion(
      {
        latitude:      userPosition.lat,
        longitude:     userPosition.lng,
        latitudeDelta:  0.01,
        longitudeDelta: 0.01,
      },
      600,
    );
  }, [userPosition]);

  useEffect(() => () => {
    if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
  }, []);

  return (
    <MapCanvas
      ref={mapRef}
      containerStyle={styles.container}
      provider={MAP_PROVIDER}
      initialRegion={{
        latitude:      startLocation.lat,
        longitude:     startLocation.lng,
        latitudeDelta:  0.06,
        longitudeDelta: 0.06,
      }}
      showsUserLocation={false}
      showsCompass
      showsScale
      mapType="standard"
      cacheEnabled={Platform.OS === 'android'}
      scrollEnabled
      zoomEnabled
      zoomTapEnabled
      rotateEnabled
      pitchEnabled={false}
      moveOnMarkerPress={false}
      onPanDrag={pauseFollow}
      onRegionChangeStart={onRegionChangeStart}
    >
      <Polyline
        coordinates={lineCoords}
        strokeColor={color}
        strokeWidth={4}
        lineCap="round"
        lineJoin="round"
        tappable={false}
      />

      {pois.map(poi => {
        const hasClip = !!poi.clips[mode];
        const isActive = poi.id === activePOIId;
        return hasClip ? (
          <Marker
            key={poi.id}
            coordinate={{ latitude: poi.location.lat, longitude: poi.location.lng }}
            title={poi.name}
            pinColor={isActive ? '#FFD700' : color}
            tracksViewChanges={false}
            tappable={false}
          />
        ) : null;
      })}

      {userPosition && (
        <>
          <Circle
            center={{ latitude: userPosition.lat, longitude: userPosition.lng }}
            radius={12}
            fillColor="rgba(255,255,255,0.95)"
            strokeColor={color}
            strokeWidth={3}
          />
          <Circle
            center={{ latitude: userPosition.lat, longitude: userPosition.lng }}
            radius={40}
            fillColor={`${color}22`}
            strokeColor="transparent"
          />
        </>
      )}

      <Marker
        coordinate={{ latitude: startLocation.lat, longitude: startLocation.lng }}
        title="Start"
        pinColor="#00C853"
        tracksViewChanges={false}
        tappable={false}
      />
    </MapCanvas>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
