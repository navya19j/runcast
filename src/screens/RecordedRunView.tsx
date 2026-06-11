import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Polyline, Circle, Marker } from 'react-native-maps';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { MAP_PROVIDER } from '../utils/mapProvider';
import MapCanvas from '../components/MapCanvas';
import { useRecordedRuns } from '../hooks/useRecordedRuns';
import { VoiceNote } from '../data/recordedRun';

const C = {
  bg:            '#0D0C0A',
  surface:       '#181612',
  amber:         '#F5A623',
  white:         '#FFFFFF',
  text:          'rgba(255,255,255,0.88)',
  textSecondary: 'rgba(255,255,255,0.52)',
  textTertiary:  'rgba(255,255,255,0.30)',
  border:        'rgba(255,255,255,0.1)',
  danger:        '#FF5252',
};

interface Props {
  runId: string;
  onBack: () => void;
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}
function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RecordedRunView({ runId, onBack }: Props) {
  const { getRun, deleteRun } = useRecordedRuns();
  const run = getRun(runId);
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => { playerRef.current?.remove(); playerRef.current = null; };
  }, []);

  const validCoords = (run?.coordinates ?? []).filter(
    c => c && typeof c.lat === 'number' && typeof c.lng === 'number',
  );
  const lineCoords = validCoords.map(c => ({ latitude: c.lat, longitude: c.lng }));
  const allNotes = run?.voiceNotes ?? [];
  const locatedNotes = allNotes.filter(
    n => n.location && typeof n.location.lat === 'number' && typeof n.location.lng === 'number',
  );

  useEffect(() => {
    if (!mapReady || lineCoords.length < 2) return;
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(lineCoords, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: false,
      });
    }, 80);
    return () => clearTimeout(t);
  }, [mapReady, runId]);

  if (!run) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}><Text style={styles.backBtnText}>← Back</Text></TouchableOpacity>
        </View>
        <Text style={styles.missing}>This run is no longer available.</Text>
      </SafeAreaView>
    );
  }

  const playNote = (n: VoiceNote) => {
    playerRef.current?.remove();
    if (playingId === n.id) { playerRef.current = null; setPlayingId(null); return; }
    const player = createAudioPlayer({ uri: n.audioUri });
    playerRef.current = player;
    setPlayingId(n.id);
    player.addListener('playbackStatusUpdate', s => {
      if (s.didJustFinish) {
        setPlayingId(null);
        player.remove();
        if (playerRef.current === player) playerRef.current = null;
      }
    });
    player.play();
  };

  const confirmDelete = () => {
    Alert.alert('Delete run?', `"${run.name}" and its notes will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteRun(run.id); onBack(); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <Text style={styles.backBtnText}>← Runs</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmDelete} activeOpacity={0.8}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.runName}>{run.name}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}><Text style={styles.statValue}>{fmtDist(run.distanceM)}</Text><Text style={styles.statLabel}>distance</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.stat}><Text style={styles.statValue}>{fmtTime(run.durationSec)}</Text><Text style={styles.statLabel}>time</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.stat}><Text style={styles.statValue}>{allNotes.length}</Text><Text style={styles.statLabel}>notes</Text></View>
        </View>

        {lineCoords.length > 0 && (
          <View style={styles.mapCard}>
            <MapCanvas
              ref={mapRef}
              containerStyle={StyleSheet.absoluteFill}
              provider={MAP_PROVIDER}
              mapType="standard"
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              cacheEnabled={Platform.OS === 'android'}
              onMapReady={() => setMapReady(true)}
            >
              <Polyline coordinates={lineCoords} strokeColor={C.amber} strokeWidth={4} lineCap="round" lineJoin="round" />
              {validCoords[0] && (
                <Circle center={{ latitude: validCoords[0].lat, longitude: validCoords[0].lng }} radius={14} fillColor={C.amber} strokeColor="#fff" strokeWidth={2} />
              )}
              {locatedNotes.map(n => (
                <Marker key={n.id} coordinate={{ latitude: n.location!.lat, longitude: n.location!.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                  <View style={styles.notePin}><Text style={styles.notePinText}>🎙</Text></View>
                </Marker>
              ))}
            </MapCanvas>
          </View>
        )}

        {allNotes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Voice notes</Text>
            {allNotes.map((n, i) => (
              <TouchableOpacity key={n.id} style={styles.noteRow} onPress={() => playNote(n)} activeOpacity={0.8}>
                <View style={styles.notePlay}><Text style={styles.notePlayText}>{playingId === n.id ? '❚❚' : '▶'}</Text></View>
                <Text style={styles.noteLabel}>Note {i + 1}</Text>
                <Text style={styles.noteMeta}>at {fmtClock(n.atSec)} · {n.durationSec}s</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {(run.photoUris ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={styles.photoGrid}>
              {(run.photoUris ?? []).map(uri => (
                <Image key={uri} source={{ uri }} style={styles.photo} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {},
  backBtnText: { color: C.amber, fontSize: 14, fontWeight: '700' },
  deleteText: { color: C.danger, fontSize: 14, fontWeight: '600' },
  missing: { color: C.textSecondary, textAlign: 'center', marginTop: 40 },

  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  runName: { color: C.white, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { color: C.white, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { color: C.textTertiary, fontSize: 10, fontWeight: '700', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.6 },
  statDivider: { width: 1, height: 26, backgroundColor: C.border },

  mapCard: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  notePin: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(13,12,10,0.9)',
    borderWidth: 2, borderColor: C.amber,
    alignItems: 'center', justifyContent: 'center',
  },
  notePinText: { fontSize: 13 },

  section: { gap: 8 },
  sectionTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  notePlay: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderWidth: 1, borderColor: 'rgba(245,166,35,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  notePlayText: { color: C.amber, fontSize: 13, fontWeight: '800' },
  noteLabel: { color: C.white, fontSize: 14, fontWeight: '600', flex: 1 },
  noteMeta: { color: C.textSecondary, fontSize: 12 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: 108, height: 108, borderRadius: 10, backgroundColor: C.surface },
});
