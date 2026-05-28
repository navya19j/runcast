import React, { useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Polyline, Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { Coordinate, POI, Mode } from '../data/types';

interface RunMapProps {
  routeCoords: Coordinate[];
  pois: POI[];
  mode: Mode;
  userPosition: Coordinate | null;
  activePOIId: string | null;
  startLocation: Coordinate;
}

const MODE_COLORS: Record<Mode, string> = {
  history: '#E8834A',
  food: '#4CAF50',
  sightseeing: '#2196F3',
  local: '#9C27B0',
};

export default function RunMap({
  routeCoords,
  pois,
  mode,
  userPosition,
  activePOIId,
  startLocation,
}: RunMapProps) {
  const mapRef = useRef<MapView>(null);
  const color = MODE_COLORS[mode];

  const mapRegion = {
    latitude: startLocation.lat,
    longitude: startLocation.lng,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  };

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={PROVIDER_GOOGLE}
      initialRegion={mapRegion}
      showsUserLocation={false}
      showsCompass
      showsScale
      mapType="standard"
    >
      {/* Route line */}
      <Polyline
        coordinates={routeCoords.map(c => ({ latitude: c.lat, longitude: c.lng }))}
        strokeColor={color}
        strokeWidth={4}
        lineDashPattern={undefined}
      />

      {/* POI markers */}
      {pois.map(poi => {
        const hasClip = !!poi.clips[mode];
        const isActive = poi.id === activePOIId;
        return hasClip ? (
          <Marker
            key={poi.id}
            coordinate={{ latitude: poi.location.lat, longitude: poi.location.lng }}
            title={poi.name}
            pinColor={isActive ? '#FFD700' : color}
          />
        ) : null;
      })}

      {/* User position */}
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

      {/* Start marker */}
      <Marker
        coordinate={{ latitude: startLocation.lat, longitude: startLocation.lng }}
        title="Start"
        pinColor="#00C853"
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
