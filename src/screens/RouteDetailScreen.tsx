import React, { useRef, useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  Alert,
  Image,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Polyline, Circle, Marker } from 'react-native-maps';
import { MAP_PROVIDER } from '../utils/mapProvider';
import MapCanvas from '../components/MapCanvas';
import WeatherBar from '../components/WeatherBar';
import RouteFacts from '../components/RouteFacts';
import RouteTraitChips from '../components/RouteTraitChips';
import ConditionPill from '../components/ConditionPill';
import ElevationProfile from '../components/ElevationProfile';
import StarRating from '../components/StarRating';
import { useWeather } from '../hooks/useWeather';
import { useElevation } from '../hooks/useElevation';
import { useRatings } from '../hooks/useRatings';
import { useRoutePhotos } from '../hooks/useRoutePhotos';
import { exportRouteGpx } from '../utils/exportRoute';
import { scoreRouteConditions } from '../utils/routeConditions';
import { Route, Mode, Coordinate } from '../data/types';
import { City } from '../data/cities';
import { routeHook, routeRunWarnings } from '../utils/routeSummary';
import { routeShapeLabel } from '../utils/routeLabels';

const C = {
  bg:            '#0D0C0A',
  surface:       '#181612',
  amber:         '#F5A623',
  white:         '#FFFFFF',
  text:          'rgba(255,255,255,0.88)',
  textSecondary: 'rgba(255,255,255,0.52)',
  textTertiary:  'rgba(255,255,255,0.28)',
  border:        'rgba(255,255,255,0.09)',
  warn:          '#FF9F43',
};

const MODE_META: Record<Mode, { label: string; color: string }> = {
  history:     { label: 'History',     color: '#E8834A' },
  food:        { label: 'Food',        color: '#4CAF50' },
  sightseeing: { label: 'Views',       color: '#2196F3' },
  local:       { label: 'Local',       color: '#9C27B0' },
};

interface Props {
  route: Route;
  city: City;
  startOverride: Coordinate | null;
  selectedMode: Mode;
  onModeChange: (mode: Mode) => void;
  onStart: () => void;
  onSimulate: () => void;
  onBack: () => void;
}

function modesAvailable(route: Route): Mode[] {
  return (['history', 'food', 'sightseeing', 'local'] as Mode[]).filter(
    m => route.pois.some(p => !!p.clips[m]),
  );
}

export default function RouteDetailScreen({
  route,
  city,
  startOverride,
  selectedMode,
  onModeChange,
  onStart,
  onSimulate,
  onBack,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const fullMapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const { height: screenHeight } = useWindowDimensions();
  const available = modesAvailable(route);
  const warnings = routeRunWarnings(route, city);
  const mapHeight = Math.min(screenHeight * 0.32, 260);

  useEffect(() => {
    setMapReady(false);
    setMapFullscreen(false);
  }, [route.id]);

  const lats = route.coordinates.map(c => c.lat);
  const lngs = route.coordinates.map(c => c.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const lngDelta = Math.max((maxLng - minLng) * 1.4, 0.015);
  const mapRegion = {
    latitude:      (minLat + maxLat) / 2,
    longitude:     (minLng + maxLng) / 2,
    latitudeDelta:  Math.max((maxLat - minLat) * 1.4, lngDelta * 0.5, 0.015),
    longitudeDelta: lngDelta,
  };

  const startCoord = startOverride ?? route.startLocation;

  const { weather, loading: weatherLoading, error: weatherError } = useWeather({
    city,
    at: startCoord,
    cacheKey: route.id,
  });

  const condition = useMemo(
    () => scoreRouteConditions(route, city, weather),
    [route, city, weather],
  );

  const { elevation } = useElevation(route.coordinates, route.id);
  const { routeRating, rateRoute } = useRatings();
  const yourRating = routeRating(route.id) ?? 0;
  const { photos } = useRoutePhotos(route.id);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    const res = await exportRouteGpx(route);
    setExporting(false);
    if (!res.ok) {
      Alert.alert(
        res.reason === 'unavailable' ? 'Sharing unavailable' : 'Export failed',
        res.reason === 'unavailable'
          ? "Sharing isn't available on this device."
          : 'Could not create the GPX file — please try again.',
      );
    }
  };

  const lineCoords = useMemo(
    () => route.coordinates.map(c => ({ latitude: c.lat, longitude: c.lng })),
    [route.coordinates],
  );

  useEffect(() => {
    if (!mapReady || lineCoords.length < 2) return;
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(lineCoords, {
        edgePadding: { top: 32, right: 32, bottom: 32, left: 32 },
        animated: false,
      });
    }, 80);
    return () => clearTimeout(t);
  }, [mapReady, lineCoords, route.id]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Floating back — stays put while the map scrolls away */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>

      {/* Everything scrolls — map included — so content can use the full screen */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.mapBlock, { height: mapHeight }]}>
          <MapCanvas
            key={route.id}
            ref={mapRef}
            containerStyle={styles.mapFill}
            provider={MAP_PROVIDER}
            initialRegion={mapRegion}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            showsCompass={false}
            mapType="standard"
            cacheEnabled={Platform.OS === 'android'}
            onMapReady={() => setMapReady(true)}
            onPress={() => setMapFullscreen(true)}
          >
            <Polyline
              coordinates={lineCoords}
              strokeColor={C.amber}
              strokeWidth={4}
              lineCap="round"
              lineJoin="round"
              tappable={false}
            />
            <Circle
              center={{ latitude: startCoord.lat, longitude: startCoord.lng }}
              radius={18}
              fillColor={C.amber}
              strokeColor="#FFFFFF"
              strokeWidth={2}
            />
          </MapCanvas>
          <TouchableOpacity
            style={styles.mapHint}
            onPress={() => setMapFullscreen(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.mapHintText}>⤢ Tap to explore the map</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentPad}>
        {/* Hero — answers "what is this & should I run it now" at a glance */}
        <View style={styles.titleBlock}>
          <Text style={styles.routeName}>{route.name}</Text>
          <Text style={styles.routeMeta}>
            {route.distanceKm} km · {routeShapeLabel(route)} · {route.pois.length} stops
          </Text>
        </View>

        <ConditionPill
          rating={condition.rating}
          label={condition.label}
          reason={condition.reason}
          variant="detail"
        />

        <WeatherBar
          weather={weather}
          loading={weatherLoading}
          error={weatherError}
          variant="detail"
          embedded
        />

        {startOverride && (
          <Text style={styles.pinNote}>Starting from your current location</Text>
        )}

        <Text style={styles.hook}>{routeHook(route)}</Text>

        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>
            {yourRating > 0 ? 'Your rating' : 'Rate this route'}
          </Text>
          <StarRating value={yourRating} onRate={n => rateRoute(route.id, n)} size={22} />
        </View>

        <RouteTraitChips route={route} city={city} variant="detail" />

        {warnings.length > 0 && (
          <View style={styles.warnRow}>
            {warnings.map(w => (
              <View key={w} style={styles.warnChip}>
                <Text style={styles.warnText}>{w}</Text>
              </View>
            ))}
          </View>
        )}

        {elevation && elevation.points.length > 1 && (
          <View style={styles.elevCard}>
            <View style={styles.elevHeader}>
              <Text style={styles.elevTitle}>Elevation</Text>
              <Text style={styles.elevStat}>
                ↑ {elevation.gainM} m · ↓ {elevation.lossM} m
              </Text>
            </View>
            <ElevationProfile
              elevation={elevation}
              distanceKm={0}
              totalDistanceKm={route.distanceKm}
            />
          </View>
        )}

        {photos.length > 0 && (
          <View style={styles.photoSection}>
            <Text style={styles.photoSectionTitle}>Your photos</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoStrip}
            >
              {photos.map(uri => (
                <Image key={uri} source={{ uri }} style={styles.photoThumb} />
              ))}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity
          style={styles.exportCard}
          onPress={handleExport}
          activeOpacity={0.85}
          disabled={exporting}
        >
          <Text style={styles.exportIcon}>⌚</Text>
          <View style={styles.exportTextBlock}>
            <Text style={styles.exportTitle}>
              {exporting ? 'Preparing GPX…' : 'Export to watch'}
            </Text>
            <Text style={styles.exportSub}>Open in Garmin, Strava, or send to your watch</Text>
          </View>
          <Text style={styles.exportChevron}>⤴</Text>
        </TouchableOpacity>

        <RouteFacts route={route} city={city} />
        </View>
      </ScrollView>

      {/* Pinned action footer */}
      <View style={styles.startBar}>
        <Text style={styles.footerLabel}>What to hear</Text>
        <View style={styles.modeRow}>
          {(Object.keys(MODE_META) as Mode[]).map(m => {
            const hasAudio = available.includes(m);
            const selected = selectedMode === m;
            const { label, color } = MODE_META[m];
            return (
              <TouchableOpacity
                key={m}
                disabled={!hasAudio}
                onPress={() => onModeChange(m)}
                style={[
                  styles.modeChip,
                  hasAudio && selected && { borderColor: color, backgroundColor: color + '22' },
                  !hasAudio && styles.modeChipOff,
                ]}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.modeChipText,
                  hasAudio && selected && { color: C.white, fontWeight: '800' },
                  !hasAudio && { color: C.textTertiary },
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.startBtn} onPress={onStart} activeOpacity={0.85}>
          <Text style={styles.startBtnText}>Start run</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.simLink} onPress={onSimulate} activeOpacity={0.7}>
          <Text style={styles.simLinkText}>Try without GPS</Text>
        </TouchableOpacity>
      </View>

      {/* Full-screen interactive route map */}
      {mapFullscreen && (
        <View style={styles.fullMap}>
          <MapCanvas
            ref={fullMapRef}
            containerStyle={StyleSheet.absoluteFill}
            provider={MAP_PROVIDER}
            initialRegion={mapRegion}
            scrollEnabled
            zoomEnabled
            rotateEnabled
            pitchEnabled={false}
            showsCompass
            mapType="standard"
            onMapReady={() => {
              setTimeout(() => {
                fullMapRef.current?.fitToCoordinates(lineCoords, {
                  edgePadding: { top: 100, right: 60, bottom: 120, left: 60 },
                  animated: false,
                });
              }, 60);
            }}
          >
            <Polyline
              coordinates={lineCoords}
              strokeColor={C.amber}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
            <Circle
              center={{ latitude: startCoord.lat, longitude: startCoord.lng }}
              radius={16}
              fillColor={C.amber}
              strokeColor="#FFFFFF"
              strokeWidth={2}
            />
            {route.pois.filter(p => p.location && typeof p.location.lat === 'number').map(p => (
              <Marker
                key={p.id}
                coordinate={{ latitude: p.location.lat, longitude: p.location.lng }}
                title={p.name}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={styles.poiPin} />
              </Marker>
            ))}
          </MapCanvas>
          <SafeAreaView style={styles.fullTop} pointerEvents="box-none">
            <View style={styles.fullBar} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.fullClose}
                onPress={() => setMapFullscreen(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.fullCloseText}>✕ Close</Text>
              </TouchableOpacity>
              <Text style={styles.fullTitle} numberOfLines={1}>{route.name}</Text>
            </View>
          </SafeAreaView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, backgroundColor: C.bg },

  mapBlock: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  mapFill: { flex: 1 },
  mapHint: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(13,12,10,0.82)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  mapHintText: { color: C.amber, fontSize: 12, fontWeight: '700' },

  fullMap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    backgroundColor: C.bg,
  },
  fullTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  fullBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  fullClose: {
    backgroundColor: 'rgba(13,12,10,0.88)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  fullCloseText: { color: C.text, fontSize: 14, fontWeight: '700' },
  fullTitle: {
    flex: 1,
    color: C.white,
    fontSize: 15,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  poiPin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: C.amber,
  },
  backBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 20,
    backgroundColor: 'rgba(13,12,10,0.82)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.border,
  },
  backBtnText: { color: C.text, fontSize: 13, fontWeight: '700' },

  body: { flex: 1, minHeight: 0 },
  bodyContent: { paddingBottom: 20 },
  contentPad: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },

  titleBlock: { gap: 3 },
  routeName: {
    color: C.white,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  routeMeta: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },

  pinNote: {
    color: '#9EC5FF',
    fontSize: 12,
  },
  hook: {
    color: C.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },

  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rateLabel: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },

  warnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  warnChip: {
    backgroundColor: 'rgba(255,159,67,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,159,67,0.3)',
  },
  warnText: { color: C.warn, fontSize: 12, fontWeight: '600' },

  elevCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  elevHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  elevTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  elevStat: { color: C.amber, fontSize: 12, fontWeight: '700' },

  exportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  photoSection: { gap: 8 },
  photoSectionTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  photoStrip: { gap: 8, paddingRight: 4 },
  photoThumb: {
    width: 110,
    height: 110,
    borderRadius: 10,
    backgroundColor: C.surface,
  },

  exportIcon: { fontSize: 20 },
  exportTextBlock: { flex: 1, minWidth: 0, gap: 2 },
  exportTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  exportSub: { color: C.textSecondary, fontSize: 12, fontWeight: '500' },
  exportChevron: { color: C.amber, fontSize: 18, fontWeight: '700' },

  startBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
    gap: 10,
  },
  footerLabel: {
    color: C.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  modeChipOff: { opacity: 0.4 },
  modeChipText: { color: C.textSecondary, fontSize: 13, fontWeight: '600' },

  startBtn: {
    backgroundColor: C.amber,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#0D0C0A',
    fontSize: 16,
    fontWeight: '800',
  },
  simLink: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  simLinkText: {
    color: C.textTertiary,
    fontSize: 12,
  },
});
