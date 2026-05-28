import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { City, CITIES } from '../data/cities';
import { Route, Mode } from '../data/types';
import { useWeather } from '../hooks/useWeather';
import WeatherBar from '../components/WeatherBar';

// ─── Design tokens (shared with App.tsx) ────────────────────────────────────
const C = {
  bg:            '#0D0C0A',
  surface:       '#181612',
  surfaceRaised: '#221F1A',
  amber:         '#F5A623',
  amberText:     '#0D0C0A',
  amberBorder:   'rgba(245,166,35,0.22)',
  white:         '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.52)',
  textTertiary:  'rgba(255,255,255,0.28)',
  border:        'rgba(255,255,255,0.09)',
  danger:        '#FF5252',
};

const MODE_COUNT_LABELS: Partial<Record<number, string>> = {
  1: '1 mode', 2: '2 modes', 3: '3 modes', 4: '4 modes',
};

interface HomeScreenProps {
  onSelectRoute: (city: City, route: Route) => void;
}

export default function HomeScreen({ onSelectRoute }: HomeScreenProps) {
  const [selectedCity, setSelectedCity]   = useState<City>(CITIES[0]);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const { weather, loading, error } = useWeather(selectedCity);

  // Animate to city when switched
  const handleCityChange = (city: City) => {
    setSelectedCity(city);
    setHoveredRouteId(null);
    mapRef.current?.animateToRegion(city.mapRegion, 600);
  };

  // Mode count for a route
  const modeCount = (route: Route): number => {
    const modeSet = new Set<Mode>();
    route.pois.forEach(p => Object.keys(p.clips).forEach(m => modeSet.add(m as Mode)));
    return modeSet.size;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>RunCast</Text>
          <Text style={styles.tagline}>Audio running tours</Text>
        </View>

        {/* City switcher */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cityRow}
        >
          {CITIES.map(city => (
            <TouchableOpacity
              key={city.id}
              style={[
                styles.cityChip,
                selectedCity.id === city.id && styles.cityChipActive,
              ]}
              onPress={() => handleCityChange(city)}
            >
              <Text style={[
                styles.cityChipText,
                selectedCity.id === city.id && styles.cityChipTextActive,
              ]}>
                {city.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Weather bar ── */}
      <WeatherBar
        weather={weather}
        loading={loading}
        error={error}
        cityName={selectedCity.name}
      />

      {/* ── Map ── */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={selectedCity.mapRegion}
          mapType="mutedStandard"
          showsUserLocation
          showsCompass={false}
          showsScale={false}
        >
          {selectedCity.routes.map(route => {
            const isHovered = hoveredRouteId === route.id;
            return (
              <React.Fragment key={route.id}>
                {/* Route polyline — convert {lat,lng} → {latitude,longitude} */}
                <Polyline
                  coordinates={route.coordinates.map(c => ({ latitude: c.lat, longitude: c.lng }))}
                  strokeColor={isHovered ? C.amber : 'rgba(245,166,35,0.5)'}
                  strokeWidth={isHovered ? 4 : 2.5}
                />
                {/* Start marker */}
                <Marker
                  coordinate={{ latitude: route.startLocation.lat, longitude: route.startLocation.lng }}
                  onPress={() => setHoveredRouteId(route.id)}
                >
                  <View style={[
                    styles.markerOuter,
                    isHovered && styles.markerOuterActive,
                  ]}>
                    <View style={[
                      styles.markerInner,
                      isHovered && styles.markerInnerActive,
                    ]} />
                  </View>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapView>

        {/* Routes count badge */}
        <View style={styles.mapBadge}>
          <Text style={styles.mapBadgeText}>
            {selectedCity.routes.length} route{selectedCity.routes.length !== 1 ? 's' : ''} · {selectedCity.name}
          </Text>
        </View>
      </View>

      {/* ── Route cards ── */}
      <View style={styles.routeSection}>
        <Text style={styles.sectionLabel}>Routes</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.routeScroll}
        >
          {selectedCity.routes.map(route => {
            const modes = modeCount(route);
            const isActive = hoveredRouteId === route.id;
            return (
              <TouchableOpacity
                key={route.id}
                style={[styles.routeCard, isActive && styles.routeCardActive]}
                onPress={() => onSelectRoute(selectedCity, route)}
                onPressIn={() => setHoveredRouteId(route.id)}
                onPressOut={() => setHoveredRouteId(null)}
                activeOpacity={0.85}
              >
                {/* Distance pill */}
                <View style={styles.distancePill}>
                  <Text style={styles.distancePillText}>{route.distanceKm} km</Text>
                </View>

                <Text style={styles.routeCardName}>{route.name}</Text>
                <Text style={styles.routeCardDesc} numberOfLines={2}>
                  {route.description}
                </Text>

                <View style={styles.routeCardMeta}>
                  <Text style={styles.routeCardMetaText}>
                    {route.pois.length} landmarks · {MODE_COUNT_LABELS[modes] ?? `${modes} modes`}
                  </Text>
                </View>

                <View style={[
                  styles.startButton,
                  isActive && styles.startButtonActive,
                ]}>
                  <Text style={[
                    styles.startButtonText,
                    isActive && styles.startButtonTextActive,
                  ]}>
                    Start
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
  },
  appName: {
    color: C.amber,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    color: C.textTertiary,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  cityRow: { gap: 8, paddingBottom: 2 },
  cityChip: {
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.border,
  },
  cityChipActive: {
    backgroundColor: C.surfaceRaised,
    borderColor: C.amberBorder,
  },
  cityChipText:       { color: C.textSecondary, fontSize: 13, fontWeight: '600' },
  cityChipTextActive: { color: C.amber },

  // Map
  mapContainer: { flex: 1, position: 'relative' },
  map:          { flex: 1 },
  mapBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(13,12,10,0.82)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  mapBadgeText: { color: C.textSecondary, fontSize: 11, fontWeight: '600' },

  // Markers
  markerOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(245,166,35,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245,166,35,0.5)',
  },
  markerOuterActive: {
    backgroundColor: 'rgba(245,166,35,0.35)',
    borderColor: C.amber,
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  markerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.amber,
  },
  markerInnerActive: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },

  // Route section
  routeSection: {
    paddingTop: 14,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 10,
  },
  sectionLabel: {
    color: C.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    paddingHorizontal: 16,
  },
  routeScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },

  // Route card
  routeCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 14,
    width: 220,
    borderWidth: 1,
    borderColor: C.border,
    gap: 6,
  },
  routeCardActive: {
    borderColor: C.amberBorder,
    backgroundColor: C.surfaceRaised,
  },
  distancePill: {
    alignSelf: 'flex-start',
    backgroundColor: C.surfaceRaised,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  distancePillText: { color: C.textSecondary, fontSize: 11, fontWeight: '700' },
  routeCardName: {
    color: C.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  routeCardDesc: {
    color: C.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  routeCardMeta: { marginTop: 2 },
  routeCardMetaText: {
    color: C.textTertiary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  startButton: {
    marginTop: 6,
    backgroundColor: C.surfaceRaised,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  startButtonActive: {
    backgroundColor: C.amber,
    borderColor: C.amber,
  },
  startButtonText:       { color: C.textSecondary, fontSize: 13, fontWeight: '700' },
  startButtonTextActive: { color: C.amberText },
});
