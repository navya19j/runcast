import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  value: number;            // 0..5 (0 = unrated)
  onRate?: (stars: number) => void;
  size?: number;
  /** Display only — no touch targets */
  readOnly?: boolean;
}

const AMBER = '#F5A623';
const EMPTY = 'rgba(255,255,255,0.22)';

export default function StarRating({ value, onRate, size = 28, readOnly = false }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map(n => {
        const filled = n <= value;
        const star = (
          <Text style={[styles.star, { fontSize: size, color: filled ? AMBER : EMPTY }]}>
            {filled ? '★' : '☆'}
          </Text>
        );
        if (readOnly || !onRate) {
          return <View key={n} style={styles.tap}>{star}</View>;
        }
        return (
          <TouchableOpacity
            key={n}
            onPress={() => onRate(n)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={styles.tap}
          >
            {star}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  tap: { paddingHorizontal: 2 },
  star: { lineHeight: undefined },
});
