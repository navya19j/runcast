import { useCallback, useRef, useState } from 'react';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

export interface VoiceClip {
  uri: string;
  durationSec: number;
}

/**
 * Tap-to-talk voice memo recorder built on expo-audio. `start()` returns false
 * if mic permission is denied; `stop()` resolves with the recorded clip.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const startedAtRef = useRef(0);

  const start = useCallback(async (): Promise<boolean> => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return false;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    startedAtRef.current = Date.now();
    setRecording(true);
    return true;
  }, [recorder]);

  const stop = useCallback(async (): Promise<VoiceClip | null> => {
    if (!recording) return null;
    try {
      await recorder.stop();
    } finally {
      setRecording(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    }
    const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    return recorder.uri ? { uri: recorder.uri, durationSec } : null;
  }, [recorder, recording]);

  return { recording, start, stop };
}
