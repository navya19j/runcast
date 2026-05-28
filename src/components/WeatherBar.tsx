import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WeatherData, RunCondition } from '../hooks/useWeather';

interface WeatherBarProps {
  weather:  WeatherData | null;
  loading:  boolean;
  error:    string | null;
  cityName: string;
}

// ─── Condition → label + color ────────────────────────────────────────────────

const CONDITION_CONFIG: Record<RunCondition, { label: string; color: string }> = {
  great: { label: 'Great for running', color: '#5DBF72' },
  good:  { label: 'Good for running',  color: '#F5A623' },
  fair:  { label: 'Fair conditions',   color: '#E8890C' },
  tough: { label: 'Tough conditions',  color: '#FF5252' },
};

// ─── WMO code → minimal weather glyph (text-only, no emoji) ─────────────────

function weatherGlyph(code: number): string {
  if (code === 0)         return '○';
  if (code <= 3)          return '◑';
  if (code <= 48)         return '≈';
  if (code <= 55)         return '·';
  if (code <= 65)         return '▽';
  if (code <= 77)         return '❄';
  if (code <= 82)         return '▽▽';
  if (code <= 99)         return '⚡';
  return '○';
}

function fmt(n: number, unit: string) {
  return `${Math.round(n)}${unit}`;
}

export default function WeatherBar({ weather, loading, error, cityName }: WeatherBarProps) {
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#F5A623" />
        <Text style={styles.loadingText}>Getting conditions…</Text>
      </View>
    );
  }

  if (error || !weather) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Weather unavailable</Text>
      </View>
    );
  }

  const cond = CONDITION_CONFIG[weather.condition];

  return (
    <View style={styles.container}>
      {/* Left: temp + glyph + description */}
      <View style={styles.left}>
        <Text style={styles.glyph}>{weatherGlyph(weather.weatherCode)}</Text>
        <View>
          <Text style={styles.temp}>{fmt(weather.tempC, '°')}</Text>
          <Text style={styles.desc}>{weather.description}</Text>
        </View>
      </View>

      {/* Center divider */}
      <View style={styles.divider} />

      {/* Center: three quick metrics */}
      <View style={styles.metrics}>
        <Metric label="Feels" value={fmt(weather.feelsLikeC, '°')} />
        <Metric label="Rain"  value={`${Math.round(weather.precipPct)}%`} />
        <Metric label="Wind"  value={`${Math.round(weather.windKph)} km/h`} />
        {weather.uvIndex > 0 && (
          <Metric label="UV" value={String(Math.round(weather.uvIndex))} />
        )}
      </View>

      <View style={styles.divider} />

      {/* Right: condition badge + best window */}
      <View style={styles.right}>
        {weather.isMonsoon && (
          <Text style={styles.monsoonAlert}>Monsoon — run on promenades only</Text>
        )}
        <View style={[styles.conditionBadge, { borderColor: cond.color }]}>
          <View style={[styles.conditionDot, { backgroundColor: cond.color }]} />
          <Text style={[styles.conditionLabel, { color: cond.color }]}>{cond.label}</Text>
        </View>
        <Text style={styles.window}>{weather.bestRunWindow}</Text>
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,12,10,0.90)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  glyph: {
    fontSize: 20,
    color: '#F5A623',
    width: 22,
    textAlign: 'center',
  },
  temp: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 26,
  },
  desc: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  metrics: {
    flexDirection: 'row',
    gap: 10,
    flex: 1,
    justifyContent: 'center',
  },
  metric: { alignItems: 'center' },
  metricValue: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: -0.3 },
  metricLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 1 },
  right: {
    alignItems: 'flex-end',
    gap: 3,
  },
  conditionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  conditionDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  conditionLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  window: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 10,
    fontWeight: '500',
  },
  monsoonAlert: {
    color: '#FF5252',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginLeft: 8,
  },
  errorText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
});
