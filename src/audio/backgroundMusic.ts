import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createAudioPlayer, type AudioPlayer, type AudioSource } from 'expo-audio';
import {
  ensureAppAudioSession,
  isSpeechActive,
  subscribeSpeechActivity,
} from '@/audio/audioSession';
import { IS_DEV } from '@/config';
import { getJSON, setJSON, STORAGE_KEYS } from '@/utils/storage';

const BACKGROUND_MUSIC_VOLUME = 0.01;
const SPEECH_RESUME_DELAY_MS = 300;
const STATUS_UPDATE_INTERVAL_MS = 4000;

const MUSIC_TRACKS: readonly AudioSource[] = [
  require('../../assets/music/alex-morgan-kids-background-music-579469.mp3') as AudioSource,
  require('../../assets/music/alex-morgan-kids-playground-giggles-parade-578468.mp3') as AudioSource,
  require('../../assets/music/nastelbom-kids-happy-488308.mp3') as AudioSource,
  require('../../assets/music/playstarz_music-kids-happy-background-music-442778.mp3') as AudioSource,
  require('../../assets/music/sigmamusicart-kids-happy-background-music-401734.mp3') as AudioSource,
];

function pickNextTrackIndex(lastIdx: number): number {
  const candidates = MUSIC_TRACKS.map((_, i) => i).filter((i) => i !== lastIdx);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
}

/**
 * Plays shuffled bundled background music at gentle volume while respecting
 * persisted mute preference (`kids_music_enabled`) and AppState backgrounding.
 */
export function useBackgroundMusic() {
  const [musicEnabled, setMusicEnabled] = useState<boolean>(() => !IS_DEV);
  const [prefsLoaded, setPrefsLoaded] = useState<boolean>(false);
  const playerRef = useRef<AudioPlayer | null>(null);
  const lastTrackIdxRef = useRef<number>(-1);
  const musicEnabledRef = useRef<boolean>(!IS_DEV);
  const prefsLoadedRef = useRef<boolean>(false);
  const userToggledRef = useRef<boolean>(false);
  const speechPausedRef = useRef<boolean>(false);
  const appActiveRef = useRef<boolean>(
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  );
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    musicEnabledRef.current = musicEnabled;
  }, [musicEnabled]);

  const startNextTrack = useCallback((player: AudioPlayer) => {
    const nextIdx = pickNextTrackIndex(lastTrackIdxRef.current);
    lastTrackIdxRef.current = nextIdx;
    const source = MUSIC_TRACKS[nextIdx];
    if (!source) return;
    try {
      player.replace(source);
      player.volume = BACKGROUND_MUSIC_VOLUME;
      player.play();
    } catch {
      // Ignore native playback errors in unsupported/test environments
    }
  }, []);

  // Load persisted mute preference before starting playback to avoid a muted cold-start blip.
  useEffect(() => {
    let mounted = true;
    void getJSON<boolean>(
      STORAGE_KEYS.MUSIC_ENABLED,
      (v): v is boolean => typeof v === 'boolean',
    )
      .then((saved) => {
        if (!mounted) return;
        if (!userToggledRef.current && saved !== null) {
          musicEnabledRef.current = saved;
          setMusicEnabled(saved);
        }
      })
      .finally(() => {
        if (!mounted) return;
        prefsLoadedRef.current = true;
        setPrefsLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Create player + playback completion + AppState + speech-first listeners.
  useEffect(() => {
    let mounted = true;
    let player: AudioPlayer | null = null;
    try {
      speechPausedRef.current = isSpeechActive();

      const initialIdx = pickNextTrackIndex(-1);
      lastTrackIdxRef.current = initialIdx;
      player = createAudioPlayer(MUSIC_TRACKS[initialIdx] ?? null, {
        updateInterval: STATUS_UPDATE_INTERVAL_MS,
      });
      player.volume = BACKGROUND_MUSIC_VOLUME;
      playerRef.current = player;

      const createdPlayer = player;
      void ensureAppAudioSession().then(() => {
        if (!mounted || playerRef.current !== createdPlayer) return;
        try {
          if (
            prefsLoadedRef.current &&
            musicEnabledRef.current &&
            !speechPausedRef.current &&
            appActiveRef.current &&
            !createdPlayer.playing
          ) {
            createdPlayer.volume = BACKGROUND_MUSIC_VOLUME;
            createdPlayer.play();
          }
        } catch {
          // Ignore native playback errors in unsupported/test environments
        }
      });
    } catch {
      return;
    }

    const activePlayer = player;
    const statusSub = activePlayer.addListener('playbackStatusUpdate', (status) => {
      if (
        prefsLoadedRef.current &&
        status.didJustFinish &&
        musicEnabledRef.current &&
        !speechPausedRef.current &&
        appActiveRef.current
      ) {
        startNextTrack(activePlayer);
      }
    });

    const unsubSpeech = subscribeSpeechActivity((speaking) => {
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      try {
        if (speaking) {
          speechPausedRef.current = true;
          if (activePlayer.playing) {
            activePlayer.pause();
          }
        } else {
          resumeTimerRef.current = setTimeout(() => {
            resumeTimerRef.current = null;
            if (isSpeechActive()) return;
            speechPausedRef.current = false;
            try {
              if (
                prefsLoadedRef.current &&
                musicEnabledRef.current &&
                appActiveRef.current &&
                !activePlayer.playing
              ) {
                activePlayer.volume = BACKGROUND_MUSIC_VOLUME;
                activePlayer.play();
              }
            } catch {
              // Ignore native playback errors
            }
          }, SPEECH_RESUME_DELAY_MS);
        }
      } catch {
        // Ignore player teardown races
      }
    });

    const appSub = AppState.addEventListener('change', (nextState) => {
      appActiveRef.current = nextState === 'active';
      try {
        if (nextState === 'active') {
          void ensureAppAudioSession().then(() => {
            if (!mounted || playerRef.current !== activePlayer) return;
            try {
              if (
                prefsLoadedRef.current &&
                musicEnabledRef.current &&
                !speechPausedRef.current &&
                appActiveRef.current &&
                !activePlayer.playing
              ) {
                activePlayer.volume = BACKGROUND_MUSIC_VOLUME;
                activePlayer.play();
              }
            } catch {
              // Ignore player teardown races
            }
          });
        } else if (activePlayer.playing) {
          activePlayer.pause();
        }
      } catch {
        // Ignore player teardown races
      }
    });

    return () => {
      mounted = false;
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      unsubSpeech();
      statusSub.remove();
      appSub.remove();
      playerRef.current = null;
      try {
        activePlayer.pause();
        activePlayer.remove();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [startNextTrack]);

  // Apply mute/unmute transitions cleanly once persisted preference has hydrated.
  useEffect(() => {
    if (!prefsLoaded) return;
    const player = playerRef.current;
    if (!player) return;
    let active = true;
    try {
      if (!musicEnabled) {
        if (player.playing) player.pause();
      } else if (!speechPausedRef.current && appActiveRef.current && !player.playing) {
        void ensureAppAudioSession().then(() => {
          if (!active || playerRef.current !== player) return;
          try {
            if (
              musicEnabledRef.current &&
              !speechPausedRef.current &&
              appActiveRef.current &&
              !player.playing
            ) {
              player.volume = BACKGROUND_MUSIC_VOLUME;
              player.play();
            }
          } catch {
            // Ignore native errors
          }
        });
      }
    } catch {
      // Ignore native errors
    }
    return () => {
      active = false;
    };
  }, [musicEnabled, prefsLoaded]);

  const toggleMusic = useCallback(() => {
    userToggledRef.current = true;
    setMusicEnabled((prev) => {
      const next = !prev;
      musicEnabledRef.current = next;
      void setJSON(STORAGE_KEYS.MUSIC_ENABLED, next);
      return next;
    });
  }, []);

  return { musicEnabled, toggleMusic };
}
