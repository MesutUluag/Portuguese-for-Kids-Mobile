import { setAudioModeAsync } from 'expo-audio';

type SpeechActivityListener = (isActive: boolean) => void;

let audioSessionPromise: Promise<void> | null = null;
let speechActive = false;
const listeners = new Set<SpeechActivityListener>();

/**
 * Configures the shared Expo Audio session once for the entire app
 * so `expo-audio` and `expo-speech` do not repeatedly contend over audio mode.
 */
export async function ensureAppAudioSession(): Promise<void> {
  if (!audioSessionPromise) {
    audioSessionPromise = setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      shouldPlayInBackground: false,
    }).catch((err: unknown) => {
      audioSessionPromise = null;
      console.warn('[audio] Failed to configure shared audio mode:', err);
    });
  }
  await audioSessionPromise;
}

export function isSpeechActive(): boolean {
  return speechActive;
}

export function notifySpeechStart(): void {
  if (speechActive) return;
  speechActive = true;
  listeners.forEach((listener) => listener(true));
}

export function notifySpeechEnd(): void {
  if (!speechActive) return;
  speechActive = false;
  listeners.forEach((listener) => listener(false));
}

export function subscribeSpeechActivity(listener: SpeechActivityListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Test-only helper to reset singleton audio session & speech state between unit tests.
 */
export function __resetAudioSessionForTests(): void {
  audioSessionPromise = null;
  speechActive = false;
  listeners.clear();
}
