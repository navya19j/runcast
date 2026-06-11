import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { City } from '../data/cities';
import { Route } from '../data/types';
import { routeTraits, RouteTraitTone } from '../utils/routeTraits';

const TONE_STYLES: Record<RouteTraitTone, { bg: string; border: string; text: string }> = {
  good: {
    bg: 'rgba(76,175,80,0.14)',
    border: 'rgba(76,175,80,0.45)',
    text: '#7DDB82',
  },
  warn: {
    bg: 'rgba(245,166,35,0.14)',
    border: 'rgba(245,166,35,0.45)',
    text: '#F5C842',
  },
  bad: {
    bg: 'rgba(255,82,82,0.12)',
    border: 'rgba(255,82,82,0.4)',
    text: '#FF8A80',
  },
  neutral: {
    bg: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.14)',
    text: 'rgba(255,255,255,0.82)',
  },
};

interface Props {
  route: Route;
  city: City;
  variant?: 'detail' | 'list';
  /** Cap the number of chips shown (defaults: 5 for list, all for detail) */
  max?: number;
}

export default function RouteTraitChips({
  route,
  city,
  variant = 'detail',
  max,
}: Props) {
  const traits = routeTraits(route, city);
  if (!traits.length) return null;

  const isList = variant === 'list';
  const limit = max ?? (isList ? 5 : undefined);
  const shown = limit ? traits.slice(0, limit) : traits;

  return (
    <View style={[styles.row, isList && styles.rowList]}>
      {shown.map(trait => {
        const tone = TONE_STYLES[trait.tone];
        return (
          <View
            key={trait.label}
            style={[
              styles.chip,
              isList && styles.chipList,
              { backgroundColor: tone.bg, borderColor: tone.border },
            ]}
          >
            <Text style={[styles.chipText, isList && styles.chipTextList, { color: tone.text }]}>
              {trait.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  rowList: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 4,
    marginTop: 4,
  },
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipList: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextList: {
    fontSize: 11,
    fontWeight: '600',
  },
});
