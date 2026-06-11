import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Polyline, Circle, Marker } from 'react-native-maps';
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
  /** Sim mode — drag the runner marker to scrub position */
  draggableUser?: boolean;
  onUserPositionChange?: (coord: Coordinate) => void;
  onPress?: () => void;
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
  draggableUser = false,
  onUserPositionChange,
  onPress,
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

  // Show the full route on open, regardless of startLocation / startOverride.
  const initialRegion = useMemo(() => {
    if (routeCoords.length === 0) {
      return { latitude: startLocation.lat, longitude: startLocation.lng, latitudeDelta: 0.06, longitudeDelta: 0.06 };
    }
    let minLat = routeCoords[0].lat, maxLat = routeCoords[0].lat;
    let minLng = routeCoords[0].lng, maxLng = routeCoords[0].lng;
    for (const c of routeCoords) {
      if (c.lat < minLat) minLat = c.lat;
      if (c.lat > maxLat) maxLat = c.lat;
      if (c.lng < minLng) minLng = c.lng;
      if (c.lng > maxLng) maxLng = c.lng;
    }
    const lngDelta = Math.max((maxLng - minLng) * 1.4, 0.015);
    // Ensure the latitude span is at least half the longitude span so the
    // route isn't rendered as an unreadably thin horizontal strip.
    const latDelta = Math.max((maxLat - minLat) * 1.4, lngDelta * 0.5, 0.015);
    return {
      latitude:       (minLat + maxLat) / 2,
      longitude:      (minLng + maxLng) / 2,
      latitudeDelta:  latDelta,
      longitudeDelta: lngDelta,
    };
  }, [routeCoords, startLocation]);

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

  const handleMarkerDrag = useCallback(
    (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      pauseFollow();
      onUserPositionChange?.({
        lat: e.nativeEvent.coordinate.latitude,
        lng: e.nativeEvent.coordinate.longitude,
      });
    },
    [onUserPositionChange, pauseFollow],
  );

  // North-up when the run screen opens
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    void map.getCamera().then(camera => {
      map.animateCamera(
        { ...camera, heading: 0, pitch: 0 },
        { duration: 0 },
      );
    }).catch(() => {});
  }, [routeCoords]);

  useEffect(() => {
    if (!userPosition || userGesturingRef.current) return;
    const last = lastFollowRef.current;
    if (last && distanceMetres(last, userPosition) < FOLLOW_MIN_MOVE_M) return;
    lastFollowRef.current = userPosition;

    const map = mapRef.current;
    if (!map) return;

    // North-up follow while running — rotation is disabled on this map
    void map.getCamera().then(camera => {
      if (userGesturingRef.current) return;
      map.animateCamera(
        {
          center: { latitude: userPosition.lat, longitude: userPosition.lng },
          heading: 0,
          pitch: 0,
          zoom: camera.zoom,
          altitude: camera.altitude,
        },
        { duration: 600 },
      );
    }).catch(() => {
      map.animateToRegion(
        {
          latitude: userPosition.lat,
          longitude: userPosition.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        600,
      );
    });
  }, [userPosition]);

  useEffect(() => () => {
    if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
  }, []);

  return (
    <MapCanvas
      ref={mapRef}
      containerStyle={styles.container}
      provider={MAP_PROVIDER}
      initialRegion={initialRegion}
      showsUserLocation={false}
      showsCompass
      showsScale
      mapType="standard"
      cacheEnabled={Platform.OS === 'android'}
      scrollEnabled
      zoomEnabled
      zoomTapEnabled
      rotateEnabled={false}
      pitchEnabled={false}
      moveOnMarkerPress={false}
      onPanDrag={pauseFollow}
      onRegionChangeStart={onRegionChangeStart}
      onPress={onPress}
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
          <Circle
            key={poi.id}
            center={{ latitude: poi.location.lat, longitude: poi.location.lng }}
            radius={isActive ? 16 : 11}
            fillColor={isActive ? '#FFD700' : color}
            strokeColor="#FFFFFF"
            strokeWidth={2}
            zIndex={isActive ? 5 : 2}
          />
        ) : null;
      })}

      {userPosition && draggableUser ? (
        <Marker
          coordinate={{ latitude: userPosition.lat, longitude: userPosition.lng }}
          draggable
          onDrag={handleMarkerDrag}
          onDragEnd={handleMarkerDrag}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={10}
        >
          <View style={[styles.userMarker, { borderColor: color }]}>
            <View style={[styles.userMarkerInner, { backgroundColor: color }]} />
          </View>
        </Marker>
      ) : userPosition ? (
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
      ) : null}

      <Circle
        center={{ latitude: startLocation.lat, longitude: startLocation.lng }}
        radius={18}
        fillColor={color}
        strokeColor="#FFFFFF"
        strokeWidth={2}
        zIndex={3}
      />
    </MapCanvas>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  userMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
