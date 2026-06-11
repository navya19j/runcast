import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Circle } from 'react-native-maps';
import { MAP_PROVIDER } from '../utils/mapProvider';
import RouteOverlay from '../components/RouteOverlay';
import MapCanvas from '../components/MapCanvas';
import * as Location from 'expo-location';
import { City, CITIES } from '../data/cities';
import { Route, Mode, Coordinate } from '../data/types';
import { routeRegion } from '../utils/geo';
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

type RouteShape = 'any' | 'loop' | 'one_way';

const SHAPE_OPTIONS: { id: RouteShape; label: string }[] = [
  { id: 'any',     label: 'Any' },
  { id: 'loop',    label: 'Loop' },
  { id: 'one_way', label: 'One way' },
];

interface HomeScreenProps {
  onSelectRoute: (city: City, route: Route, startOverride?: Coordinate) => void;
}

export default function HomeScreen({ onSelectRoute }: HomeScreenProps) {
  const [selectedCity, setSelectedCity]     = useState<City>(CITIES[0]);
  const [previewRouteId, setPreviewRouteId] = useState<string | null>(null);
  const [routeShape, setRouteShape]         = useState<RouteShape>('any');
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationLabel, setLocationLabel]     = useState<string | null>(null);
  const [locationError, setLocationError]     = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const { height: windowHeight } = useWindowDimensions();
  const mapHeight = Math.round(windowHeight * 0.42);
  const { weather, loading, error } = useWeather(selectedCity);

  const visibleRoutes = useMemo(() => selectedCity.routes.filter(r => {
    if (routeShape === 'loop')    return r.loop === true;
    if (routeShape === 'one_way') return r.loop === false;
    return true;
  }), [selectedCity.routes, routeShape]);

  const previewRoute = useMemo(
    () => visibleRoutes.find(r => r.id === previewRouteId) ?? null,
    [visibleRoutes, previewRouteId],
  );

  const handlePreviewRoute = (route: Route) => {
    setPreviewRouteId(route.id);
    mapRef.current?.animateToRegion(routeRegion(route), 550);
  };

  useEffect(() => {
    if (previewRouteId && !visibleRoutes.some(r => r.id === previewRouteId)) {
      setPreviewRouteId(null);
      mapRef.current?.animateToRegion(selectedCity.mapRegion, 500);
    }
  }, [visibleRoutes, previewRouteId, selectedCity.mapRegion]);

  // Animate to city when switched
  const handleCityChange = (city: City) => {
    setSelectedCity(city);
    setPreviewRouteId(null);
    mapRef.current?.animateToRegion(city.mapRegion, 600);
  };

  const flyToCoordinate = (coord: Coordinate) => {
    mapRef.current?.animateToRegion({
      latitude:       coord.lat,
      longitude:      coord.lng,
      latitudeDelta:  0.08,
      longitudeDelta: 0.08,
    }, 700);
  };

  const fetchPosition = async (): Promise<Location.LocationObject> => {
    const opts = { accuracy: Location.Accuracy.High };
    const timeoutMs = 15000;
    try {
      return await Promise.race([
        Location.getCurrentPositionAsync(opts),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GPS timeout')), timeoutMs),
        ),
      ]);
    } catch {
      const last = await Location.getLastKnownPositionAsync();
      if (last) return last;
      throw new Error('Could not get GPS fix');
    }
  };

  // Request GPS and fly map to user
  const handleUseCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;
      if (status !== 'granted') {
        ({ status } = await Location.requestForegroundPermissionsAsync());
      }
      if (status !== 'granted') {
        setLocationError('Location permission required');
        Alert.alert(
          'Location access needed',
          'RunCast needs your location to set a start point. Enable Location for RunCast in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }

      const pos = await fetchPosition();
      const coord: Coordinate = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCurrentLocation(coord);
      flyToCoordinate(coord);

      // Label is optional — never block on geocoding
      setLocationLabel('Current location');
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude: coord.lat,
          longitude: coord.lng,
        });
        if (place) {
          const parts = [place.street, place.district ?? place.subregion ?? place.city].filter(Boolean);
          if (parts.length > 0) setLocationLabel(parts.join(', '));
        }
      } catch {
        // GPS succeeded; keep generic label
      }
    } catch {
      setLocationError('Could not get location — try outdoors or enable Location Services');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleClearLocation = () => {
    setCurrentLocation(null);
    setLocationLabel(null);
    setLocationError(null);
    mapRef.current?.animateToRegion(selectedCity.mapRegion, 600);
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
      <View style={[styles.mapContainer, { height: mapHeight }]}>
        <MapCanvas
          ref={mapRef}
          containerStyle={styles.mapFill}
          provider={MAP_PROVIDER}
          initialRegion={selectedCity.mapRegion}
          mapType="standard"
          showsUserLocation={false}
          showsCompass
          showsScale={false}
          scrollEnabled
          zoomEnabled
          zoomTapEnabled
          rotateEnabled
          pitchEnabled={false}
          moveOnMarkerPress={false}
          cacheEnabled={Platform.OS === 'android'}
        >
          {previewRoute && (
            <RouteOverlay key={previewRoute.id} route={previewRoute} focus="solo" />
          )}

          {currentLocation && (
            <Circle
              center={{ latitude: currentLocation.lat, longitude: currentLocation.lng }}
              radius={18}
              fillColor="rgba(66,133,244,0.35)"
              strokeColor="#4285F4"
              strokeWidth={2}
              zIndex={10}
            />
          )}
        </MapCanvas>

        <TouchableOpacity
          style={styles.mapBadge}
          onPress={() => {
            if (!previewRoute) return;
            setPreviewRouteId(null);
            mapRef.current?.animateToRegion(selectedCity.mapRegion, 500);
          }}
          activeOpacity={previewRoute ? 0.75 : 1}
          disabled={!previewRoute}
        >
          <Text style={styles.mapBadgeText} numberOfLines={1}>
            {previewRoute
              ? `${previewRoute.name} · tap to show all`
              : `${visibleRoutes.length} routes · tap a card to preview`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Preferences bar ── */}
      <View style={styles.prefsBar}>
        {/* Start location */}
        <View style={styles.prefRow}>
          <Text style={styles.prefLabel} numberOfLines={1}>Start</Text>
          {currentLocation ? (
            <View style={styles.locationActive}>
              <View style={styles.locationDot} />
              <Text style={styles.locationActiveText} numberOfLines={1}>
                {locationLabel}
              </Text>
              <TouchableOpacity onPress={handleClearLocation} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.locationBtn}
              onPress={handleUseCurrentLocation}
              disabled={locationLoading}
              activeOpacity={0.75}
            >
              {locationLoading ? (
                <ActivityIndicator size={11} color={C.amber} style={{ marginRight: 5 }} />
              ) : (
                <Text style={styles.locationBtnIcon}>◎</Text>
              )}
              <Text style={styles.locationBtnText}>
                {locationLoading ? 'Locating…' : 'Use my location'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {locationError && (
          <Text style={styles.locationError}>{locationError}</Text>
        )}

        {/* Route shape */}
        <View style={styles.prefRow}>
          <Text style={styles.prefLabel} numberOfLines={1}>Shape</Text>
          <View style={styles.shapeRow}>
            {SHAPE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.shapePill, routeShape === opt.id && styles.shapePillActive]}
                onPress={() => setRouteShape(opt.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.shapePillText, routeShape === opt.id && styles.shapePillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* ── Route cards ── */}
      <View style={styles.routeSection}>
        <Text style={styles.sectionLabel}>
          {visibleRoutes.length === 0 ? 'No routes match' : 'Routes'}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.routeScroll}
        >
          {visibleRoutes.map(route => {
            const modes = modeCount(route);
            const isActive = previewRouteId === route.id;
            return (
              <TouchableOpacity
                key={route.id}
                style={[styles.routeCard, isActive && styles.routeCardActive]}
                onPress={() => onSelectRoute(selectedCity, route, currentLocation ?? undefined)}
                onPressIn={() => handlePreviewRoute(route)}
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

  // Map — fixed height (set inline); flex:1 was starving gestures on iOS
  mapContainer: { position: 'relative' },
  mapFill:      { flex: 1 },
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

  // Preferences bar
  prefsBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 8,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prefLabel: {
    color: C.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    width: 46,
    flexShrink: 0,
  },

  // Location button (inactive state)
  locationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  locationBtnIcon: {
    color: C.amber,
    fontSize: 12,
  },
  locationBtnText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  locationError: {
    color: C.danger,
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 56,
    lineHeight: 15,
  },

  // Location active state
  locationActive: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(66,133,244,0.10)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(66,133,244,0.30)',
  },
  locationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4285F4',
    flexShrink: 0,
  },
  locationActiveText: {
    flex: 1,
    color: '#7EB8FF',
    fontSize: 12,
    fontWeight: '600',
  },
  clearBtn: {
    padding: 2,
  },
  clearBtnText: {
    color: C.textTertiary,
    fontSize: 11,
    fontWeight: '700',
  },

  // Shape pills
  shapeRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  shapePill: {
    backgroundColor: C.surface,
    borderRadius: 7,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.border,
  },
  shapePillActive: {
    backgroundColor: C.surfaceRaised,
    borderColor: C.amberBorder,
  },
  shapePillText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  shapePillTextActive: {
    color: C.amber,
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
