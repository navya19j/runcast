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
import { useGPS } from './src/hooks/useGPS';
import { useAudio } from './src/hooks/useAudio';
import { useProximity } from './src/hooks/useProximity';
import SF_EMBARCADERO_ROUTE from './src/data/routes/sf_embarcadero';
import { Mode, POI, RunState } from './src/data/types';

const MODES: { id: Mode; label: string; emoji: string; description: string }[] = [
  { id: 'history',    label: 'History',    emoji: '🏛', description: 'The city\'s bones' },
  { id: 'food',       label: 'Food',       emoji: '🥐', description: 'What to eat after' },
  { id: 'sightseeing',label: 'Sightseeing',emoji: '📸', description: 'Views & moments' },
  { id: 'local',      label: 'Local Life', emoji: '🏘', description: 'How SF really lives' },
];

const ROUTE = SF_EMBARCADERO_ROUTE;

export default function App() {
  const [runState, setRunState] = useState<RunState>('idle');
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
    pois: ROUTE.pois,
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

  const formatDistance = (m: number) =>
    m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

  const formatPace = (secPerM: number | null) => {
    if (!secPerM) return '—';
    const secPerKm = secPerM * 1000;
    const min = Math.floor(secPerKm / 60);
    const sec = Math.round(secPerKm % 60);
    return `${min}:${sec.toString().padStart(2, '0')} /km`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Map */}
      <View style={styles.mapContainer}>
        <RunMap
          routeCoords={ROUTE.coordinates}
          pois={ROUTE.pois}
          mode={selectedMode}
          userPosition={position}
          activePOIId={activePOIId}
          startLocation={ROUTE.startLocation}
        />
        <NowPlaying
          audioState={audioState}
          clipName={currentClipName}
          mode={selectedMode}
        />

        {/* Route header */}
        <View style={styles.routeHeader}>
          <Text style={styles.routeCity}>{ROUTE.city}</Text>
          <Text style={styles.routeName}>{ROUTE.name}</Text>
          <Text style={styles.routeDistance}>{ROUTE.distanceKm} km loop</Text>
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
                {ROUTE.pois.filter(p => p.clips[selectedMode]).length}
              </Text>
              <Text style={styles.statLabel}>Stops</Text>
            </View>
          </View>
        )}

        {/* Mode selector (only before/during run, not while audio plays) */}
        {runState === 'idle' && (
          <>
            <Text style={styles.sectionLabel}>Choose your lens</Text>
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
                  <Text style={styles.modeEmoji}>{m.emoji}</Text>
                  <Text
                    style={[
                      styles.modeLabel,
                      selectedMode === m.id && styles.modeLabelActive,
                    ]}
                  >
                    {m.label}
                  </Text>
                  <Text style={styles.modeDesc}>{m.description}</Text>
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
              <TouchableOpacity style={styles.stopButton} onPress={handleStopRun}>
                <Text style={styles.stopButtonText}>End Run</Text>
              </TouchableOpacity>
            </>
          )}
          {runState === 'paused' && (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={handleResumeRun}>
                <Text style={styles.primaryButtonText}>Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stopButton} onPress={handleStopRun}>
                <Text style={styles.stopButtonText}>End Run</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  mapContainer: { flex: 1 },

  routeHeader: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  routeCity:     { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  routeName:     { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 },
  routeDistance: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },

  bottomPanel: {
    backgroundColor: '#0f0f0f',
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 16,
    gap: 12,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    paddingVertical: 12,
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)' },

  sectionLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },

  modeRow: { gap: 10, paddingBottom: 4 },
  modeChip: {
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 100,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modeChipActive: { borderColor: '#fff', backgroundColor: '#2c2c2e' },
  modeEmoji: { fontSize: 22 },
  modeLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginTop: 4 },
  modeLabelActive: { color: '#fff' },
  modeDesc: { color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2, textAlign: 'center' },

  errorText: { color: '#FF5252', fontSize: 12, textAlign: 'center' },

  actionRow: { flexDirection: 'row', gap: 10 },
  primaryButton: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryButtonText: { color: '#000', fontSize: 16, fontWeight: '700' },

  secondaryButton: {
    flex: 1, backgroundColor: '#1c1c1e', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  secondaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  stopButton: {
    flex: 1, backgroundColor: '#1c1c1e', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#FF5252',
  },
  stopButtonText: { color: '#FF5252', fontSize: 16, fontWeight: '600' },
});
