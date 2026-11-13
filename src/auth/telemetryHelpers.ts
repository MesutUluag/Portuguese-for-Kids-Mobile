import type { Mode } from '@/core/data/types';
import type { StoryContext } from '@/core/data/storyTopics';
import type { StatsSyncRequest, TelemetryOutbox, UserProfile } from '@/auth/types';

const GUEST_MERGE_MAX_AGE_MS = 86_400_000; // 24 hours

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createEmptyOutbox(
  ownerUid: string,
  now: number = Date.now(),
): TelemetryOutbox {
  return {
    ownerUid,
    createdAt: now,
    activeSecondsDelta: 0,
    timeByModeDelta: {},
    gamesCompletedDelta: {},
    storiesByContextDelta: {},
    scoreDelta: 0,
    scoreByModeDelta: {},
    speechListenDelta: 0,
  };
}

function isPlainRecordOfNumbers(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
  );
}

function isStatsSyncRequest(value: unknown): value is StatsSyncRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.activeSecondsDelta === 'number' &&
    typeof obj.scoreDelta === 'number' &&
    typeof obj.speechListenDelta === 'number' &&
    typeof obj.clientDate === 'string' &&
    isPlainRecordOfNumbers(obj.timeByModeDelta) &&
    isPlainRecordOfNumbers(obj.gamesCompletedDelta) &&
    isPlainRecordOfNumbers(obj.storiesByContextDelta) &&
    (obj.scoreByModeDelta === undefined || isPlainRecordOfNumbers(obj.scoreByModeDelta)) &&
    (obj.batchId === undefined || typeof obj.batchId === 'string')
  );
}

/**
 * Storage validator for persisted TelemetryOutbox JSON. Rejects malformed payloads cleanly.
 */
export function isTelemetryOutbox(value: unknown): value is TelemetryOutbox {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.ownerUid === 'string' &&
    obj.ownerUid.length > 0 &&
    (obj.createdAt === undefined ||
      (typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt))) &&
    typeof obj.activeSecondsDelta === 'number' &&
    Number.isFinite(obj.activeSecondsDelta) &&
    obj.activeSecondsDelta >= 0 &&
    typeof obj.scoreDelta === 'number' &&
    Number.isFinite(obj.scoreDelta) &&
    obj.scoreDelta >= 0 &&
    typeof obj.speechListenDelta === 'number' &&
    Number.isFinite(obj.speechListenDelta) &&
    obj.speechListenDelta >= 0 &&
    isPlainRecordOfNumbers(obj.timeByModeDelta) &&
    isPlainRecordOfNumbers(obj.gamesCompletedDelta) &&
    isPlainRecordOfNumbers(obj.storiesByContextDelta) &&
    (obj.scoreByModeDelta === undefined || isPlainRecordOfNumbers(obj.scoreByModeDelta)) &&
    (obj.pendingBatch === undefined || isStatsSyncRequest(obj.pendingBatch))
  );
}

/**
 * Resolves a hydrated outbox against the active UID to prevent cross-child bleed
 * while preserving fresh (<24h) guest cards-mode progress when signing in.
 */
export function resolveOutboxForUid(
  loaded: TelemetryOutbox | null,
  currentUid: string,
  now: number = Date.now(),
): TelemetryOutbox {
  if (!loaded) {
    return createEmptyOutbox(currentUid, now);
  }
  const normalized: TelemetryOutbox = {
    ...loaded,
    timeByModeDelta: { ...loaded.timeByModeDelta },
    gamesCompletedDelta: { ...loaded.gamesCompletedDelta },
    storiesByContextDelta: { ...loaded.storiesByContextDelta },
    scoreByModeDelta: { ...(loaded.scoreByModeDelta ?? {}) },
  };
  if (normalized.ownerUid === 'guest' && currentUid !== 'guest') {
    if (
      normalized.createdAt !== undefined &&
      now - normalized.createdAt > GUEST_MERGE_MAX_AGE_MS
    ) {
      return createEmptyOutbox(currentUid, now);
    }
    const cardsSeconds = normalized.timeByModeDelta.cards ?? 0;
    return {
      ownerUid: currentUid,
      createdAt: normalized.createdAt ?? now,
      activeSecondsDelta: normalized.activeSecondsDelta,
      timeByModeDelta: cardsSeconds > 0 ? { cards: cardsSeconds } : {},
      gamesCompletedDelta: {},
      storiesByContextDelta: {},
      scoreDelta: 0,
      scoreByModeDelta: {},
      speechListenDelta: normalized.speechListenDelta,
    };
  }
  if (normalized.ownerUid === currentUid) {
    return normalized;
  }
  return createEmptyOutbox(currentUid, now);
}

export function hasOutboxDeltas(outbox: TelemetryOutbox): boolean {
  return (
    Boolean(outbox.pendingBatch) ||
    outbox.activeSecondsDelta > 0 ||
    outbox.scoreDelta > 0 ||
    outbox.speechListenDelta > 0 ||
    Object.keys(outbox.scoreByModeDelta || {}).length > 0 ||
    Object.keys(outbox.timeByModeDelta).length > 0 ||
    Object.keys(outbox.gamesCompletedDelta).length > 0 ||
    Object.keys(outbox.storiesByContextDelta).length > 0
  );
}

export function buildSyncPayload(
  outbox: TelemetryOutbox,
  clientDate: string = getLocalDateString(),
  batchId?: string,
): StatsSyncRequest {
  return {
    activeSecondsDelta: outbox.activeSecondsDelta,
    timeByModeDelta: { ...outbox.timeByModeDelta },
    gamesCompletedDelta: { ...outbox.gamesCompletedDelta },
    storiesByContextDelta: { ...outbox.storiesByContextDelta },
    scoreDelta: outbox.scoreDelta,
    scoreByModeDelta: { ...outbox.scoreByModeDelta },
    speechListenDelta: outbox.speechListenDelta,
    clientDate,
    ...(batchId ? { batchId } : {}),
  };
}

function subtractModeMap(
  currentMap: Partial<Record<Mode, number>>,
  sentMap: Partial<Record<string, number>> | undefined,
): Partial<Record<Mode, number>> {
  const next: Partial<Record<Mode, number>> = { ...currentMap };
  if (!sentMap) return next;
  for (const key of Object.keys(sentMap) as Mode[]) {
    const cur = next[key] ?? 0;
    const sent = sentMap[key] ?? 0;
    if (cur <= sent) {
      delete next[key];
    } else {
      next[key] = cur - sent;
    }
  }
  return next;
}

function subtractContextMap(
  currentMap: Partial<Record<StoryContext, number>>,
  sentMap: Partial<Record<string, number>> | undefined,
): Partial<Record<StoryContext, number>> {
  const next: Partial<Record<StoryContext, number>> = { ...currentMap };
  if (!sentMap) return next;
  for (const key of Object.keys(sentMap) as StoryContext[]) {
    const cur = next[key] ?? 0;
    const sent = sentMap[key] ?? 0;
    if (cur <= sent) {
      delete next[key];
    } else {
      next[key] = cur - sent;
    }
  }
  return next;
}

/**
 * Returns a new TelemetryOutbox with sent deltas deducted (preserving any deltas
 * accumulated concurrently while the sync request was in flight).
 */
export function deductSentDeltas(
  outbox: TelemetryOutbox,
  payload: StatsSyncRequest,
): TelemetryOutbox {
  return {
    ownerUid: outbox.ownerUid,
    createdAt: outbox.createdAt,
    activeSecondsDelta: Math.max(0, outbox.activeSecondsDelta - payload.activeSecondsDelta),
    scoreDelta: Math.max(0, outbox.scoreDelta - payload.scoreDelta),
    speechListenDelta: Math.max(0, outbox.speechListenDelta - payload.speechListenDelta),
    timeByModeDelta: subtractModeMap(outbox.timeByModeDelta, payload.timeByModeDelta),
    gamesCompletedDelta: subtractModeMap(
      outbox.gamesCompletedDelta,
      payload.gamesCompletedDelta,
    ),
    scoreByModeDelta: subtractModeMap(outbox.scoreByModeDelta, payload.scoreByModeDelta),
    storiesByContextDelta: subtractContextMap(
      outbox.storiesByContextDelta,
      payload.storiesByContextDelta,
    ),
    pendingBatch: undefined,
  };
}

function mergePositiveCounts(
  baseMap: Record<string, number>,
  deltaMap: Partial<Record<string, number>> | undefined,
): Record<string, number> {
  const next = { ...baseMap };
  if (!deltaMap) return next;
  for (const [k, v] of Object.entries(deltaMap)) {
    if (v && v > 0) {
      next[k] = (next[k] ?? 0) + v;
    }
  }
  return next;
}

export function createDefaultProfile(
  uid: string,
  email: string,
  displayName: string,
): UserProfile {
  return {
    uid,
    email,
    displayName,
    tier: 'FREE',
    stats: {
      totalTimeSeconds: 0,
      currentStreakDays: 1,
      longestStreakDays: 1,
      lastActiveDate: null,
      totalStoriesPracticed: 0,
      totalScore: 0,
      speechListenCount: 0,
      timeByModeSeconds: {},
      gamesCompletedByMode: {},
      scoreByMode: {},
      storiesByContext: {},
      dailyTimeSeconds: {},
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Pure mirror of backend UserStatsService.applySyncToProfile for optimistic UI & unit verification.
 */
export function applySyncToProfile(
  base: UserProfile,
  payload: StatsSyncRequest,
): UserProfile {
  const s = base.stats;
  const storiesDelta = Object.values(payload.storiesByContextDelta || {}).reduce<number>(
    (acc, v) => acc + (v ?? 0),
    0,
  );
  const gamesDelta = Object.values(payload.gamesCompletedDelta || {}).reduce<number>(
    (acc, v) => acc + (v ?? 0),
    0,
  );
  const modeTimeDelta = Object.values(payload.timeByModeDelta || {}).reduce<number>(
    (acc, v) => acc + (v ?? 0),
    0,
  );

  const hasActivity =
    payload.activeSecondsDelta > 0 ||
    storiesDelta > 0 ||
    gamesDelta > 0 ||
    modeTimeDelta > 0 ||
    payload.scoreDelta > 0 ||
    payload.speechListenDelta > 0;

  let currentStreak = s.currentStreakDays;
  let longestStreak = s.longestStreakDays;
  let lastActiveDate = s.lastActiveDate;

  if (hasActivity && payload.clientDate) {
    if (!lastActiveDate) {
      currentStreak = Math.max(1, currentStreak);
      longestStreak = Math.max(longestStreak, currentStreak);
    } else if (lastActiveDate !== payload.clientDate) {
      const prev = new Date(`${lastActiveDate}T00:00:00Z`);
      const cur = new Date(`${payload.clientDate}T00:00:00Z`);
      const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
      if (diffDays === 1) {
        currentStreak += 1;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else if (diffDays > 1) {
        currentStreak = 1;
      }
    }
    lastActiveDate = payload.clientDate;
  }

  const dailyTimeSeconds = { ...s.dailyTimeSeconds };
  if (payload.activeSecondsDelta > 0 && payload.clientDate) {
    dailyTimeSeconds[payload.clientDate] =
      (dailyTimeSeconds[payload.clientDate] ?? 0) + payload.activeSecondsDelta;
  }

  const scoreByModeDeltaTotal = Object.values(
    payload.scoreByModeDelta || {},
  ).reduce<number>((acc, v) => acc + (v ?? 0), 0);
  const scoreDeltaTotal = Math.max(payload.scoreDelta, scoreByModeDeltaTotal);

  return {
    ...base,
    updatedAt: Date.now(),
    stats: {
      totalTimeSeconds: s.totalTimeSeconds + payload.activeSecondsDelta,
      currentStreakDays: currentStreak,
      longestStreakDays: longestStreak,
      lastActiveDate,
      totalStoriesPracticed: s.totalStoriesPracticed + storiesDelta,
      totalScore: s.totalScore + scoreDeltaTotal,
      speechListenCount: s.speechListenCount + payload.speechListenDelta,
      timeByModeSeconds: mergePositiveCounts(s.timeByModeSeconds, payload.timeByModeDelta),
      gamesCompletedByMode: mergePositiveCounts(
        s.gamesCompletedByMode,
        payload.gamesCompletedDelta,
      ),
      scoreByMode: mergePositiveCounts(s.scoreByMode || {}, payload.scoreByModeDelta),
      storiesByContext: mergePositiveCounts(
        s.storiesByContext,
        payload.storiesByContextDelta,
      ),
      dailyTimeSeconds,
    },
  };
}
