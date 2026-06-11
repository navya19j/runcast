import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

interface Props {
  children: React.ReactNode;
  onReset?: () => void;
}
interface State {
  error: Error | null;
  resetKey: number;
}

/**
 * Catches render/runtime errors so a bug shows a readable message instead of
 * hard-crashing the app (which, in a Release build, just drops to the home
 * screen with no clue why).
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error);
  }

  reset = () => {
    // Remount the subtree fresh so the app returns to its initial state.
    this.setState(s => ({ error: null, resetKey: s.resetKey + 1 }));
    this.props.onReset?.();
  };

  render() {
    const { error, resetKey } = this.state;
    if (!error) {
      return <View key={resetKey} style={styles.fill}>{this.props.children}</View>;
    }
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Something broke</Text>
          <Text style={styles.message}>{error.message}</Text>
          {error.stack ? <Text style={styles.stack}>{error.stack}</Text> : null}
        </ScrollView>
        <TouchableOpacity style={styles.button} onPress={this.reset} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: { flex: 1, backgroundColor: '#0D0C0A' },
  content: { padding: 20, gap: 12 },
  title: { color: '#FF8A80', fontSize: 20, fontWeight: '800' },
  message: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  stack: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Courier' },
  button: {
    margin: 16,
    backgroundColor: '#F5A623',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonText: { color: '#0D0C0A', fontSize: 16, fontWeight: '800' },
});
