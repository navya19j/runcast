import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { AudioState } from '../hooks/useAudio';
import { Mode } from '../data/types';

// Three animated bars that pulse when narrating — "on air" broadcast indicator
function WaveformBars({ active }: { active: boolean }) {
  const bar1 = useRef(new Animated.Value(0.4)).current;
  const bar2 = useRef(new Animated.Value(0.8)).current;
  const bar3 = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (!active) {
      [bar1, bar2, bar3].forEach(b =>
        Animated.timing(b, { toValue: 0.3, duration: 300, useNativeDriver: false }).start(),
      );
      return;
    }
    const pulse = (bar: Animated.Value, min: number, max: number, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: max, duration, useNativeDriver: false }),
          Animated.timing(bar, { toValue: min, duration, useNativeDriver: false }),
        ]),
      ).start();
    pulse(bar1, 0.25, 1.0, 320);
    pulse(bar2, 0.5,  1.0, 200);
    pulse(bar3, 0.3,  0.9, 260);
  }, [active, bar1, bar2, bar3]);

  const HEIGHT = 18;
  return (
    <View style={styles.waveform}>
      {[bar1, bar2, bar3].map((b, i) => (
        <Animated.View
          key={i}
          style={[styles.bar, {
            height: b.interpolate({ inputRange: [0, 1], outputRange: [4, HEIGHT] }),
          }]}
        />
      ))}
    </View>
  );
}

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
        <WaveformBars active={audioState === 'narrating'} />
        <View style={styles.textBlock}>
          <Text style={styles.stateLabel}>{STATE_LABELS[audioState]}</Text>
          {clipName && <Text style={styles.clipName}>{clipName}</Text>}
          <Text style={styles.modeLabel}>{MODE_LABELS[mode]}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// RunCast's "on air" indicator — broadcast amber, Spotify mini-player structure
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    zIndex: 100,
    pointerEvents: 'none',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,12,10,0.93)',
    paddingLeft: 14,
    paddingRight: 14,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.30)',
  },
  // Left: animated broadcast bars (three thin rects)
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    width: 18,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#F5A623',
  },
  dot: {               // unused — kept for type compat, hidden
    width: 0,
    height: 0,
  },
  dotInner: {
    width: 0,
    height: 0,
  },
  textBlock: {
    flex: 1,
    gap: 1,
  },
  stateLabel: {
    color: '#F5A623',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  clipName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  modeLabel: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 10,
    fontWeight: '500',
  },
});
