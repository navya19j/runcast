import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

const ENJOY_MOMENT_PAUSE_MS = 5000; // silence after clip before music resumes
const CHIME_FADE_IN_MS = 800;

export type AudioState = 'idle' | 'chime' | 'narrating' | 'moment_pause';

export function useAudio() {
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [currentClipName, setCurrentClipName] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionActiveRef = useRef(false);

  // Configure audio session: duck other apps (Spotify, Apple Music, etc.)
  // when we play, restore when we stop.
  const activateSession = useCallback(async () => {
    if (sessionActiveRef.current) return;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeIOS: 1, // DuckOthers = 2, but expo-av uses numeric on some versions
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    sessionActiveRef.current = true;
  }, []);

  const deactivateSession = useCallback(async () => {
    if (!sessionActiveRef.current) return;
    // Release audio session so the OS restores background music
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeIOS: 2, // MixWithOthers — lets music come back
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
    });
    sessionActiveRef.current = false;
  }, []);

  const stopCurrent = useCallback(async () => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    await deactivateSession();
    setAudioState('idle');
    setCurrentClipName(null);
  }, [deactivateSession]);

  /**
   * Play a narration clip. Ducks system audio, plays clip, holds a
   * "enjoy the moment" pause, then releases the audio session so
   * the runner's music comes back naturally.
   */
  const playClip = useCallback(
    async (audioFile: string, clipName: string) => {
      await stopCurrent();
      await activateSession();

      setCurrentClipName(clipName);
      setAudioState('chime');

      let sound: Audio.Sound;
      try {
        const { sound: s } = await Audio.Sound.createAsync(
          // Assets are bundled at build time. At runtime we require dynamically.
          // For MVP we use a try/catch so missing files degrade gracefully.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require(`../../assets/audio/${audioFile}`),
          { shouldPlay: false, volume: 1.0 },
        );
        sound = s;
      } catch {
        console.warn(`[useAudio] Audio file not found: ${audioFile}. Skipping.`);
        await deactivateSession();
        setAudioState('idle');
        setCurrentClipName(null);
        return;
      }

      soundRef.current = sound;
      setAudioState('narrating');

      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          // Clip finished → enjoy-the-moment pause
          setAudioState('moment_pause');
          pauseTimerRef.current = setTimeout(async () => {
            await stopCurrent();
          }, ENJOY_MOMENT_PAUSE_MS);
        }
      });

      await sound.playAsync();
    },
    [activateSession, deactivateSession, stopCurrent],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCurrent();
    };
  }, [stopCurrent]);

  return {
    audioState,
    currentClipName,
    playClip,
    stopCurrent,
    isPlaying: audioState === 'narrating',
  };
}
