import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WeatherData, RunCondition } from '../hooks/useWeather';

interface WeatherBarProps {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  locationLabel?: string;
  subtitle?: string;
  variant?: 'compact' | 'detail';
  /** Drop bottom border when nested in a floating card */
  embedded?: boolean;
}

const CONDITION_CONFIG: Record<RunCondition, { label: string; color: string }> = {
  great: { label: 'Great', color: '#5DBF72' },
  good:  { label: 'Good',  color: '#F5A623' },
  fair:  { label: 'Fair',  color: '#E8890C' },
  tough: { label: 'Tough', color: '#FF5252' },
};

export default function WeatherBar({
  weather,
  loading,
  error,
  locationLabel,
  subtitle,
  variant = 'detail',
  embedded = false,
}: WeatherBarProps) {
  if (loading) {
    return (
      <View style={styles.bar}>
        <ActivityIndicator size="small" color="#F5A623" />
        <Text style={styles.muted}>Checking weather…</Text>
      </View>
    );
  }

  if (error || !weather) {
    return null;
  }

  const cond = CONDITION_CONFIG[weather.condition];

  if (variant === 'compact') {
    return (
      <View style={[styles.bar, embedded && styles.barEmbedded, styles.barStacked]}>
        <View style={styles.compactRow}>
          <View style={styles.compactMain}>
            <Text style={styles.compactTemp}>{Math.round(weather.tempC)}°</Text>
            <View style={[styles.pill, { borderColor: cond.color }]}>
              <Text style={[styles.pillText, { color: cond.color }]}>{cond.label}</Text>
            </View>
            {weather.isMonsoon && (
              <View style={styles.monsoonPill}>
                <Text style={styles.monsoonPillText}>Monsoon</Text>
              </View>
            )}
          </View>
          {locationLabel ? (
            <Text style={styles.compactPlace} numberOfLines={1} ellipsizeMode="tail">
              {locationLabel}
            </Text>
          ) : null}
        </View>
        <Text style={styles.compactRain} numberOfLines={1}>
          {weather.rainLabel}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.bar, embedded && styles.barEmbedded]}>
      <Text style={styles.detailTemp}>{Math.round(weather.tempC)}°</Text>
      <View style={styles.detailMid}>
        <View style={styles.detailTopRow}>
          <Text style={[styles.detailCond, { color: cond.color }]} numberOfLines={1}>
            {cond.label} for running
          </Text>
          {weather.isMonsoon && (
            <View style={styles.monsoonPill}>
              <Text style={styles.monsoonPillText}>Monsoon</Text>
            </View>
          )}
        </View>
        <Text style={styles.detailSub} numberOfLines={2}>
          Feels {Math.round(weather.feelsLikeC)}° · {weather.rainLabel}
          {subtitle ? ` · ${subtitle}` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  barEmbedded: {
    borderBottomWidth: 0,
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  barStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 4,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  muted: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },

  compactMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  compactTemp: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    width: 36,
    flexShrink: 0,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  compactRain: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
  },
  monsoonPill: {
    borderWidth: 1,
    borderColor: 'rgba(255,82,82,0.45)',
    backgroundColor: 'rgba(255,82,82,0.1)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexShrink: 0,
  },
  monsoonPillText: {
    color: '#FF5252',
    fontSize: 10,
    fontWeight: '700',
  },
  compactPlace: {
    flex: 1,
    minWidth: 40,
    textAlign: 'right',
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },

  detailTemp: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    width: 44,
    flexShrink: 0,
  },
  detailMid: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
  },
  detailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  detailCond: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  detailSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    lineHeight: 16,
  },
});
