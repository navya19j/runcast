import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Polyline, Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { MAP_PROVIDER } from '../utils/mapProvider';
import MapCanvas from '../components/MapCanvas';
import { getQuickPosition, toCoordinate, warmUpLocation } from '../utils/quickLocation';
import { useGPS } from '../hooks/useGPS';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useRecordedRuns } from '../hooks/useRecordedRuns';
import { Coordinate } from '../data/types';
import { RecordedRun, VoiceNote } from '../data/recordedRun';

const C = {
  bg:            '#0D0C0A',
  surface:       '#181612',
  surfaceRaised: '#221F1A',
  amber:         '#F5A623',
  white:         '#FFFFFF',
  text:          'rgba(255,255,255,0.88)',
  textSecondary: 'rgba(255,255,255,0.52)',
  textTertiary:  'rgba(255,255,255,0.30)',
  border:        'rgba(255,255,255,0.1)',
  danger:        '#FF5252',
  rec:           '#FF453A',
};

interface Props {
  cityId?: string;
  onDone: (runId: string) => void;
  onCancel: () => void;
}

type Phase = 'idle' | 'recording' | 'paused';

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)}` : `${Math.round(m)}`;
}
function fmtDistUnit(m: number): string {
  return m >= 1000 ? 'km' : 'm';
}
function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function fmtPace(secPerM: number | null): string {
  if (!secPerM) return '—';
  const secPerKm = secPerM * 1000;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function autoName(): string {
  const d = new Date();
  const h = d.getHours();
  const part = h < 11 ? 'Morning' : h < 16 ? 'Afternoon' : h < 20 ? 'Evening' : 'Night';
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${part} run · ${month} ${d.getDate()}`;
}

export default function RecordScreen({ cityId, onDone, onCancel }: Props) {
  const mapRef = useRef<MapView>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const active = phase === 'recording';

  const gps = useGPS(active);
  const voice = useVoiceRecorder();
  const { saveRun } = useRecordedRuns();

  const [path, setPath] = useState<Coordinate[]>([]);
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [saving, setSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const noteSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsedSec;
  const centerRef = useRef<Coordinate | null>(null);

  // Centre on the runner the moment the screen opens, so it never feels lost.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      warmUpLocation();
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled || status !== 'granted') return;
        const pos = await getQuickPosition();
        if (cancelled) return;
        const c = toCoordinate(pos);
        centerRef.current = c;
        mapRef.current?.animateToRegion(
          { latitude: c.lat, longitude: c.lng, latitudeDelta: 0.004, longitudeDelta: 0.004 },
          400,
        );
      } catch {
        /* ignore — user can still start */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    if (noteSavedTimer.current) clearTimeout(noteSavedTimer.current);
  }, []);

  const recenter = useCallback(() => {
    const c = gps.position ?? centerRef.current;
    if (c) {
      mapRef.current?.animateToRegion(
        { latitude: c.lat, longitude: c.lng, latitudeDelta: 0.004, longitudeDelta: 0.004 },
        400,
      );
    }
  }, [gps.position]);

  // Timer ticks only while actively recording.
  useEffect(() => {
    if (phase === 'recording') {
      timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [phase]);

  // Collect the GPS path + keep the map centred on the runner.
  useEffect(() => {
    if (!active || !gps.position) return;
    const p = gps.position;
    centerRef.current = p;
    setPath(prev => {
      const last = prev[prev.length - 1];
      if (last && last.lat === p.lat && last.lng === p.lng) return prev;
      return [...prev, p];
    });
    mapRef.current?.animateToRegion(
      { latitude: p.lat, longitude: p.lng, latitudeDelta: 0.004, longitudeDelta: 0.004 },
      500,
    );
  }, [gps.position, active]);

  const lineCoords = path.map(c => ({ latitude: c.lat, longitude: c.lng }));

  const startRun = useCallback(() => {
    setPath([]);
    setNotes([]);
    setPhotos([]);
    setElapsedSec(0);
    gps.reset();
    setPhase('recording');
  }, [gps]);

  const toggleVoiceNote = useCallback(async () => {
    if (voice.recording) {
      const clip = await voice.stop();
      if (clip) {
        setNotes(prev => [
          ...prev,
          {
            id: `note-${Date.now()}`,
            location: gps.position ?? centerRef.current ?? null,
            audioUri: clip.uri,
            durationSec: clip.durationSec,
            atSec: elapsedRef.current,
          },
        ]);
        setNoteSaved(true);
        if (noteSavedTimer.current) clearTimeout(noteSavedTimer.current);
        noteSavedTimer.current = setTimeout(() => setNoteSaved(false), 1800);
      }
    } else {
      const ok = await voice.start();
      if (!ok) {
        Alert.alert('Microphone needed', 'Allow microphone access to record voice notes.');
      }
    }
  }, [voice, gps.position]);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera needed', 'Allow camera access to add photos to your run.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets?.length) {
      setPhotos(prev => [...prev, res.assets[0].uri]);
    }
  }, []);

  const finish = useCallback(async () => {
    if (saving) return;
    // Make sure a dangling voice note is captured.
    let finalNotes = notes;
    if (voice.recording) {
      const clip = await voice.stop();
      if (clip) {
        finalNotes = [...notes, {
          id: `note-${Date.now()}`,
          location: gps.position ?? centerRef.current ?? null,
          audioUri: clip.uri,
          durationSec: clip.durationSec,
          atSec: elapsedRef.current,
        }];
      }
    }
    setPhase('idle');
    setSaving(true);
    const run: RecordedRun = {
      id: `run-${Date.now()}`,
      name: autoName(),
      createdAt: Date.now(),
      cityId,
      coordinates: path,
      distanceM: gps.distanceCoveredM,
      durationSec: elapsedRef.current,
      voiceNotes: finalNotes,
      photoUris: photos,
    };
    try {
      await saveRun(run);
      onDone(run.id);
    } catch {
      setSaving(false);
      Alert.alert('Could not save', 'Something went wrong saving your run.');
    }
  }, [saving, notes, voice, gps.position, gps.distanceCoveredM, path, photos, cityId, saveRun, onDone]);

  const confirmCancel = useCallback(() => {
    if (phase === 'idle' && path.length === 0) { onCancel(); return; }
    Alert.alert('Discard run?', 'Your recorded route and notes will be lost.', [
      { text: 'Keep recording', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onCancel },
    ]);
  }, [phase, path.length, onCancel]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.mapWrap}>
        <MapCanvas
          ref={mapRef}
          containerStyle={StyleSheet.absoluteFill}
          provider={MAP_PROVIDER}
          mapType="standard"
          showsUserLocation
          scrollEnabled
          zoomEnabled
          rotateEnabled
          pitchEnabled={false}
          cacheEnabled={Platform.OS === 'android'}
        >
          {lineCoords.length > 1 && (
            <Polyline
              coordinates={lineCoords}
              strokeColor={C.amber}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          )}
          {notes.filter(n => n.location && typeof n.location.lat === 'number').map(n => (
            <Marker
              key={n.id}
              coordinate={{ latitude: n.location!.lat, longitude: n.location!.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.notePin}><Text style={styles.notePinText}>🎙</Text></View>
            </Marker>
          ))}
        </MapCanvas>

        <TouchableOpacity style={styles.closeBtn} onPress={confirmCancel} activeOpacity={0.8}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        {gps.error && phase !== 'idle' && (
          <View style={styles.errorPill}><Text style={styles.errorText}>{gps.error}</Text></View>
        )}

        {noteSaved && (
          <View style={styles.savedPill}><Text style={styles.savedText}>🎙 Voice note saved ✓</Text></View>
        )}

        <TouchableOpacity style={styles.recenterBtn} onPress={recenter} activeOpacity={0.85}>
          <Text style={styles.recenterText}>◎</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.panel}>
        {phase === 'idle' ? (
          <View style={styles.idleBlock}>
            <Text style={styles.idleTitle}>Record a run</Text>
            <Text style={styles.idleSub}>
              We'll trace your route on the map. Tap 🎙 anytime to drop a voice note about what you see.
            </Text>
          </View>
        ) : (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{fmtDist(gps.distanceCoveredM)}</Text>
              <Text style={styles.statLabel}>{fmtDistUnit(gps.distanceCoveredM)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{fmtTime(elapsedSec)}</Text>
              <Text style={styles.statLabel}>time</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{fmtPace(gps.pacingSecPerM)}</Text>
              <Text style={styles.statLabel}>/km</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{notes.length}</Text>
              <Text style={styles.statLabel}>notes</Text>
            </View>
          </View>
        )}

        {phase === 'idle' ? (
          <TouchableOpacity style={styles.startBtn} onPress={startRun} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>{saving ? 'Saving…' : 'Start run'}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.captureRow}>
              <TouchableOpacity
                style={[styles.captureBtn, voice.recording && styles.captureBtnRec]}
                onPress={toggleVoiceNote}
                activeOpacity={0.85}
              >
                <Text style={[styles.captureBtnText, voice.recording && styles.captureBtnTextRec]}>
                  {voice.recording ? '● Stop note' : '🎙 Voice note'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.captureBtn} onPress={takePhoto} activeOpacity={0.85}>
                <Text style={styles.captureBtnText}>📷 Photo</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.controlRow}>
              {phase === 'recording' ? (
                <TouchableOpacity style={styles.pauseBtn} onPress={() => setPhase('paused')} activeOpacity={0.85}>
                  <Text style={styles.pauseBtnText}>Pause</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.resumeBtn} onPress={() => setPhase('recording')} activeOpacity={0.85}>
                  <Text style={styles.resumeBtnText}>Resume</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.finishBtn} onPress={finish} activeOpacity={0.85}>
                <Text style={styles.finishBtnText}>{saving ? 'Saving…' : 'Finish'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  mapWrap: { flex: 1, position: 'relative' },

  closeBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13,12,10,0.82)',
    borderWidth: 1,
    borderColor: C.border,
  },
  closeBtnText: { color: C.text, fontSize: 16, fontWeight: '700' },

  errorPill: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,82,82,0.92)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  errorText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  savedPill: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(76,175,80,0.95)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  savedText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  recenterBtn: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13,12,10,0.88)',
    borderWidth: 1,
    borderColor: C.border,
  },
  recenterText: { color: C.amber, fontSize: 20, fontWeight: '700' },

  idleBlock: { gap: 6, paddingVertical: 2 },
  idleTitle: { color: C.white, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  idleSub: { color: C.textSecondary, fontSize: 14, lineHeight: 20 },

  notePin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(13,12,10,0.9)',
    borderWidth: 2,
    borderColor: C.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notePinText: { fontSize: 14 },

  panel: {
    backgroundColor: C.bg,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { color: C.white, fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  statLabel: { color: C.textTertiary, fontSize: 10, fontWeight: '700', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.6 },
  statDivider: { width: 1, height: 28, backgroundColor: C.border },

  startBtn: {
    backgroundColor: C.amber,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  startBtnText: { color: '#0D0C0A', fontSize: 17, fontWeight: '800' },

  captureRow: { flexDirection: 'row', gap: 10 },
  captureBtn: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  captureBtnRec: {
    backgroundColor: 'rgba(255,69,58,0.15)',
    borderColor: 'rgba(255,69,58,0.6)',
  },
  captureBtnText: { color: C.text, fontSize: 14, fontWeight: '700' },
  captureBtnTextRec: { color: C.rec },

  controlRow: { flexDirection: 'row', gap: 10 },
  pauseBtn: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  pauseBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },
  resumeBtn: {
    flex: 1,
    backgroundColor: C.surfaceRaised,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.4)',
  },
  resumeBtnText: { color: C.amber, fontSize: 16, fontWeight: '700' },
  finishBtn: {
    flex: 1,
    backgroundColor: C.amber,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  finishBtnText: { color: '#0D0C0A', fontSize: 16, fontWeight: '800' },
});
