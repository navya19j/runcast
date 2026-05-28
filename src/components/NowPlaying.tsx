import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { AudioState } from '../hooks/useAudio';
import { Mode } from '../data/types';

interface NowPlayingProps {
  audioState: AudioState;
  clipName: string | null;
  mode: Mode;
}

const MODE_LABELS: Record<Mode, string> = {
  history: '🏛 History',
  food: '🥐 Food',
  sightseeing: '📸 Sightseeing',
  local: '🏘 Local Life',
};

const STATE_LABELS: Record<AudioState, string> = {
  idle: '',
  chime: 'Coming up…',
  narrating: 'Now playing',
  moment_pause: 'Take it in…',
};

export default function NowPlaying({ audioState, clipName, mode }: NowPlayingProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(20)).current;

  const visible = audioState !== 'idle';

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, useNativeDriver: true, tension: 80 }),
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 20, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity, slideY]);

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY: slideY }] }]}>
      <View style={styles.pill}>
        <View style={styles.dot} />
        <View style={styles.textBlock}>
          <Text style={styles.stateLabel}>{STATE_LABELS[audioState]}</Text>
          {clipName && <Text style={styles.clipName}>{clipName}</Text>}
          <Text style={styles.modeLabel}>{MODE_LABELS[mode]}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
    pointerEvents: 'none',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 15, 15, 0.88)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  textBlock: {
    gap: 2,
  },
  stateLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  clipName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modeLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
  },
});
