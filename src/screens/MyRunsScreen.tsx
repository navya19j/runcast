import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRecordedRuns } from '../hooks/useRecordedRuns';
import { RecordedRun } from '../data/recordedRun';

const C = {
  bg:            '#0D0C0A',
  surface:       '#181612',
  amber:         '#F5A623',
  white:         '#FFFFFF',
  text:          'rgba(255,255,255,0.88)',
  textSecondary: 'rgba(255,255,255,0.52)',
  textTertiary:  'rgba(255,255,255,0.30)',
  border:        'rgba(255,255,255,0.1)',
};

interface Props {
  onOpen: (runId: string) => void;
  onBack: () => void;
  onRecord: () => void;
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}
function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MyRunsScreen({ onOpen, onBack, onRecord }: Props) {
  const { runs } = useRecordedRuns();

  const renderRow = (run: RecordedRun) => (
    <TouchableOpacity key={run.id} style={styles.card} onPress={() => onOpen(run.id)} activeOpacity={0.85}>
      {run.photoUris[0] ? (
        <Image source={{ uri: run.photoUris[0] }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}><Text style={styles.thumbGlyph}>🏃</Text></View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>{run.name}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {fmtDate(run.createdAt)} · {fmtDist(run.distanceM)} · {fmtTime(run.durationSec)}
        </Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {run.voiceNotes.length} note{run.voiceNotes.length !== 1 ? 's' : ''}
          {run.photoUris.length > 0 ? ` · ${run.photoUris.length} photo${run.photoUris.length !== 1 ? 's' : ''}` : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My runs</Text>
        <View style={{ width: 60 }} />
      </View>

      {runs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyGlyph}>🎙</Text>
          <Text style={styles.emptyTitle}>No runs yet</Text>
          <Text style={styles.emptyBody}>
            Record your route, drop voice notes about what you see, and they'll show up here.
          </Text>
          <TouchableOpacity style={styles.recordBtn} onPress={onRecord} activeOpacity={0.85}>
            <Text style={styles.recordBtnText}>Record a run</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {runs.map(renderRow)}
          <TouchableOpacity style={styles.recordBtn} onPress={onRecord} activeOpacity={0.85}>
            <Text style={styles.recordBtnText}>Record a run</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
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
  backBtn: { width: 60 },
  backBtnText: { color: C.amber, fontSize: 14, fontWeight: '700' },
  title: { color: C.white, fontSize: 18, fontWeight: '800' },

  list: { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbGlyph: { fontSize: 22 },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  cardName: { color: C.white, fontSize: 15, fontWeight: '700' },
  cardMeta: { color: C.textSecondary, fontSize: 12, fontWeight: '500' },
  cardSub: { color: C.amber, fontSize: 12, fontWeight: '600' },
  chevron: { color: C.textTertiary, fontSize: 22, fontWeight: '300' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  emptyGlyph: { fontSize: 40 },
  emptyTitle: { color: C.white, fontSize: 18, fontWeight: '800' },
  emptyBody: { color: C.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  recordBtn: {
    backgroundColor: C.amber,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 12,
  },
  recordBtnText: { color: '#0D0C0A', fontSize: 16, fontWeight: '800' },
});
