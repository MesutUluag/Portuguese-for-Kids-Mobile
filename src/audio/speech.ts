import { Alert } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { getJSON, setJSON, STORAGE_KEYS } from '@/utils/storage';

export interface SpeechSpeakOptions {
  rate?: number;
  language?: 'en' | 'tr';
  onDone?: () => void;
}

export interface SpeakAndScheduleOptions {
  language?: 'en' | 'tr';
  rate?: number;
  minDelayMs?: number;
  postSpeechPauseMs?: number;
  fallbackMs?: number;
  onAdvance: () => void;
}

let audioSessionConfigured = false;
let cachedVoiceId: string | null | undefined;
let voiceLookupPromise: Promise<string | null> | null = null;
let speakGeneration = 0;
let deferredSpeakTimer: ReturnType<typeof setTimeout> | null = null;

async function ensureAudioModeConfigured(): Promise<void> {
  if (audioSessionConfigured) return;
  audioSessionConfigured = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      shouldPlayInBackground: false,
    });
  } catch (err) {
    console.warn('[speech] Failed to configure audio mode:', err);
  }
}

function pickBestPortugueseVoice(voices: Speech.Voice[]): Speech.Voice | undefined {
  return (
    voices.find((v) => v.language.toLowerCase() === 'pt-pt') ??
    voices.find(
      (v) =>
        v.language.toLowerCase().startsWith('pt') &&
        !v.language.toLowerCase().includes('br'),
    ) ??
    voices.find((v) => v.name.toLowerCase().includes('portugal')) ??
    voices.find((v) => v.language.toLowerCase().startsWith('pt')) ??
    voices.find((v) => v.name.toLowerCase().includes('portuguese'))
  );
}

async function maybeShowMissingVoiceHint(uiLanguage: 'en' | 'tr'): Promise<void> {
  const alreadyShown = await getJSON<boolean>(
    STORAGE_KEYS.PT_VOICE_HINT_SHOWN,
    (v): v is boolean => typeof v === 'boolean',
  );
  if (alreadyShown) return;
  await setJSON(STORAGE_KEYS.PT_VOICE_HINT_SHOWN, true);

  const isTr = uiLanguage === 'tr';
  Alert.alert(
    isTr ? 'Avrupa Portekizcesi Sesi' : 'European Portuguese Voice',
    isTr
      ? 'Cihazınızda Portekizce (Portekiz) konuşma sesi bulunamadı. Daha doğal telaffuz için cihaz Ayarlarından Portekizce (Portekiz) sesini indirebilirsiniz.'
      : 'No Portuguese (Portugal) system voice was detected. You can download the Portuguese (Portugal) voice in your device Settings for clearer pronunciation.',
  );
}

async function resolvePortugueseVoiceId(uiLanguage: 'en' | 'tr'): Promise<string | null> {
  if (cachedVoiceId !== undefined) {
    return cachedVoiceId;
  }
  if (voiceLookupPromise) {
    return voiceLookupPromise;
  }

  voiceLookupPromise = (async () => {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const chosen = pickBestPortugueseVoice(voices);
      cachedVoiceId = chosen?.identifier ?? null;

      if (voices.length > 0 && !chosen?.language.toLowerCase().includes('pt-pt') && !chosen?.name.toLowerCase().includes('portugal')) {
        void maybeShowMissingVoiceHint(uiLanguage);
      }
      return cachedVoiceId;
    } catch (err) {
      console.warn('[speech] Unable to enumerate voices:', err);
      cachedVoiceId = null;
      return null;
    } finally {
      voiceLookupPromise = null;
    }
  })();

  return voiceLookupPromise;
}

/**
 * Stops any currently playing or queued speech synthesis utterance immediately.
 */
export function cancelSpeech(): void {
  speakGeneration += 1;
  if (deferredSpeakTimer) {
    clearTimeout(deferredSpeakTimer);
    deferredSpeakTimer = null;
  }
  try {
    void Speech.stop();
  } catch (err) {
    console.warn('[speech] Failed to stop speech:', err);
  }
}

/**
 * Speaks European Portuguese text aloud using device TTS via `expo-speech`.
 * Always cancels any active utterance first and selects the best `pt-PT` voice.
 */
export function speakText(text: string, options: SpeechSpeakOptions = {}): void {
  const trimmed = text.trim();
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    options.onDone?.();
  };

  if (!trimmed) {
    finish();
    return;
  }

  cancelSpeech();
  const generation = speakGeneration;
  const uiLanguage = options.language ?? 'en';

  void (async () => {
    await ensureAudioModeConfigured();
    const voiceId = await resolvePortugueseVoiceId(uiLanguage);
    if (generation !== speakGeneration) return;

    deferredSpeakTimer = setTimeout(() => {
      deferredSpeakTimer = null;
      if (generation !== speakGeneration) return;
      try {
        Speech.speak(trimmed, {
          language: 'pt-PT',
          voice: voiceId ?? undefined,
          rate: options.rate ?? 0.85,
          pitch: 1.0,
          volume: 1.0,
          useApplicationAudioSession: true,
          onDone: () => {
            if (generation === speakGeneration) finish();
          },
          onStopped: () => {
            if (generation === speakGeneration) finish();
          },
          onError: (err) => {
            console.warn('[speech] Utterance error:', err.message);
            if (generation === speakGeneration) finish();
          },
        });
      } catch (err) {
        console.warn('[speech] Failed to invoke Speech.speak:', err);
        if (generation === speakGeneration) finish();
      }
    }, 30);
  })();
}

/**
 * Speaks `text` and invokes `onAdvance` after speech completes (plus a short pause),
 * enforcing `minDelayMs` minimum visibility and `fallbackMs` maximum wait.
 * Returns a cancel function to clear any pending transition timer.
 */
export function speakAndSchedule(
  text: string,
  {
    language,
    rate,
    minDelayMs = 950,
    postSpeechPauseMs = 250,
    fallbackMs = 2600,
    onAdvance,
  }: SpeakAndScheduleOptions,
): () => void {
  const startedAt = Date.now();
  let completed = false;
  let cancelled = false;

  const runAdvance = () => {
    if (cancelled || completed) return;
    completed = true;
    onAdvance();
  };

  let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    timer = null;
    runAdvance();
  }, fallbackMs);

  speakText(text, {
    language,
    rate,
    onDone: () => {
      if (cancelled || completed) return;
      const elapsed = Date.now() - startedAt;
      const waitMore = Math.max(postSpeechPauseMs, minDelayMs - elapsed);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        runAdvance();
      }, waitMore);
    },
  });

  return () => {
    cancelled = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
