import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ConditionRating } from '../utils/routeConditions';

const TONE: Record<ConditionRating, { dot: string; text: string; bg: string; border: string }> = {
  ideal: { dot: '#5DBF72', text: '#7DDB82', bg: 'rgba(76,175,80,0.14)',  border: 'rgba(76,175,80,0.40)' },
  good:  { dot: '#F5A623', text: '#F5C842', bg: 'rgba(245,166,35,0.14)', border: 'rgba(245,166,35,0.40)' },
  fair:  { dot: '#E8890C', text: '#F2A65A', bg: 'rgba(232,137,12,0.14)', border: 'rgba(232,137,12,0.42)' },
  poor:  { dot: '#FF5252', text: '#FF8A80', bg: 'rgba(255,82,82,0.12)',  border: 'rgba(255,82,82,0.40)' },
};

interface Props {
  rating: ConditionRating;
  label: string;
  reason?: string;
  variant?: 'list' | 'detail';
}

export default function ConditionPill({ rating, label, reason, variant = 'list' }: Props) {
  const tone = TONE[rating];
  const isDetail = variant === 'detail';

  return (
    <View style={[styles.row, isDetail && styles.rowDetail]}>
      <View
        style={[
          styles.pill,
          isDetail && styles.pillDetail,
          { backgroundColor: tone.bg, borderColor: tone.border },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: tone.dot }]} />
        <Text style={[styles.label, isDetail && styles.labelDetail, { color: tone.text }]}>
          {label}
        </Text>
      </View>
      {reason ? (
        <Text
          style={[styles.reason, isDetail && styles.reasonDetail]}
          numberOfLines={isDetail ? 2 : 1}
        >
          {reason}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  rowDetail: { gap: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  pillDetail: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 11, fontWeight: '700' },
  labelDetail: { fontSize: 13 },
  reason: {
    flex: 1,
    minWidth: 0,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '500',
  },
  reasonDetail: { fontSize: 13, lineHeight: 18 },
});
