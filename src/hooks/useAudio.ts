import { useState, useRef, useCallback, useEffect } from 'react';
import {
  createAudioPlayer,
  setAudioModeAsync,
  setIsAudioActiveAsync,
  type AudioPlayer,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import AUDIO_MAP from '../data/audioAssets';

const ENJOY_MOMENT_PAUSE_MS = 5000; // silence after clip before music resumes

export type AudioState = 'idle' | 'chime' | 'narrating' | 'moment_pause';

export function useAudio() {
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [currentClipName, setCurrentClipName] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionActiveRef = useRef(false);
  const audioStateRef = useRef<AudioState>('idle');
  audioStateRef.current = audioState;

  const activateSession = useCallback(async () => {
    if (sessionActiveRef.current) return;
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      shouldPlayInBackground: true,
    });
    await setIsAudioActiveAsync(true);
    sessionActiveRef.current = true;
  }, []);

  const deactivateSession = useCallback(async () => {
    if (!sessionActiveRef.current) return;
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
    await setIsAudioActiveAsync(false).catch(() => {});
    sessionActiveRef.current = false;
  }, []);

  const stopCurrent = useCallback(async () => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.remove();
      playerRef.current = null;
    }
    await deactivateSession();
    setAudioState('idle');
    setCurrentClipName(null);
  }, [deactivateSession]);

  /**
   * Play a narration clip. Ducks system audio (Spotify / Apple Music),
   * plays the clip, holds an "enjoy the moment" pause, then releases
   * the audio session so the runner's music comes back naturally.
   */
  const playClip = useCallback(
    async (audioFile: string, clipName: string) => {
      await stopCurrent();
      await activateSession();

      setCurrentClipName(clipName);
      setAudioState('chime');

      const asset = AUDIO_MAP[audioFile];
      if (!asset) {
        console.warn(`[useAudio] No asset registered for: ${audioFile}. Skipping.`);
        await deactivateSession();
        setAudioState('idle');
        setCurrentClipName(null);
        return;
      }

      let player: AudioPlayer;
      try {
        player = createAudioPlayer(asset);
      } catch {
        console.warn(`[useAudio] Failed to load: ${audioFile}. Skipping.`);
        await deactivateSession();
        setAudioState('idle');
        setCurrentClipName(null);
        return;
      }

      playerRef.current = player;
      setAudioState('narrating');

      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          setAudioState('moment_pause');
          pauseTimerRef.current = setTimeout(async () => {
            await stopCurrent();
          }, ENJOY_MOMENT_PAUSE_MS);
        }
      });

      player.play();
    },
    [activateSession, deactivateSession, stopCurrent],
  );

  /** Short TTS cue — only when no POI narration is playing. */
  const speakNudge = useCallback((text: string) => {
    if (audioStateRef.current !== 'idle') return;
    Speech.stop();
    Speech.speak(text, {
      language: 'en-US',
      rate: 1.05,
      pitch: 1.0,
    });
  }, []);

  const stopNudge = useCallback(() => {
    Speech.stop();
  }, []);

  useEffect(() => {
    return () => {
      stopCurrent();
      Speech.stop();
    };
  }, [stopCurrent]);

  return {
    audioState,
    currentClipName,
    playClip,
    stopCurrent,
    speakNudge,
    stopNudge,
    isPlaying: audioState === 'narrating',
  };
}
