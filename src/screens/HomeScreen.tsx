import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
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
  Animated,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Circle, Marker } from 'react-native-maps';
import { MAP_PROVIDER } from '../utils/mapProvider';
import MapCanvas from '../components/MapCanvas';
import RouteOverlay from '../components/RouteOverlay';
import * as Location from 'expo-location';
import { City, CITIES } from '../data/cities';
import { Route, Coordinate } from '../data/types';
import {
  getQuickPosition,
  refinePosition,
  toCoordinate,
  warmUpLocation,
} from '../utils/quickLocation';
import {
  matchesShapeFilter,
  routeShapeLabel,
  type RouteShapeFilter,
} from '../utils/routeLabels';
import { scoreRouteConditions, conditionRank, RouteCondition } from '../utils/routeConditions';
import RouteTraitChips from '../components/RouteTraitChips';
import ConditionPill from '../components/ConditionPill';
import { useWeather, useRouteWeather } from '../hooks/useWeather';
import WeatherBar from '../components/WeatherBar';

const C = {
  bg:            '#0D0C0A',
  sheet:         '#141210',
  surface:       '#1E1B17',
  amber:         '#F5A623',
  white:         '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.55)',
  textTertiary:  'rgba(255,255,255,0.32)',
  border:        'rgba(255,255,255,0.1)',
  danger:        '#FF5252',
};

const SHEET_PEEK = 76;
const SHEET_COLLAPSED = 260;

const SHAPE_OPTIONS: { id: RouteShapeFilter; label: string }[] = [
  { id: 'any',          label: 'All' },
  { id: 'loop',         label: 'Loops' },
  { id: 'out_and_back', label: 'Out & back' },
  { id: 'one_way',      label: 'One way' },
];

interface HomeScreenProps {
  selectedCity: City;
  onCityChange: (city: City) => void;
  onSelectRoute: (city: City, route: Route, startOverride?: Coordinate) => void;
  onRecord: () => void;
  onOpenMyRuns: () => void;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * A calm start marker. Custom marker views must re-capture briefly when they
 * change, then stop (`tracksViewChanges`) to avoid per-frame redraws.
 */
function RoutePin({
  coord,
  focused,
  onPress,
}: {
  coord: Coordinate;
  focused: boolean;
  onPress: () => void;
}) {
  const [track, setTrack] = useState(true);
  useEffect(() => {
    setTrack(true);
    const t = setTimeout(() => setTrack(false), 700);
    return () => clearTimeout(t);
  }, [focused]);

  return (
    <Marker
      coordinate={{ latitude: coord.lat, longitude: coord.lng }}
      onPress={onPress}
      tracksViewChanges={track}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={focused ? 30 : 5}
    >
      <View style={[pin.dot, focused && pin.dotFocused]} />
    </Marker>
  );
}

const pin = StyleSheet.create({
  dot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: 'rgba(245,166,35,0.85)',
    borderWidth: 2,
    borderColor: 'rgba(13,12,10,0.9)',
  },
  dotFocused: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F5A623',
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
});

export default function HomeScreen({
  selectedCity,
  onCityChange,
  onSelectRoute,
  onRecord,
  onOpenMyRuns,
}: HomeScreenProps) {
  const { height: screenHeight } = useWindowDimensions();
  const sheetExpandedHeight = Math.min(screenHeight * 0.72, screenHeight - 100);

  const [routeShape, setRouteShape]           = useState<RouteShapeFilter>('any');
  const [focusedRouteId, setFocusedRouteId]   = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError]     = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const locationRequestRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);

  const sheetHeight = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
  const sheetHeightRef = useRef(SHEET_COLLAPSED);
  const dragStartHeight = useRef(SHEET_COLLAPSED);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  useEffect(() => {
    warmUpLocation();
  }, []);

  useEffect(() => {
    setMapReady(false);
    setFocusedRouteId(null);
    sheetHeight.setValue(SHEET_COLLAPSED);
    sheetHeightRef.current = SHEET_COLLAPSED;
    setSheetExpanded(false);
  }, [selectedCity.id, sheetHeight]);

  useEffect(() => {
    setFocusedRouteId(null);
  }, [routeShape]);

  // Forecast at each route's own start location — captures intra-city
  // microclimates (e.g. foggy SF coast vs. sunny inland).
  const { weatherByRoute } = useRouteWeather(selectedCity, selectedCity.routes);

  const filteredRoutes = useMemo(
    () => selectedCity.routes.filter(r => matchesShapeFilter(r, routeShape)),
    [selectedCity.routes, routeShape],
  );

  // Group by how good each route is *right now*, best buckets first.
  const grouped = useMemo(() => {
    const rank = new Map((selectedCity.recommendedRouteIds ?? []).map((id, i) => [id, i]));
    const scored = filteredRoutes.map(route => ({
      route,
      cond: scoreRouteConditions(route, selectedCity, weatherByRoute.get(route.id) ?? null),
    }));
    const cmp = (a: typeof scored[0], b: typeof scored[0]) => {
      const fa = conditionRank(a.cond.rating), fb = conditionRank(b.cond.rating);
      if (fa !== fb) return fa - fb;
      const ra = rank.get(a.route.id) ?? Number.MAX_SAFE_INTEGER;
      const rb = rank.get(b.route.id) ?? Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return a.route.distanceKm - b.route.distanceKm;
    };
    const great = scored.filter(s => s.cond.rating === 'ideal' || s.cond.rating === 'good').sort(cmp);
    const rest  = scored.filter(s => s.cond.rating === 'fair'  || s.cond.rating === 'poor').sort(cmp);
    return { great, rest, total: scored.length };
  }, [filteredRoutes, selectedCity, weatherByRoute]);

  const focusedRoute = useMemo(
    () => filteredRoutes.find(r => r.id === focusedRouteId) ?? null,
    [filteredRoutes, focusedRouteId],
  );

  useEffect(() => {
    const sub = sheetHeight.addListener(({ value }) => {
      sheetHeightRef.current = value;
    });
    return () => sheetHeight.removeListener(sub);
  }, [sheetHeight]);

  const snapSheet = useCallback((to: number) => {
    Animated.spring(sheetHeight, {
      toValue: to,
      useNativeDriver: false,
      tension: 72,
      friction: 14,
    }).start(({ finished }) => {
      if (!finished) return;
      sheetHeightRef.current = to;
      setSheetExpanded(to > SHEET_COLLAPSED + 48);
    });
  }, [sheetHeight]);

  const collapseSheetForMap = useCallback(() => {
    if (sheetHeightRef.current <= SHEET_PEEK + 12) return;
    snapSheet(SHEET_PEEK);
  }, [snapSheet]);

  const toggleSheet = useCallback(() => {
    const h = sheetHeightRef.current;
    if (h <= SHEET_PEEK + 20) {
      snapSheet(SHEET_COLLAPSED);
    } else if (sheetExpanded) {
      snapSheet(SHEET_COLLAPSED);
    } else {
      snapSheet(sheetExpandedHeight);
    }
  }, [sheetExpanded, sheetExpandedHeight, snapSheet]);

  const sheetPan = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        sheetHeight.stopAnimation(v => {
          dragStartHeight.current = v;
        });
      },
      onPanResponderMove: (_, g) => {
        const next = clamp(
          dragStartHeight.current - g.dy,
          SHEET_PEEK,
          sheetExpandedHeight,
        );
        sheetHeight.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dy) < 8 && Math.abs(g.vy) < 0.25) {
          toggleSheet();
          return;
        }
        sheetHeight.stopAnimation(v => {
          const projected = v - g.vy * 100;
          const snapPoints = [SHEET_PEEK, SHEET_COLLAPSED, sheetExpandedHeight];
          const nearest = snapPoints.reduce((best, p) =>
            Math.abs(p - projected) < Math.abs(best - projected) ? p : best,
          );
          snapSheet(nearest);
        });
      },
    }),
    [sheetHeight, sheetExpandedHeight, snapSheet, toggleSheet],
  );

  const fitAllRoutes = useCallback(() => {
    const map = mapRef.current;
    if (!map || filteredRoutes.length === 0) return;
    const coords = filteredRoutes.map(r => ({
      latitude: r.startLocation.lat,
      longitude: r.startLocation.lng,
    }));
    map.fitToCoordinates(coords, {
      edgePadding: { top: 110, right: 56, bottom: sheetHeightRef.current + 32, left: 56 },
      animated: true,
    });
  }, [filteredRoutes]);

  useEffect(() => {
    if (!mapReady || currentLocation || focusedRouteId) return;
    const t = setTimeout(() => fitAllRoutes(), 100);
    return () => clearTimeout(t);
  }, [mapReady, selectedCity.id, filteredRoutes, fitAllRoutes, currentLocation, focusedRouteId]);

  const { weather, loading, error } = useWeather({
    city: selectedCity,
  });

  const openRoute = (route: Route) => {
    onSelectRoute(selectedCity, route, currentLocation ?? undefined);
  };

  const focusRoute = useCallback((route: Route) => {
    setFocusedRouteId(route.id);
    collapseSheetForMap();
    const coords = route.coordinates.length > 0
      ? route.coordinates.map(c => ({ latitude: c.lat, longitude: c.lng }))
      : [{ latitude: route.startLocation.lat, longitude: route.startLocation.lng }];
    requestAnimationFrame(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 110, right: 60, bottom: SHEET_PEEK + 150, left: 60 },
        animated: true,
      });
    });
  }, [collapseSheetForMap]);

  const clearFocus = useCallback(() => setFocusedRouteId(null), []);

  // First tap focuses the route on the map; tapping the focused route opens it.
  const handleSelect = useCallback((route: Route) => {
    if (focusedRouteId === route.id) openRoute(route);
    else focusRoute(route);
    // openRoute reads latest currentLocation via closure; safe here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedRouteId, focusRoute]);

  const handleCityChange = (city: City) => {
    onCityChange(city);
    setMapReady(false);
  };

  const flyToCoordinate = (coord: Coordinate) => {
    mapRef.current?.animateToRegion({
      latitude: coord.lat,
      longitude: coord.lng,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 600);
  };

  const applyLocation = (coord: Coordinate) => {
    setCurrentLocation(coord);
    flyToCoordinate(coord);
  };

  const handleUseCurrentLocation = async () => {
    const requestId = ++locationRequestRef.current;
    setLocationLoading(true);
    setLocationError(null);
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;
      if (status !== 'granted') {
        ({ status } = await Location.requestForegroundPermissionsAsync());
      }
      if (status !== 'granted') {
        setLocationError('Location needed to start from where you are');
        Alert.alert(
          'Location access',
          'Allow location so you can start a run from your current spot.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }

      const pos = await getQuickPosition();
      if (requestId !== locationRequestRef.current) return;

      applyLocation(toCoordinate(pos));
      setLocationLoading(false);

      const ageMs = Date.now() - pos.timestamp;
      if (ageMs > 30_000) {
        void refinePosition(fresh => {
          if (requestId !== locationRequestRef.current) return;
          applyLocation(toCoordinate(fresh));
        });
      }
    } catch {
      if (requestId !== locationRequestRef.current) return;
      setLocationError('Could not find you — try stepping outside');
    } finally {
      if (requestId === locationRequestRef.current) {
        setLocationLoading(false);
      }
    }
  };

  const handleClearLocation = () => {
    setCurrentLocation(null);
    setLocationError(null);
    fitAllRoutes();
  };

  const renderRouteCard = (route: Route, cond: RouteCondition) => {
    const isRecommended = selectedCity.recommendedRouteIds?.includes(route.id);
    const isFocused = route.id === focusedRouteId;
    return (
      <TouchableOpacity
        key={route.id}
        style={[styles.routeCard, isFocused && styles.routeCardFocused]}
        onPress={() => handleSelect(route)}
        activeOpacity={0.8}
      >
        <View style={styles.distBadge}>
          <Text style={styles.distValue}>{route.distanceKm}</Text>
          <Text style={styles.distUnit}>km</Text>
        </View>
        <View style={styles.routeCardBody}>
          <View style={styles.routeNameRow}>
            {isRecommended && <Text style={styles.recStar}>★</Text>}
            <Text style={styles.routeName} numberOfLines={1}>{route.name}</Text>
          </View>
          <Text style={styles.routeMeta} numberOfLines={1}>
            {routeShapeLabel(route)} · {route.pois.length} stops
          </Text>
          <ConditionPill rating={cond.rating} label={cond.label} reason={cond.reason} variant="list" />
          <RouteTraitChips route={route} city={selectedCity} variant="list" max={3} />
        </View>
        {isFocused && <Text style={styles.cardOpenHint}>Tap again to open →</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Full-screen map — calm pins, one route drawn at a time */}
      <MapCanvas
        key={selectedCity.id}
        ref={mapRef}
        containerStyle={styles.map}
        provider={MAP_PROVIDER}
        initialRegion={selectedCity.mapRegion}
        mapType="standard"
        showsUserLocation={false}
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled={false}
        cacheEnabled={Platform.OS === 'android'}
        onMapReady={() => setMapReady(true)}
        onPress={() => { clearFocus(); collapseSheetForMap(); }}
      >
        {focusedRoute && (
          <RouteOverlay key={`focus-${focusedRoute.id}`} route={focusedRoute} focus="solo" maxPoints={120} />
        )}
        {filteredRoutes.map(route => (
          <RoutePin
            key={route.id}
            coord={route.startLocation}
            focused={route.id === focusedRouteId}
            onPress={() => openRoute(route)}
          />
        ))}
        {currentLocation && (
          <Circle
            center={{ latitude: currentLocation.lat, longitude: currentLocation.lng }}
            radius={14}
            fillColor="#4285F4"
            strokeColor="#FFFFFF"
            strokeWidth={2}
            zIndex={20}
          />
        )}
      </MapCanvas>

      {/* Floating top bar */}
      <SafeAreaView style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <View style={styles.topBarRow}>
            <Text style={styles.appName}>RunCast</Text>
            <TouchableOpacity style={styles.topAction} onPress={onOpenMyRuns} activeOpacity={0.8}>
              <Text style={styles.topActionText}>My runs</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.cityRow}>
            {CITIES.map(city => (
              <TouchableOpacity
                key={city.id}
                style={[styles.cityChip, selectedCity.id === city.id && styles.cityChipActive]}
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
          </View>
        </View>
        <View style={styles.weatherFloat}>
          <WeatherBar
            weather={weather}
            loading={loading}
            error={error}
            variant="compact"
            embedded
            locationLabel={`${filteredRoutes.length} routes`}
          />
        </View>
      </SafeAreaView>

      {/* Focused-route preview — opens the route */}
      {focusedRoute && (
        <Animated.View style={[styles.previewCard, { bottom: Animated.add(sheetHeight, 14) }]}>
          <TouchableOpacity
            style={styles.previewMain}
            onPress={() => openRoute(focusedRoute)}
            activeOpacity={0.85}
          >
            <View style={styles.previewDist}>
              <Text style={styles.distValue}>{focusedRoute.distanceKm}</Text>
              <Text style={styles.distUnit}>km</Text>
            </View>
            <View style={styles.previewBody}>
              <Text style={styles.previewName} numberOfLines={1}>{focusedRoute.name}</Text>
              <ConditionPill
                {...scoreRouteConditions(focusedRoute, selectedCity, weatherByRoute.get(focusedRoute.id) ?? null)}
                variant="list"
              />
            </View>
            <Text style={styles.previewGo}>View →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.previewClose} onPress={clearFocus} hitSlop={8}>
            <Text style={styles.previewCloseText}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {!focusedRouteId && (
        <Animated.View style={[styles.recordPill, { bottom: Animated.add(sheetHeight, 14) }]}>
          <TouchableOpacity
            style={styles.recordPillInner}
            onPress={onRecord}
            activeOpacity={0.85}
          >
            <View style={styles.recordDot} />
            <Text style={styles.recordPillText}>Record a run</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {!focusedRouteId && (
        <Animated.View
          style={[
            styles.locateFab,
            currentLocation && styles.locateFabActive,
            { bottom: Animated.add(sheetHeight, 14) },
          ]}
        >
          <TouchableOpacity
            style={styles.locateFabInner}
            onPress={currentLocation ? handleClearLocation : handleUseCurrentLocation}
            disabled={locationLoading}
            activeOpacity={0.85}
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color={C.amber} />
            ) : (
              <Text style={styles.locateFabIcon}>{currentLocation ? '✕' : '◎'}</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Bottom sheet — draggable route drawer */}
      <Animated.View style={[styles.sheet, { height: sheetHeight }]}>
        <View style={styles.sheetDragZone} {...sheetPan.panHandlers}>
          <View style={styles.sheetHandleHit}>
            <View style={styles.sheetHandle} />
          </View>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{selectedCity.name}</Text>
            <Text style={styles.sheetCount}>{filteredRoutes.length} routes</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {SHAPE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.filterChip, routeShape === opt.id && styles.filterChipActive]}
              onPress={() => setRouteShape(opt.id)}
            >
              <Text style={[
                styles.filterChipText,
                routeShape === opt.id && styles.filterChipTextActive,
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {locationError ? (
          <Text style={styles.locationError}>{locationError}</Text>
        ) : null}

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {grouped.total === 0 ? (
            <Text style={styles.emptyText}>No routes match this filter.</Text>
          ) : (
            <>
              {grouped.great.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>Great right now</Text>
                  {grouped.great.map(s => renderRouteCard(s.route, s.cond))}
                </>
              )}
              {grouped.rest.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>
                    {grouped.great.length > 0 ? 'Also worth it' : 'All routes'}
                  </Text>
                  {grouped.rest.map(s => renderRouteCard(s.route, s.cond))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
    gap: 8,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topAction: {
    backgroundColor: 'rgba(13,12,10,0.82)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  topActionText: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
  appName: {
    color: C.amber,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cityRow: { flexDirection: 'row', gap: 8 },
  cityChip: {
    backgroundColor: 'rgba(13,12,10,0.82)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.border,
  },
  cityChipActive: {
    borderColor: 'rgba(245,166,35,0.45)',
    backgroundColor: 'rgba(30,27,23,0.92)',
  },
  cityChipText:       { color: C.textSecondary, fontSize: 13, fontWeight: '600' },
  cityChipTextActive: { color: C.amber },

  weatherFloat: {
    marginHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(13,12,10,0.88)',
    borderWidth: 1,
    borderColor: C.border,
  },

  previewCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,18,16,0.97)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.35)',
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
  },
  previewMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  previewDist: {
    width: 46,
    height: 46,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBody: { flex: 1, minWidth: 0, gap: 4 },
  previewName: { color: C.white, fontSize: 15, fontWeight: '700' },
  previewGo: { color: C.amber, fontSize: 13, fontWeight: '800' },
  previewClose: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginLeft: 2,
  },
  previewCloseText: { color: C.textTertiary, fontSize: 14, fontWeight: '700' },

  recordPill: {
    position: 'absolute',
    left: 14,
    zIndex: 6,
  },
  recordPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: C.amber,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  recordDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0D0C0A' },
  recordPillText: { color: '#0D0C0A', fontSize: 14, fontWeight: '800' },

  locateFab: {
    position: 'absolute',
    right: 14,
    zIndex: 5,
  },
  locateFabInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13,12,10,0.92)',
    borderWidth: 1,
    borderColor: C.border,
  },
  locateFabActive: {
    borderColor: 'rgba(66,133,244,0.5)',
  },
  locateFabIcon: { color: C.amber, fontSize: 18, fontWeight: '700' },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: C.sheet,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 16,
    paddingBottom: Platform.OS === 'ios' ? 8 : 4,
  },
  sheetDragZone: {
    paddingTop: 4,
  },
  sheetHandleHit: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  sheetTitle: {
    color: C.white,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sheetCount: {
    color: C.textTertiary,
    fontSize: 13,
    fontWeight: '600',
  },

  filterScroll: { flexGrow: 0, marginBottom: 6 },
  filterRow: { paddingHorizontal: 16, gap: 6 },
  filterChip: {
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterChipActive: {
    borderColor: 'rgba(245,166,35,0.35)',
    backgroundColor: 'rgba(245,166,35,0.1)',
  },
  filterChipText:       { color: C.textSecondary, fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: C.amber },

  locationError: {
    color: C.danger,
    fontSize: 12,
    paddingHorizontal: 18,
    paddingBottom: 4,
  },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 14, paddingBottom: 8, gap: 8 },

  emptyText: {
    color: C.textTertiary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  sectionHeader: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  routeCardFocused: {
    borderColor: 'rgba(245,166,35,0.55)',
    backgroundColor: 'rgba(245,166,35,0.06)',
  },
  cardOpenHint: {
    position: 'absolute',
    top: 10,
    right: 12,
    color: C.amber,
    fontSize: 11,
    fontWeight: '700',
  },
  distBadge: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distValue: {
    color: C.white,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 20,
  },
  distUnit: {
    color: C.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  routeCardBody: { flex: 1, minWidth: 0, gap: 4 },
  routeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
  recStar: { color: C.amber, fontSize: 12, flexShrink: 0 },
  routeName: {
    color: C.white,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  routeMeta: {
    color: C.textTertiary,
    fontSize: 12,
    fontWeight: '500',
  },
});
