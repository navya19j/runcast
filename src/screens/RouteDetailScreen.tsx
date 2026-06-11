import React, { useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { MAP_PROVIDER } from '../utils/mapProvider';
import MapCanvas from '../components/MapCanvas';
import WeatherBar from '../components/WeatherBar';
import { useWeather } from '../hooks/useWeather';
import { Route, Mode, Coordinate } from '../data/types';
import { City } from '../data/cities';

const C = {
  bg:            '#0D0C0A',
  surface:       '#181612',
  surfaceRaised: '#221F1A',
  amber:         '#F5A623',
  amberDim:      'rgba(245,166,35,0.12)',
  amberBorder:   'rgba(245,166,35,0.22)',
  white:         '#FFFFFF',
  text:          'rgba(255,255,255,0.88)',
  textSecondary: 'rgba(255,255,255,0.52)',
  textTertiary:  'rgba(255,255,255,0.28)',
  border:        'rgba(255,255,255,0.09)',
  green:         '#4CAF50',
  greenDim:      'rgba(76,175,80,0.12)',
  red:           '#FF5252',
  redDim:        'rgba(255,82,82,0.12)',
};

const MODE_META: Record<Mode, { label: string; color: string }> = {
  history:     { label: 'History',     color: '#E8834A' },
  food:        { label: 'Food',        color: '#4CAF50' },
  sightseeing: { label: 'Sightseeing', color: '#2196F3' },
  local:       { label: 'Local life',  color: '#9C27B0' },
};

interface Props {
  route: Route;
  city: City;
  startOverride: Coordinate | null;
  onStart: () => void;
  onBack: () => void;
}

// ── Small helpers ────────────────────────────────────────────────────────────

function Label({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function Row({ icon, label, value, valueColor }: {
  icon: string; label: string; value?: string | null; valueColor?: string;
}) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function Tag({ text, dim }: { text: string; dim?: boolean }) {
  return (
    <View style={[styles.tag, dim && styles.tagDim]}>
      <Text style={[styles.tagText, dim && styles.tagTextDim]}>{text}</Text>
    </View>
  );
}

function SafetyDot({ ok }: { ok: boolean }) {
  return (
    <View style={[styles.safetyDot, { backgroundColor: ok ? C.green : C.red }]} />
  );
}

// ── Available audio modes for this route ─────────────────────────────────────

function modesAvailable(route: Route): Mode[] {
  const modes: Mode[] = ['history', 'food', 'sightseeing', 'local'];
  return modes.filter(m => route.pois.some(p => !!p.clips[m]));
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function RouteDetailScreen({ route, city, startOverride, onStart, onBack }: Props) {
  const mapRef = useRef<MapView>(null);
  const available = modesAvailable(route);

  // Compute bounding region for the route
  const lats = route.coordinates.map(c => c.lat);
  const lngs = route.coordinates.map(c => c.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const mapRegion = {
    latitude:      (minLat + maxLat) / 2,
    longitude:     (minLng + maxLng) / 2,
    latitudeDelta:  (maxLat - minLat) * 1.4,
    longitudeDelta: (maxLng - minLng) * 1.4,
  };

  const startCoord = startOverride ?? route.startLocation;

  const { weather, loading: weatherLoading, error: weatherError } = useWeather({
    city,
    at: startCoord,
    cacheKey: route.id,
  });

  const lineCoords = useMemo(
    () => route.coordinates.map(c => ({ latitude: c.lat, longitude: c.lng })),
    [route.coordinates],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* ── Map preview ─────────────────────────────────────────────────── */}
      <View style={styles.mapContainer}>
        <MapCanvas
          ref={mapRef}
          containerStyle={styles.mapFill}
          provider={MAP_PROVIDER}
          initialRegion={mapRegion}
          scrollEnabled
          zoomEnabled
          zoomTapEnabled
          rotateEnabled
          pitchEnabled={false}
          showsCompass
          moveOnMarkerPress={false}
          mapType="standard"
          cacheEnabled={Platform.OS === 'android'}
        >
          <Polyline
            coordinates={lineCoords}
            strokeColor={C.amber}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
            tappable={false}
          />
          <Marker
            coordinate={{ latitude: startCoord.lat, longitude: startCoord.lng }}
            pinColor="#00C853"
            title="Start"
            tracksViewChanges={false}
            tappable={false}
          />
        </MapCanvas>

        {/* Back button overlaid on map */}
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <Text style={styles.backBtnText}>← {city.name}</Text>
        </TouchableOpacity>

        {/* Route name card floating on bottom of map */}
        <View style={styles.mapCard} pointerEvents="none">
          <View style={styles.mapCardLeft}>
            <Text style={styles.mapCardName}>{route.name}</Text>
            <View style={styles.mapCardPills}>
              <Tag text={`${route.distanceKm} km`} />
              {route.loop !== undefined && (
                <Tag text={route.loop ? 'Loop' : 'One way'} dim />
              )}
              {route.elevationGainM !== undefined && (
                <Tag text={`↑${route.elevationGainM}m`} dim />
              )}
            </View>
          </View>
        </View>
      </View>

      {/* ── Scrollable detail body ───────────────────────────────────────── */}
      <WeatherBar
        weather={weather}
        loading={weatherLoading}
        error={weatherError}
        locationLabel={route.name}
        subtitle="Conditions at route start"
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <Text style={styles.description}>{route.description}</Text>

        {/* ── Audio channels ──────────────────────────────────────────── */}
        <Label text="Audio channels" />
        <View style={styles.modeRow}>
          {(Object.keys(MODE_META) as Mode[]).map(m => {
            const active = available.includes(m);
            const { label, color } = MODE_META[m];
            return (
              <View key={m} style={[styles.modeChip, active && { borderColor: color + '55', backgroundColor: color + '11' }]}>
                <View style={[styles.modeDot, { backgroundColor: active ? color : C.textTertiary }]} />
                <Text style={[styles.modeChipText, { color: active ? C.text : C.textTertiary }]}>{label}</Text>
              </View>
            );
          })}
        </View>

        {/* ── Terrain ─────────────────────────────────────────────────── */}
        {(route.surface || route.gradientCharacter || route.shade || route.bestTime) && (
          <>
            <Label text="Terrain" />
            <View style={styles.card}>
              <Row icon="🏃" label="Surface"   value={route.surface} />
              <Row icon="⛰️" label="Gradient"  value={route.gradientCharacter} />
              <Row icon="🌿" label="Shade"      value={route.shade} />
              <Row icon="⏰" label="Best time"  value={route.bestTime} />
              <Row icon="🌤️" label="Season"    value={route.bestSeason} />
            </View>
          </>
        )}

        {/* ── Safety & logistics ──────────────────────────────────────── */}
        {(route.soloFemaleSafe !== undefined || route.waterOnRoute !== undefined || route.lighting) && (
          <>
            <Label text="Safety & logistics" />
            <View style={styles.card}>
              {route.soloFemaleSafe !== undefined && (
                <View style={styles.safetyRow}>
                  <SafetyDot ok={route.soloFemaleSafe} />
                  <Text style={styles.safetyText}>
                    {route.soloFemaleSafe ? 'Solo-friendly at any hour' : 'Prefer daytime / company'}
                  </Text>
                </View>
              )}
              {route.headphonesSafe !== undefined && (
                <View style={styles.safetyRow}>
                  <SafetyDot ok={route.headphonesSafe} />
                  <Text style={styles.safetyText}>
                    {route.headphonesSafe ? 'Headphones safe' : 'Stay aware — traffic or crowds'}
                  </Text>
                </View>
              )}
              {route.waterOnRoute !== undefined && (
                <View style={styles.safetyRow}>
                  <SafetyDot ok={route.waterOnRoute} />
                  <Text style={styles.safetyText}>
                    {route.waterOnRoute ? 'Water available on route' : 'Carry water — none on route'}
                  </Text>
                </View>
              )}
              {route.restroomsOnRoute !== undefined && (
                <View style={styles.safetyRow}>
                  <SafetyDot ok={route.restroomsOnRoute} />
                  <Text style={styles.safetyText}>
                    {route.restroomsOnRoute ? 'Restrooms on route' : 'No restrooms on route'}
                  </Text>
                </View>
              )}
              {route.lighting && (
                <Row icon="💡" label="Lighting" value={route.lighting} />
              )}
              {route.heatWarning && route.heatWarning !== 'low' && (
                <Row icon="🌡️" label="Heat" value={route.heatWarning === 'high' ? 'High — carry extra water' : 'Moderate — go early or late'} valueColor={route.heatWarning === 'high' ? C.red : C.amber} />
              )}
            </View>
          </>
        )}

        {/* ── Getting there ───────────────────────────────────────────── */}
        {(route.transitToStart || route.postRunFood) && (
          <>
            <Label text="Getting there & after" />
            <View style={styles.card}>
              <Row icon="🚇" label="Transit"    value={route.transitToStart} />
              <Row icon="🍳" label="Post-run"   value={route.postRunFood} />
            </View>
          </>
        )}

        {/* ── Local knowledge ─────────────────────────────────────────── */}
        {(route.localTip || route.instagramMoment || route.historicalHook || route.neighbourhoodVibe) && (
          <>
            <Label text="Local knowledge" />
            <View style={styles.card}>
              {route.localTip && (
                <View style={styles.tipBlock}>
                  <Text style={styles.tipIcon}>💬</Text>
                  <Text style={styles.tipText}>{route.localTip}</Text>
                </View>
              )}
              {route.instagramMoment && (
                <View style={styles.tipBlock}>
                  <Text style={styles.tipIcon}>📸</Text>
                  <Text style={styles.tipText}>{route.instagramMoment}</Text>
                </View>
              )}
              {route.historicalHook && (
                <View style={styles.tipBlock}>
                  <Text style={styles.tipIcon}>🏛️</Text>
                  <Text style={styles.tipText}>{route.historicalHook}</Text>
                </View>
              )}
              {route.neighbourhoodVibe && (
                <View style={styles.tipBlock}>
                  <Text style={styles.tipIcon}>🏘️</Text>
                  <Text style={styles.tipText}>{route.neighbourhoodVibe}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* ── Landmarks ───────────────────────────────────────────────── */}
        {route.landmarks && route.landmarks.length > 0 && (
          <>
            <Label text="Landmarks en route" />
            <View style={styles.landmarkRow}>
              {route.landmarks.map((l, i) => (
                <View key={i} style={styles.landmarkChip}>
                  <Text style={styles.landmarkText}>{l}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Community ───────────────────────────────────────────────── */}
        {(route.communityRating || (route.runClubUsage && route.runClubUsage.length > 0)) && (
          <>
            <Label text="Community" />
            <View style={styles.card}>
              {route.communityRating && (
                <Row icon="⭐" label="Rating" value={`${route.communityRating.toFixed(1)} / 5`} valueColor={C.amber} />
              )}
              {route.runClubUsage && route.runClubUsage.length > 0 && (
                <Row icon="👥" label="Used by" value={route.runClubUsage.join(', ')} />
              )}
            </View>
          </>
        )}

        {/* bottom padding for Start button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Sticky Start Run button ──────────────────────────────────────── */}
      <View style={styles.startBar}>
        <TouchableOpacity style={styles.startBtn} onPress={onStart} activeOpacity={0.85}>
          <Text style={styles.startBtnText}>Start Run  →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Map preview
  mapContainer: { height: 240, position: 'relative' },
  mapFill: { flex: 1 },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(13,12,10,0.75)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.border,
  },
  backBtnText: { color: C.text, fontSize: 13, fontWeight: '600' },
  mapCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13,12,10,0.88)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  mapCardLeft: { gap: 6 },
  mapCardName: { color: C.white, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  mapCardPills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },

  // Body
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 16, gap: 4 },

  description: {
    color: C.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },

  sectionLabel: {
    color: C.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 6,
  },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 4,
    paddingHorizontal: 12,
    gap: 2,
  },

  // Row inside card
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowIcon:  { fontSize: 14, width: 20, textAlign: 'center' },
  rowLabel: { color: C.textSecondary, fontSize: 13, flex: 1 },
  rowValue: { color: C.text, fontSize: 13, fontWeight: '500', textAlign: 'right', flexShrink: 1, maxWidth: '55%' },

  // Safety rows
  safetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  safetyDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  safetyText: { color: C.text, fontSize: 13, flex: 1 },

  // Tip blocks (local knowledge)
  tipBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 9,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tipIcon: { fontSize: 14, marginTop: 1 },
  tipText: { color: C.textSecondary, fontSize: 13, lineHeight: 19, flex: 1 },

  // Mode chips
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
    borderWidth: 1,
    borderColor: C.border,
  },
  modeDot: { width: 6, height: 6, borderRadius: 3 },
  modeChipText: { fontSize: 12, fontWeight: '600' },

  // Tags
  tag: {
    backgroundColor: C.amberDim,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.amberBorder,
  },
  tagDim: {
    backgroundColor: C.surface,
    borderColor: C.border,
  },
  tagText: { color: C.amber, fontSize: 12, fontWeight: '700' },
  tagTextDim: { color: C.textSecondary },

  // Landmarks
  landmarkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  landmarkChip: {
    backgroundColor: C.surfaceRaised,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.border,
  },
  landmarkText: { color: C.textSecondary, fontSize: 12 },

  // Start bar
  startBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
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
    letterSpacing: -0.3,
  },
});
