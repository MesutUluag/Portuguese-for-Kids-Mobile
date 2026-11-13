import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';
import { IS_DEV } from '@/config';
import { getJSON, setJSON, STORAGE_KEYS } from '@/utils/storage';

const BACKGROUND_MUSIC_VOLUME = 0.04;

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
  const playerRef = useRef<AudioPlayer | null>(null);
  const lastTrackIdxRef = useRef<number>(-1);
  const musicEnabledRef = useRef<boolean>(!IS_DEV);

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

  // Load persisted mute preference once on mount.
  useEffect(() => {
    let mounted = true;
    void getJSON<boolean>(
      STORAGE_KEYS.MUSIC_ENABLED,
      (v): v is boolean => typeof v === 'boolean',
    ).then((saved) => {
      if (!mounted || saved === null) return;
      musicEnabledRef.current = saved;
      setMusicEnabled(saved);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Create player + playback completion + AppState listeners.
  useEffect(() => {
    let player: AudioPlayer | null = null;
    try {
      void setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        shouldPlayInBackground: false,
      }).catch(() => {});

      const initialIdx = pickNextTrackIndex(-1);
      lastTrackIdxRef.current = initialIdx;
      player = createAudioPlayer(MUSIC_TRACKS[initialIdx] ?? null, {
        updateInterval: 1000,
      });
      player.volume = BACKGROUND_MUSIC_VOLUME;
      playerRef.current = player;

      if (musicEnabledRef.current) {
        player.play();
      }
    } catch {
      return;
    }

    const activePlayer = player;
    const statusSub = activePlayer.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish && musicEnabledRef.current) {
        startNextTrack(activePlayer);
      }
    });

    const appSub = AppState.addEventListener('change', (nextState) => {
      try {
        if (nextState === 'active') {
          if (musicEnabledRef.current && !activePlayer.playing) {
            activePlayer.play();
          }
        } else if (activePlayer.playing) {
          activePlayer.pause();
        }
      } catch {
        // Ignore player teardown races
      }
    });

    return () => {
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

  // Apply mute/unmute transitions cleanly.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (!musicEnabled) {
        if (player.playing) player.pause();
      } else if (!player.playing) {
        player.volume = BACKGROUND_MUSIC_VOLUME;
        player.play();
      }
    } catch {
      // Ignore native errors
    }
  }, [musicEnabled]);

  const toggleMusic = useCallback(() => {
    setMusicEnabled((prev) => {
      const next = !prev;
      musicEnabledRef.current = next;
      void setJSON(STORAGE_KEYS.MUSIC_ENABLED, next);
      return next;
    });
  }, []);

  return { musicEnabled, toggleMusic };
}
