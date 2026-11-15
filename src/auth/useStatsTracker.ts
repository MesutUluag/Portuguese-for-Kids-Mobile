import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { fetchWithAuth } from '@/api/client';
import { useAuthState } from '@/auth/AuthContext';
import {
  buildSyncPayload,
  createEmptyOutbox,
  deductSentDeltas,
  getLocalDateString,
  hasOutboxDeltas,
  isTelemetryOutbox,
  resolveOutboxForUid,
} from '@/auth/telemetryHelpers';
import { isUserProfile, type TelemetryOutbox, type UserProfile } from '@/auth/types';
import type { StoryContext } from '@/core/data/storyTopics';
import type { Mode } from '@/core/data/types';
import { getJSON, setJSON, STORAGE_KEYS } from '@/utils/storage';

const IDLE_TIMEOUT_MS = 180_000; // 3 minutes without interaction
const SAVE_THROTTLE_MS = 5_000;
const SCORE_FLUSH_DEBOUNCE_MS = 2_000;

export function useStatsTracker(currentMode: Mode) {
  const {
    user,
    profile,
    authReady,
    setProfile,
    registerBeforeSignOut,
    registerFlushHandler,
    registerDiscardOutboxHandler,
  } = useAuthState();

  const currentUid = user ? user.uid : 'guest';
  const currentUidRef = useRef<string>(currentUid);
  const outboxRef = useRef<TelemetryOutbox>(createEmptyOutbox(currentUid));
  const outboxReadyRef = useRef<boolean>(false);
  const lastInteractionRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);
  const appStateRef = useRef<string>(
    AppState.currentState === 'background' || AppState.currentState === 'inactive'
      ? AppState.currentState
      : 'active',
  );
  const modeRef = useRef<Mode>(currentMode);
  const profileRef = useRef<UserProfile | null>(profile);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todaySecondsListenersRef = useRef<Set<(seconds: number) => void>>(new Set());
  const [unsyncedScoreByMode, setUnsyncedScoreByMode] = useState<Partial<Record<Mode, number>>>({});

  const getTodayTimeSeconds = useCallback((): number => {
    const synced = profileRef.current?.stats?.dailyTimeSeconds?.[getLocalDateString()] ?? 0;
    return synced + outboxRef.current.activeSecondsDelta;
  }, []);

  const notifyTodaySecondsListeners = useCallback(() => {
    const nextSeconds = getTodayTimeSeconds();
    todaySecondsListenersRef.current.forEach((listener) => listener(nextSeconds));
  }, [getTodayTimeSeconds]);

  const subscribeTodayTimeSeconds = useCallback(
    (listener: (seconds: number) => void): (() => void) => {
      todaySecondsListenersRef.current.add(listener);
      listener(getTodayTimeSeconds());
      return () => {
        todaySecondsListenersRef.current.delete(listener);
      };
    },
    [getTodayTimeSeconds],
  );

  useEffect(() => {
    currentUidRef.current = currentUid;
  }, [currentUid]);

  useEffect(() => {
    profileRef.current = profile;
    notifyTodaySecondsListeners();
  }, [profile, notifyTodaySecondsListeners]);

  useEffect(() => {
    modeRef.current = currentMode;
  }, [currentMode]);

  const persistOutboxNow = useCallback((outbox: TelemetryOutbox) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    void setJSON(STORAGE_KEYS.OUTBOX, outbox);
  }, []);

  const scheduleSaveOutbox = useCallback(() => {
    if (saveTimerRef.current) {
      return;
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void setJSON(STORAGE_KEYS.OUTBOX, outboxRef.current);
    }, SAVE_THROTTLE_MS);
  }, []);

  const notifyInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  const discardOutbox = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (scoreFlushTimerRef.current) {
      clearTimeout(scoreFlushTimerRef.current);
      scoreFlushTimerRef.current = null;
    }
    outboxRef.current = createEmptyOutbox('guest');
    setUnsyncedScoreByMode({});
    notifyTodaySecondsListeners();
  }, [notifyTodaySecondsListeners]);

  const flush = useCallback(async (): Promise<void> => {
    if (scoreFlushTimerRef.current) {
      clearTimeout(scoreFlushTimerRef.current);
      scoreFlushTimerRef.current = null;
    }
    if (!user || !outboxReadyRef.current) return;
    const outbox = outboxRef.current;
    if (!hasOutboxDeltas(outbox) || isSyncingRef.current) return;

    isSyncingRef.current = true;
    const payload =
      outbox.pendingBatch ??
      buildSyncPayload(outbox, undefined, Crypto.randomUUID());
    if (!outbox.pendingBatch) {
      outbox.pendingBatch = payload;
      persistOutboxNow(outbox);
    }

    try {
      const updatedProfile = await fetchWithAuth<UserProfile>('/user/stats/sync', {
        method: 'POST',
        body: JSON.stringify(payload),
        requireAuth: true,
        validate: isUserProfile,
      });
      setProfile(updatedProfile);
      const remaining = deductSentDeltas(outboxRef.current, payload);
      outboxRef.current = remaining;
      setUnsyncedScoreByMode({ ...remaining.scoreByModeDelta });
      persistOutboxNow(remaining);
      const nextSeconds =
        (updatedProfile.stats?.dailyTimeSeconds?.[getLocalDateString()] ?? 0) +
        remaining.activeSecondsDelta;
      todaySecondsListenersRef.current.forEach((listener) => listener(nextSeconds));
    } catch (err) {
      console.warn('[telemetry] Sync error (kept in outbox with batchId):', err);
    } finally {
      isSyncingRef.current = false;
    }
  }, [persistOutboxNow, setProfile, user]);

  // Hydrate outbox from AsyncStorage once on startup before any flush runs.
  useEffect(() => {
    let mounted = true;
    void getJSON<TelemetryOutbox>(STORAGE_KEYS.OUTBOX, isTelemetryOutbox).then(
      (loaded) => {
        if (!mounted) return;
        const resolved = resolveOutboxForUid(loaded, currentUidRef.current);
        outboxRef.current = resolved;
        outboxReadyRef.current = true;
        setUnsyncedScoreByMode({ ...resolved.scoreByModeDelta });
        notifyTodaySecondsListeners();
        if (loaded && loaded.ownerUid !== resolved.ownerUid) {
          persistOutboxNow(resolved);
        }
        if (currentUidRef.current !== 'guest') {
          void flush();
        }
      },
    );

    return () => {
      mounted = false;
    };
  }, [flush, notifyTodaySecondsListeners, persistOutboxNow]);

  // Register signout, flush, and account-delete discard handlers.
  useEffect(() => {
    registerBeforeSignOut(flush);
    registerFlushHandler(flush);
    registerDiscardOutboxHandler(discardOutbox);
  }, [discardOutbox, flush, registerBeforeSignOut, registerDiscardOutboxHandler, registerFlushHandler]);

  // Handle user login/switch/signout once auth + outbox are ready.
  useEffect(() => {
    if (!authReady || !outboxReadyRef.current) return;
    if (user) {
      if (outboxRef.current.ownerUid === 'guest') {
        outboxRef.current.ownerUid = user.uid;
        persistOutboxNow(outboxRef.current);
      } else if (outboxRef.current.ownerUid !== user.uid) {
        outboxRef.current = createEmptyOutbox(user.uid);
        persistOutboxNow(outboxRef.current);
      }
      void flush();
    } else if (outboxRef.current.ownerUid !== 'guest') {
      outboxRef.current = createEmptyOutbox('guest');
      persistOutboxNow(outboxRef.current);
    }
  }, [authReady, flush, persistOutboxNow, user]);

  // 1-second active study timer with 3-minute AFK check + AppState awareness.
  useEffect(() => {
    lastInteractionRef.current = Date.now();
    const timer = setInterval(() => {
      if (appStateRef.current !== 'active') return;
      if (Date.now() - lastInteractionRef.current > IDLE_TIMEOUT_MS) return;

      const outbox = outboxRef.current;
      const mode = modeRef.current;
      outbox.activeSecondsDelta += 1;
      outbox.timeByModeDelta[mode] = (outbox.timeByModeDelta[mode] ?? 0) + 1;
      notifyTodaySecondsListeners();
      scheduleSaveOutbox();
    }, 1000);

    return () => {
      clearInterval(timer);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (scoreFlushTimerRef.current) {
        clearTimeout(scoreFlushTimerRef.current);
        scoreFlushTimerRef.current = null;
      }
    };
  }, [notifyTodaySecondsListeners, scheduleSaveOutbox]);

  // Periodic persist + flush every 60 seconds.
  useEffect(() => {
    const interval = setInterval(() => {
      if (outboxReadyRef.current && hasOutboxDeltas(outboxRef.current)) {
        persistOutboxNow(outboxRef.current);
      }
      void flush();
    }, 60_000);
    return () => clearInterval(interval);
  }, [flush, persistOutboxNow]);

  // Flush immediately when connectivity restores.
  useEffect(() => {
    let wasOnline = true;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
      if (isOnline && !wasOnline) {
        void flush();
      }
      wasOnline = isOnline;
    });
    return () => unsubscribe();
  }, [flush]);

  // Flush on mode switch if >=5s accumulated.
  const prevModeRef = useRef<Mode>(currentMode);
  useEffect(() => {
    if (prevModeRef.current !== currentMode) {
      prevModeRef.current = currentMode;
      if (outboxRef.current.activeSecondsDelta >= 5) {
        void flush();
      }
    }
  }, [currentMode, flush]);

  // Flush immediately when app moves to background or inactive.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState === 'active') {
        lastInteractionRef.current = Date.now();
      } else if (
        prevState === 'active' &&
        (nextState === 'background' || nextState === 'inactive')
      ) {
        persistOutboxNow(outboxRef.current);
        void flush();
      }
    });
    return () => sub.remove();
  }, [flush, persistOutboxNow]);

  const recordStoryView = useCallback(
    (context: StoryContext) => {
      const outbox = outboxRef.current;
      outbox.storiesByContextDelta[context] =
        (outbox.storiesByContextDelta[context] ?? 0) + 1;
      persistOutboxNow(outbox);
      void flush();
    },
    [flush, persistOutboxNow],
  );

  const recordGameScore = useCallback(
    (mode: Mode, points: number) => {
      const pts = Math.max(0, points);
      const outbox = outboxRef.current;
      outbox.scoreDelta += pts;
      outbox.scoreByModeDelta[mode] =
        (outbox.scoreByModeDelta[mode] ?? 0) + pts;
      outbox.gamesCompletedDelta[mode] =
        (outbox.gamesCompletedDelta[mode] ?? 0) + 1;
      setUnsyncedScoreByMode({ ...outbox.scoreByModeDelta });
      persistOutboxNow(outbox);
      if (scoreFlushTimerRef.current) {
        clearTimeout(scoreFlushTimerRef.current);
      }
      scoreFlushTimerRef.current = setTimeout(() => {
        scoreFlushTimerRef.current = null;
        void flush();
      }, SCORE_FLUSH_DEBOUNCE_MS);
    },
    [flush, persistOutboxNow],
  );

  const getScoreForMode = useCallback(
    (mode: Mode): number => {
      const stored = profile?.stats?.scoreByMode?.[mode] ?? 0;
      const unsynced = unsyncedScoreByMode[mode] ?? 0;
      return stored + unsynced;
    },
    [profile, unsyncedScoreByMode],
  );

  const unsyncedTotalScore = useMemo(
    () =>
      Object.values(unsyncedScoreByMode).reduce<number>(
        (sum, val) => sum + (val ?? 0),
        0,
      ),
    [unsyncedScoreByMode],
  );

  const recordSpeechListen = useCallback(() => {
    const outbox = outboxRef.current;
    outbox.speechListenDelta += 1;
    scheduleSaveOutbox();
  }, [scheduleSaveOutbox]);

  return {
    notifyInteraction,
    recordStoryView,
    recordGameScore,
    recordSpeechListen,
    getScoreForMode,
    unsyncedTotalScore,
    getTodayTimeSeconds,
    subscribeTodayTimeSeconds,
    flushNow: flush,
  };
}
