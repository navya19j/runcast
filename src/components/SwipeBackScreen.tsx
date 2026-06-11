import React, { useRef, useEffect, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  View,
  Platform,
} from 'react-native';

const EDGE_ZONE_W = 28;
const DISMISS_DRAG = 72;
const DISMISS_VELOCITY = 0.35;

interface SwipeBackScreenProps {
  children: React.ReactNode;
  onBack: () => void;
  enabled?: boolean;
}

/**
 * iOS-style edge swipe to go back. Gesture starts in a narrow left strip
 * so maps and scroll views keep working normally.
 */
export default function SwipeBackScreen({
  children,
  onBack,
  enabled = true,
}: SwipeBackScreenProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const width = Dimensions.get('window').width;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    translateX.setValue(0);
  }, [translateX]);

  const finishBack = useCallback(() => {
    onBackRef.current();
    translateX.setValue(0);
  }, [translateX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx > 4 && Math.abs(g.dy) < Math.abs(g.dx) * 0.85,
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) translateX.setValue(Math.min(g.dx, width));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > DISMISS_DRAG || g.vx > DISMISS_VELOCITY) {
          Animated.timing(translateX, {
            toValue: width,
            duration: 220,
            useNativeDriver: true,
          }).start(finishBack);
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 14,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  if (!enabled || Platform.OS !== 'ios') {
    return <>{children}</>;
  }

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.content, { transform: [{ translateX }] }]}>
        {children}
      </Animated.View>
      <View style={styles.edgeZone} {...panResponder.panHandlers} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0C0A',
  },
  content: {
    flex: 1,
    backgroundColor: '#0D0C0A',
  },
  edgeZone: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: EDGE_ZONE_W,
    zIndex: 100,
  },
});
