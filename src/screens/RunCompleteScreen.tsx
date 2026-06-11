import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Route, Mode } from '../data/types';
import StarRating from '../components/StarRating';
import { useRatings } from '../hooks/useRatings';
import { useRoutePhotos } from '../hooks/useRoutePhotos';
import type { AddPhotoResult } from '../utils/photosStore';

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
};

interface Props {
  route:            Route;
  mode:             Mode;
  distanceCoveredM: number;
  elapsedSec:       number;
  poisHeard:        number;
  onRunAgain:       () => void;
  onBackToRoutes:   () => void;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatPace(distM: number, sec: number): string {
  if (distM < 100) return '—';
  const secPerKm = (sec / distM) * 1000;
  const min = Math.floor(secPerKm / 60);
  const s   = Math.round(secPerKm % 60);
  return `${min}:${s.toString().padStart(2, '0')}`;
}

function completionGrade(distM: number, routeKm: number): { label: string; color: string } {
  const pct = distM / (routeKm * 1000);
  if (pct >= 0.95) return { label: 'Full route',    color: '#4CAF50' };
  if (pct >= 0.60) return { label: 'Solid run',     color: '#F5A623' };
  if (pct >= 0.30) return { label: 'Good start',    color: '#2196F3' };
  return              { label: 'Early stop',    color: 'rgba(255,255,255,0.36)' };
}

const MODE_LABELS: Record<Mode, string> = {
  history: 'History', food: 'Food', sightseeing: 'Sightseeing', local: 'Local life',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function RunCompleteScreen({
  route,
  mode,
  distanceCoveredM,
  elapsedSec,
  poisHeard,
  onRunAgain,
  onBackToRoutes,
}: Props) {
  const grade    = completionGrade(distanceCoveredM, route.distanceKm);
  const totalPOI = route.pois.filter(p => !!p.clips[mode]).length;
  const { routeRating, audioRating, rateRoute, rateAudio } = useRatings();
  const routeStars = routeRating(route.id) ?? 0;
  const audioStars = audioRating(route.id, mode) ?? 0;
  const heardAnyAudio = poisHeard > 0;

  const { photos, capture, pick, remove } = useRoutePhotos(route.id);

  const handleAddResult = (res: AddPhotoResult) => {
    if (res.ok || res.reason === 'cancelled') return;
    Alert.alert(
      res.reason === 'denied' ? 'Permission needed' : "Couldn't add photo",
      res.reason === 'denied'
        ? 'Allow camera/photo access in Settings to attach photos.'
        : 'Something went wrong adding that photo.',
    );
  };

  const handleSnap = async () => handleAddResult(await capture());
  const handlePick = async () => handleAddResult(await pick());

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.doneLabel}>Run complete</Text>
          <Text style={styles.routeName}>{route.name}</Text>
          <View style={[styles.gradeBadge, { borderColor: grade.color + '44', backgroundColor: grade.color + '11' }]}>
            <Text style={[styles.gradeText, { color: grade.color }]}>{grade.label}</Text>
          </View>
        </View>

        {/* ── Primary stats ───────────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatDist(distanceCoveredM)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatTime(elapsedSec)}</Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatPace(distanceCoveredM, elapsedSec)}</Text>
            <Text style={styles.statLabel}>Avg pace /km</Text>
          </View>
          {route.elevationGainM !== undefined && (
            <View style={styles.statCard}>
              <Text style={styles.statValue}>↑{route.elevationGainM}m</Text>
              <Text style={styles.statLabel}>Climb</Text>
            </View>
          )}
        </View>

        {/* ── Audio summary ───────────────────────────────────────────── */}
        <View style={styles.audioCard}>
          <View style={styles.audioCardHeader}>
            <Text style={styles.audioCardTitle}>Audio · {MODE_LABELS[mode]}</Text>
            <Text style={styles.audioCardCount}>
              {poisHeard} / {totalPOI} stops
            </Text>
          </View>
          <View style={styles.audioBar}>
            <View
              style={[
                styles.audioBarFill,
                { width: totalPOI > 0 ? `${(poisHeard / totalPOI) * 100}%` as unknown as number : '0%' as unknown as number },
              ]}
            />
          </View>
          {poisHeard < totalPOI && (
            <Text style={styles.audioHint}>
              {totalPOI - poisHeard} more story{totalPOI - poisHeard !== 1 ? 's' : ''} along this route — run it again to catch them
            </Text>
          )}
          {poisHeard >= totalPOI && totalPOI > 0 && (
            <Text style={[styles.audioHint, { color: C.green }]}>
              Every story unlocked on this route ✓
            </Text>
          )}
        </View>

        {/* ── Rate it ─────────────────────────────────────────────────── */}
        <View style={styles.rateCard}>
          <Text style={styles.rateCardTitle}>How was it?</Text>
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>This route</Text>
            <StarRating value={routeStars} onRate={n => rateRoute(route.id, n)} size={26} />
          </View>
          {heardAnyAudio && (
            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>{MODE_LABELS[mode]} audio</Text>
              <StarRating value={audioStars} onRate={n => rateAudio(route.id, mode, n)} size={26} />
            </View>
          )}
          {(routeStars > 0 || audioStars > 0) && (
            <Text style={styles.rateThanks}>Thanks — saved to this device ✓</Text>
          )}
        </View>

        {/* ── Capture the run ─────────────────────────────────────────── */}
        <View style={styles.photoCard}>
          <View style={styles.photoHeader}>
            <Text style={styles.photoTitle}>Capture this run</Text>
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoBtn} onPress={handleSnap} activeOpacity={0.8}>
                <Text style={styles.photoBtnText}>📷 Snap</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={handlePick} activeOpacity={0.8}>
                <Text style={styles.photoBtnText}>＋ Add</Text>
              </TouchableOpacity>
            </View>
          </View>
          {photos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoStrip}
            >
              {photos.map(uri => (
                <TouchableOpacity
                  key={uri}
                  activeOpacity={0.85}
                  onLongPress={() =>
                    Alert.alert('Remove photo', 'Remove this photo from the route?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => remove(uri) },
                    ])
                  }
                >
                  <Image source={{ uri }} style={styles.photoThumb} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.photoHint}>Snap a finish-line photo or the view — long-press a photo to remove it.</Text>
          )}
        </View>

        {/* ── Post-run tip ────────────────────────────────────────────── */}
        {route.postRunFood && (
          <View style={styles.tipCard}>
            <Text style={styles.tipIcon}>🍳</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>You've earned it</Text>
              <Text style={styles.tipBody}>{route.postRunFood}</Text>
            </View>
          </View>
        )}

        {/* ── Local tip ───────────────────────────────────────────────── */}
        {route.localTip && (
          <View style={styles.tipCard}>
            <Text style={styles.tipIcon}>💬</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>Local knowledge</Text>
              <Text style={styles.tipBody}>{route.localTip}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onBackToRoutes} activeOpacity={0.8}>
          <Text style={styles.secondaryBtnText}>← Routes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={onRunAgain} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Run again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll:    { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 16, gap: 14 },

  // Header
  header: { alignItems: 'center', gap: 8, marginBottom: 8 },
  doneLabel: {
    color: C.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  routeName: {
    color: C.white,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  gradeBadge: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    marginTop: 2,
  },
  gradeText: { fontSize: 13, fontWeight: '700' },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: C.white,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    color: C.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Audio card
  audioCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 10,
  },
  audioCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  audioCardTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  audioCardCount: { color: C.amber, fontSize: 14, fontWeight: '700' },
  audioBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  audioBarFill: {
    height: '100%',
    backgroundColor: C.amber,
    borderRadius: 2,
  },
  audioHint: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },

  // Rate card
  rateCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 12,
  },
  rateCardTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rateLabel: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
  rateThanks: { color: C.green, fontSize: 12, fontWeight: '600' },

  // Photo card
  photoCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 12,
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  photoActions: { flexDirection: 'row', gap: 8 },
  photoBtn: {
    backgroundColor: C.surfaceRaised,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.amberBorder,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  photoBtnText: { color: C.amber, fontSize: 13, fontWeight: '700' },
  photoStrip: { gap: 8, paddingRight: 4 },
  photoThumb: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: C.surfaceRaised,
  },
  photoHint: { color: C.textSecondary, fontSize: 12, lineHeight: 17 },

  // Tip card
  tipCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipIcon: { fontSize: 18, marginTop: 1 },
  tipTitle: { color: C.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  tipBody:  { color: C.text, fontSize: 13, lineHeight: 19 },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  secondaryBtnText: { color: C.text, fontSize: 15, fontWeight: '700' },
  primaryBtn: {
    flex: 2,
    backgroundColor: C.amber,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0D0C0A', fontSize: 15, fontWeight: '800' },
});
