// ⚠ Task definitions must be imported before any component code runs.
// expo-task-manager requires tasks to be registered at the module level.
import './src/tasks/backgroundLocation';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RunMap from './src/components/RunMap';
import NowPlaying from './src/components/NowPlaying';
import ElevationProfile from './src/components/ElevationProfile';
import HomeScreen from './src/screens/HomeScreen';
import RouteDetailScreen from './src/screens/RouteDetailScreen';
import RunCompleteScreen from './src/screens/RunCompleteScreen';
import { useGPS } from './src/hooks/useGPS';
import { useSimulatedRun } from './src/hooks/useSimulatedRun';
import { useAudio } from './src/hooks/useAudio';
import { useProximity } from './src/hooks/useProximity';
import { useNavigation, type NavNudge } from './src/hooks/useNavigation';
import { useElevation } from './src/hooks/useElevation';
import SF_EMBARCADERO_ROUTE from './src/data/routes/sf_embarcadero';
import { CITIES } from './src/data/cities';
import { Coordinate, Mode, POI, Route, RunState } from './src/data/types';
import { City } from './src/data/cities';

const MODES: { id: Mode; label: string; description: string }[] = [
  { id: 'history',     label: 'History',     description: 'The city\'s bones'    },
  { id: 'food',        label: 'Food',        description: 'What to eat & drink'  },
  { id: 'sightseeing', label: 'Sightseeing', description: 'Views & moments'      },
  { id: 'local',       label: 'Local Life',  description: 'How it really lives'  },
];

type AppScreen = 'home' | 'detail' | 'run' | 'complete';

export default function App() {
  const [screen, setScreen]           = useState<AppScreen>('home');
  const [activeRoute, setActiveRoute]           = useState<Route>(SF_EMBARCADERO_ROUTE);
  const [activeCity, setActiveCity]             = useState<City>(CITIES[0]);
  const [startOverride, setStartOverride]       = useState<Coordinate | null>(null);

  const [runState, setRunState]         = useState<RunState>('idle');
  const [selectedMode, setSelectedMode] = useState<Mode>('sightseeing');
  const [activePOIId, setActivePOIId] = useState<string | null>(null);
  const proximityResetRef = useRef<(() => void) | null>(null);
  const navigationResetRef = useRef<(() => void) | null>(null);
  const [navHint, setNavHint] = useState<string | null>(null);
  const navHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [simulateMode, setSimulateMode] = useState(false);
  const [simOffRoute, setSimOffRoute] = useState(false);
  const simResetRef = useRef<(() => void) | null>(null);

  // ── Elapsed time tracking ──────────────────────────────────────────────
  const [elapsedSec, setElapsedSec]   = useState(0);
  const runStartTimeRef               = useRef<number | null>(null);   // wall-clock ms when last resumed
  const accumulatedSecRef             = useRef(0);                     // seconds from previous intervals
  const timerRef                      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── POIs heard ─────────────────────────────────────────────────────────
  const [poisHeard, setPoisHeard]     = useState(0);

  // ── Run completion state (snapshot at stop time) ───────────────────────
  const [finalDistM, setFinalDistM]   = useState(0);
  const [finalSec,   setFinalSec]     = useState(0);


  const isActive = runState === 'running';

  const {
    position: gpsPosition,
    distanceCoveredM: gpsDistanceM,
    pacingSecPerM: gpsPace,
    error: gpsError,
    reset: resetGps,
  } = useGPS(isActive && !simulateMode);

  const {
    position: simPosition,
    distanceCoveredM: simDistanceM,
    pacingSecPerM: simPace,
    reset: resetSim,
  } = useSimulatedRun(activeRoute.coordinates, isActive && simulateMode, {
    offRoute: simOffRoute,
  });

  simResetRef.current = resetSim;

  const position = simulateMode ? simPosition : gpsPosition;
  const distanceCoveredM = simulateMode ? simDistanceM : gpsDistanceM;
  const pacingSecPerM = simulateMode ? simPace : gpsPace;
  const { elevation } = useElevation(activeRoute.coordinates, activeRoute.id);
  const { audioState, currentClipName, playClip, stopCurrent, speakNudge, stopNudge } = useAudio();

  const handlePOITrigger = useCallback(
    (poi: POI, audioFile: string) => {
      setActivePOIId(poi.id);
      setPoisHeard(n => n + 1);
      playClip(audioFile, poi.name);
      setTimeout(() => setActivePOIId(null), 45000);
    },
    [playClip],
  );

  // ── Timer helpers ──────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    runStartTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const since = runStartTimeRef.current
        ? (Date.now() - runStartTimeRef.current) / 1000
        : 0;
      setElapsedSec(Math.floor(accumulatedSecRef.current + since));
    }, 1000);
  }, []);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (runStartTimeRef.current) {
      accumulatedSecRef.current += (Date.now() - runStartTimeRef.current) / 1000;
      runStartTimeRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    pauseTimer();
    accumulatedSecRef.current = 0;
    setElapsedSec(0);
  }, [pauseTimer]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (navHintTimerRef.current) clearTimeout(navHintTimerRef.current);
  }, []);

  const { reset: resetProximity } = useProximity({
    position,
    pois: activeRoute.pois,
    mode: selectedMode,
    active: isActive,
    pacingSecPerM,
    onTrigger: handlePOITrigger,
  });

  proximityResetRef.current = resetProximity;

  const canSpeakNav = useCallback(() => audioState === 'idle', [audioState]);

  const showNavHint = useCallback((message: string) => {
    if (navHintTimerRef.current) clearTimeout(navHintTimerRef.current);
    setNavHint(message);
    navHintTimerRef.current = setTimeout(() => setNavHint(null), 5000);
  }, []);

  const handleNavNudge = useCallback(
    (nudge: NavNudge) => {
      speakNudge(nudge.message);
      showNavHint(nudge.message);
    },
    [speakNudge, showNavHint],
  );

  const { reset: resetNavigation, onRoute } = useNavigation({
    position,
    routeCoords: activeRoute.coordinates,
    active: isActive,
    pacingSecPerM,
    canSpeak: canSpeakNav,
    onNudge: handleNavNudge,
  });

  navigationResetRef.current = resetNavigation;

  const handleStartRun = useCallback(() => {
    setSimulateMode(false);
    setSimOffRoute(false);
    setPoisHeard(0);
    resetTimer();
    resetGps();
    navigationResetRef.current?.();
    proximityResetRef.current?.();
    setNavHint(null);
    startTimer();
    setRunState('running');
  }, [resetTimer, startTimer, resetGps]);

  const handleStartSimulatedRun = useCallback(() => {
    setSimulateMode(true);
    setSimOffRoute(false);
    setPoisHeard(0);
    resetTimer();
    simResetRef.current?.();
    navigationResetRef.current?.();
    proximityResetRef.current?.();
    setNavHint(null);
    startTimer();
    setRunState('running');
  }, [resetTimer, startTimer]);

  const handlePauseRun = useCallback(() => {
    pauseTimer();
    setRunState('paused');
    stopCurrent();
    stopNudge();
  }, [pauseTimer, stopCurrent, stopNudge]);

  const handleResumeRun = useCallback(() => {
    startTimer();
    setRunState('running');
  }, [startTimer]);

  const handleStopRun = useCallback(() => {
    pauseTimer();
    setRunState('idle');
    setSimulateMode(false);
    setSimOffRoute(false);
    stopCurrent();
    stopNudge();
    proximityResetRef.current?.();
    navigationResetRef.current?.();
    setNavHint(null);
    setActivePOIId(null);
  }, [pauseTimer, stopCurrent, stopNudge]);

  const handleStopAndComplete = useCallback(() => {
    // Snapshot stats before resetting
    const snapDistM = distanceCoveredM;
    const snapSec   = accumulatedSecRef.current + (
      runStartTimeRef.current ? (Date.now() - runStartTimeRef.current) / 1000 : 0
    );
    setFinalDistM(snapDistM);
    setFinalSec(Math.floor(snapSec));
    handleStopRun();
    setScreen('complete');
  }, [distanceCoveredM, handleStopRun]);

  // Tapping a route card → detail screen (not directly into run)
  const handleSelectRoute = useCallback((city: City, route: Route, start?: Coordinate) => {
    setActiveCity(city);
    setActiveRoute(route);
    setStartOverride(start ?? null);
    setRunState('idle');
    setActivePOIId(null);
    setScreen('detail');
  }, []);

  // "Start Run" button on detail screen → run screen
  const handleStartFromDetail = useCallback(() => {
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

  const formatElapsed = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (screen === 'home') {
    return (
      <GestureHandlerRootView style={styles.root}>
        <HomeScreen onSelectRoute={handleSelectRoute} />
      </GestureHandlerRootView>
    );
  }

  if (screen === 'detail') {
    return (
      <GestureHandlerRootView style={styles.root}>
      <RouteDetailScreen
        route={activeRoute}
        city={activeCity}
        startOverride={startOverride}
        onStart={handleStartFromDetail}
        onBack={() => setScreen('home')}
      />
      </GestureHandlerRootView>
    );
  }

  if (screen === 'complete') {
    return (
      <GestureHandlerRootView style={styles.root}>
      <RunCompleteScreen
        route={activeRoute}
        mode={selectedMode}
        distanceCoveredM={finalDistM}
        elapsedSec={finalSec}
        poisHeard={poisHeard}
        onRunAgain={() => { setScreen('detail'); }}
        onBackToRoutes={() => { setScreen('home'); }}
      />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Map + elevation profile */}
      <View style={styles.mapContainer}>
        <RunMap
          routeCoords={activeRoute.coordinates}
          pois={activeRoute.pois}
          mode={selectedMode}
          userPosition={position}
          activePOIId={activePOIId}
          startLocation={startOverride ?? activeRoute.startLocation}
        />
        <NowPlaying
          audioState={audioState}
          clipName={currentClipName}
          mode={selectedMode}
        />

        {simulateMode && runState !== 'idle' && (
          <View style={styles.simBadge} pointerEvents="none">
            <Text style={styles.simBadgeText}>SIMULATION</Text>
          </View>
        )}

        {navHint && runState !== 'idle' && (
          <View style={styles.navHint} pointerEvents="none">
            <Text style={styles.navHintText}>↪ {navHint}</Text>
          </View>
        )}

        {/* Route header + back button */}
        <View style={styles.routeHeader} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (runState !== 'idle') {
                handleStopAndComplete();
              } else {
                setScreen('detail');
              }
            }}
          >
            <Text style={styles.backButtonText}>
              {runState !== 'idle' ? '⏹ End Run' : '← Detail'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.routeCity}>{activeRoute.city.toUpperCase()}</Text>
          <Text style={styles.routeName}>{activeRoute.name}</Text>
          <Text style={styles.routeDistance}>{activeRoute.distanceKm} km · {activeRoute.pois.length} landmarks</Text>
        </View>
      </View>

      {/* Elevation profile strip */}
      {elevation && (
        <ElevationProfile
          elevation={elevation}
          distanceKm={distanceCoveredM / 1000}
          totalDistanceKm={activeRoute.distanceKm}
        />
      )}

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>

        {/* Live stats when running */}
        {runState !== 'idle' && !onRoute && (
          <Text style={styles.offRouteText}>Off route — head back to the line</Text>
        )}

        {runState !== 'idle' && (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatDistance(distanceCoveredM)}</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatElapsed(elapsedSec)}</Text>
              <Text style={styles.statLabel}>Time</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatPace(pacingSecPerM)}</Text>
              <Text style={styles.statLabel}>Pace</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{poisHeard}</Text>
              <Text style={styles.statLabel}>Heard</Text>
            </View>
          </View>
        )}

        {/* Mode selector — full picker at idle, compact pill while running */}
        {runState === 'idle' ? (
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
                  style={[styles.modeChip, selectedMode === m.id && styles.modeChipActive]}
                  onPress={() => setSelectedMode(m.id)}
                >
                  <Text style={[styles.modeLabel, selectedMode === m.id && styles.modeLabelActive]}>
                    {m.label}
                  </Text>
                  <Text style={[styles.modeDesc, selectedMode === m.id && styles.modeDescActive]}>
                    {m.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : (
          <View style={styles.activeModePill}>
            <View style={styles.activeModeIndicator} />
            <Text style={styles.activeModeLabel}>
              {MODES.find(m => m.id === selectedMode)?.label}
            </Text>
            <Text style={styles.activeModeDesc}>
              {MODES.find(m => m.id === selectedMode)?.description}
            </Text>
          </View>
        )}

        {/* GPS error */}
        {gpsError && !simulateMode && (
          <Text style={styles.errorText}>{gpsError}</Text>
        )}

        {simulateMode && runState !== 'idle' && (
          <TouchableOpacity
            style={[styles.simToggle, simOffRoute && styles.simToggleActive]}
            onPress={() => setSimOffRoute(v => !v)}
          >
            <Text style={[styles.simToggleText, simOffRoute && styles.simToggleTextActive]}>
              {simOffRoute ? 'On route again' : 'Drift off route (test)'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {runState === 'idle' && (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={handleStartRun}>
                <Text style={styles.primaryButtonText}>Start Run</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.simulateButton} onPress={handleStartSimulatedRun}>
                <Text style={styles.simulateButtonText}>Simulate</Text>
              </TouchableOpacity>
            </>
          )}
          {runState === 'running' && (
            <>
              <TouchableOpacity style={styles.secondaryButton} onPress={handlePauseRun}>
                <Text style={styles.secondaryButtonText}>Pause</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stopButton} onPress={handleStopAndComplete}>
                <Text style={styles.stopButtonText}>End Run</Text>
              </TouchableOpacity>
            </>
          )}
          {runState === 'paused' && (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={handleResumeRun}>
                <Text style={styles.primaryButtonText}>Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stopButton} onPress={handleStopAndComplete}>
                <Text style={styles.stopButtonText}>End Run</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
    </GestureHandlerRootView>
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
  root:         { flex: 1 },
  container:    { flex: 1, backgroundColor: C.bg },
  mapContainer: { flex: 1, position: 'relative', overflow: 'hidden' },

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

  activeModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surfaceRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderWarm,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  activeModeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.amber,
  },
  activeModeLabel: {
    color: C.amber,
    fontSize: 13,
    fontWeight: '700',
  },
  activeModeDesc: {
    color: 'rgba(245,166,35,0.50)',
    fontSize: 11,
    marginLeft: 2,
  },

  errorText: { color: C.danger, fontSize: 12, textAlign: 'center' },

  navHint: {
    position: 'absolute',
    bottom: 108,
    alignSelf: 'center',
    left: 40,
    right: 40,
    zIndex: 99,
    backgroundColor: 'rgba(13,12,10,0.88)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.35)',
  },
  navHintText: {
    color: C.amber,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  offRouteText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  simBadge: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    zIndex: 101,
    backgroundColor: 'rgba(33,150,243,0.92)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  simBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  simToggle: {
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  simToggleActive: {
    borderColor: 'rgba(33,150,243,0.5)',
    backgroundColor: 'rgba(33,150,243,0.12)',
  },
  simToggleText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  simToggleTextActive: {
    color: '#64B5F6',
  },
  simulateButton: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.45)',
  },
  simulateButtonText: {
    color: '#64B5F6',
    fontSize: 16,
    fontWeight: '700',
  },

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
