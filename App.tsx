import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import RunMap from './src/components/RunMap';
import NowPlaying from './src/components/NowPlaying';
import HomeScreen from './src/screens/HomeScreen';
import { useGPS } from './src/hooks/useGPS';
import { useAudio } from './src/hooks/useAudio';
import { useProximity } from './src/hooks/useProximity';
import SF_EMBARCADERO_ROUTE from './src/data/routes/sf_embarcadero';
import { CITIES } from './src/data/cities';
import { Mode, POI, Route, RunState } from './src/data/types';
import { City } from './src/data/cities';

const MODES: { id: Mode; label: string; description: string }[] = [
  { id: 'history',     label: 'History',     description: 'The city\'s bones'    },
  { id: 'food',        label: 'Food',        description: 'What to eat & drink'  },
  { id: 'sightseeing', label: 'Sightseeing', description: 'Views & moments'      },
  { id: 'local',       label: 'Local Life',  description: 'How it really lives'  },
];

type AppScreen = 'home' | 'run';

export default function App() {
  const [screen, setScreen]           = useState<AppScreen>('home');
  const [activeRoute, setActiveRoute] = useState<Route>(SF_EMBARCADERO_ROUTE);
  const [activeCity, setActiveCity]   = useState<City>(CITIES[0]);

  const [runState, setRunState]         = useState<RunState>('idle');
  const [selectedMode, setSelectedMode] = useState<Mode>('sightseeing');
  const [activePOIId, setActivePOIId] = useState<string | null>(null);
  const proximityResetRef = useRef<(() => void) | null>(null);

  const isActive = runState === 'running';

  const { position, distanceCoveredM, pacingSecPerM, error: gpsError } = useGPS(isActive);
  const { audioState, currentClipName, playClip, stopCurrent } = useAudio();

  const handlePOITrigger = useCallback(
    (poi: POI, audioFile: string) => {
      setActivePOIId(poi.id);
      playClip(audioFile, poi.name);
      // Clear active POI after a bit
      setTimeout(() => setActivePOIId(null), 45000);
    },
    [playClip],
  );

  const { reset: resetProximity } = useProximity({
    position,
    pois: activeRoute.pois,
    mode: selectedMode,
    active: isActive,
    pacingSecPerM,
    onTrigger: handlePOITrigger,
  });

  proximityResetRef.current = resetProximity;

  const handleStartRun = useCallback(() => {
    setRunState('running');
  }, []);

  const handlePauseRun = useCallback(() => {
    setRunState('paused');
    stopCurrent();
  }, [stopCurrent]);

  const handleResumeRun = useCallback(() => {
    setRunState('running');
  }, []);

  const handleStopRun = useCallback(() => {
    setRunState('idle');
    stopCurrent();
    proximityResetRef.current?.();
    setActivePOIId(null);
  }, [stopCurrent]);

  const handleSelectRoute = useCallback((city: City, route: Route) => {
    setActiveCity(city);
    setActiveRoute(route);
    setRunState('idle');
    setActivePOIId(null);
    setScreen('run');
  }, []);

  const formatDistance = (m: number) =>
    m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

  const formatPace = (secPerM: number | null) => {
    if (!secPerM) return '—';
    const secPerKm = secPerM * 1000;
    const min = Math.floor(secPerKm / 60);
    const sec = Math.round(secPerKm % 60);
    return `${min}:${sec.toString().padStart(2, '0')} /km`;
  };

  // Show home screen when not in a run
  if (screen === 'home') {
    return <HomeScreen onSelectRoute={handleSelectRoute} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Map */}
      <View style={styles.mapContainer}>
        <RunMap
          routeCoords={activeRoute.coordinates}
          pois={activeRoute.pois}
          mode={selectedMode}
          userPosition={position}
          activePOIId={activePOIId}
          startLocation={activeRoute.startLocation}
        />
        <NowPlaying
          audioState={audioState}
          clipName={currentClipName}
          mode={selectedMode}
        />

        {/* Route header + back button */}
        <View style={styles.routeHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => { handleStopRun(); setScreen('home'); }}
          >
            <Text style={styles.backButtonText}>← Routes</Text>
          </TouchableOpacity>
          <Text style={styles.routeCity}>{activeRoute.city.toUpperCase()}</Text>
          <Text style={styles.routeName}>{activeRoute.name}</Text>
          <Text style={styles.routeDistance}>{activeRoute.distanceKm} km · {activeRoute.pois.length} landmarks</Text>
        </View>
      </View>

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>

        {/* Live stats when running */}
        {runState !== 'idle' && (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatDistance(distanceCoveredM)}</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatPace(pacingSecPerM)}</Text>
              <Text style={styles.statLabel}>Pace</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {activeRoute.pois.filter(p => p.clips[selectedMode]).length}
              </Text>
              <Text style={styles.statLabel}>Stops</Text>
            </View>
          </View>
        )}

        {/* Mode selector */}
        {runState === 'idle' && (
          <>
            <Text style={styles.sectionLabel}>Your lens</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modeRow}
            >
              {MODES.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.modeChip,
                    selectedMode === m.id && styles.modeChipActive,
                  ]}
                  onPress={() => setSelectedMode(m.id)}
                >
                  <Text
                    style={[
                      styles.modeLabel,
                      selectedMode === m.id && styles.modeLabelActive,
                    ]}
                  >
                    {m.label}
                  </Text>
                  <Text style={[styles.modeDesc, selectedMode === m.id && styles.modeDescActive]}>
                    {m.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* GPS error */}
        {gpsError && (
          <Text style={styles.errorText}>{gpsError}</Text>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {runState === 'idle' && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleStartRun}>
              <Text style={styles.primaryButtonText}>Start Run</Text>
            </TouchableOpacity>
          )}
          {runState === 'running' && (
            <>
              <TouchableOpacity style={styles.secondaryButton} onPress={handlePauseRun}>
                <Text style={styles.secondaryButtonText}>Pause</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stopButton} onPress={() => { handleStopRun(); setScreen('home'); }}>
                <Text style={styles.stopButtonText}>End Run</Text>
              </TouchableOpacity>
            </>
          )}
          {runState === 'paused' && (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={handleResumeRun}>
                <Text style={styles.primaryButtonText}>Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stopButton} onPress={() => { handleStopRun(); setScreen('home'); }}>
                <Text style={styles.stopButtonText}>End Run</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── RunCast design tokens ────────────────────────────────────────────────────
// Warm charcoal (not cold Spotify black, not neutral Runna black)
// Accent: broadcast amber — old radio transmitter meets golden-hour running
const C = {
  bg:            '#0D0C0A',
  surface:       '#181612',
  surfaceRaised: '#221F1A',
  amber:         '#F5A623',   // RunCast's own accent — warm, broadcast, golden
  amberText:     '#0D0C0A',   // text on amber bg
  white:         '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.52)',
  textTertiary:  'rgba(255,255,255,0.28)',
  border:        'rgba(255,255,255,0.09)',
  borderWarm:    'rgba(245,166,35,0.22)',
  danger:        '#FF5252',
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  mapContainer: { flex: 1 },

  // Back button
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backButtonText: {
    color: C.amber,
    fontSize: 13,
    fontWeight: '600',
  },

  // Route header — bottom-left overlay, editorial Strava-weight type
  routeHeader: {
    position: 'absolute',
    bottom: 18,
    left: 16,
    right: 16,
  },
  routeCity: {
    color: C.amber,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  routeName: {
    color: C.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  routeDistance: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    letterSpacing: 0.2,
  },

  // Bottom panel — Spotify-style frosted shelf
  bottomPanel: {
    backgroundColor: C.bg,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 18,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },

  // Stats row — Strava-weight numbers
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  stat:        { alignItems: 'center', flex: 1 },
  statValue:   { color: C.white, fontSize: 24, fontWeight: '800', letterSpacing: -0.8 },
  statLabel:   { color: C.textTertiary, fontSize: 10, fontWeight: '600', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.8 },
  statDivider: { width: 1, height: 30, backgroundColor: C.border },

  // Section label
  sectionLabel: {
    color: C.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },

  // Mode chips — Spotify "channels" feel, amber for active
  modeRow: { gap: 8, paddingBottom: 2 },
  modeChip: {
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  modeChipActive: {
    backgroundColor: C.surfaceRaised,
    borderColor: C.borderWarm,
  },
  modeLabel:       { color: C.textSecondary, fontSize: 13, fontWeight: '600' },
  modeLabelActive: { color: C.amber },
  modeDesc:        { color: C.textTertiary, fontSize: 10, marginTop: 2 },
  modeDescActive:  { color: 'rgba(245,166,35,0.55)' },

  errorText: { color: C.danger, fontSize: 12, textAlign: 'center' },

  // Buttons
  actionRow: { flexDirection: 'row', gap: 10 },

  // Primary: amber fill — the one big action
  primaryButton: {
    flex: 1,
    backgroundColor: C.amber,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  primaryButtonText: { color: C.amberText, fontSize: 16, fontWeight: '800', letterSpacing: 0.1 },

  secondaryButton: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  secondaryButtonText: { color: C.white, fontSize: 16, fontWeight: '600' },

  stopButton: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,82,82,0.4)',
  },
  stopButtonText: { color: C.danger, fontSize: 16, fontWeight: '600' },
});
