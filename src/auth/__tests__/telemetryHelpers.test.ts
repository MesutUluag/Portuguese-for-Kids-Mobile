import {
  applySyncToProfile,
  buildSyncPayload,
  createDefaultProfile,
  createEmptyOutbox,
  deductSentDeltas,
  isTelemetryOutbox,
  resolveOutboxForUid,
} from '@/auth/telemetryHelpers';
import type { StatsSyncRequest } from '@/auth/types';

describe('telemetryHelpers', () => {
  it('increments streak on consecutive day and accumulates scores and time', () => {
    const base = createDefaultProfile('u1', 'p@example.com', 'BraveOwl');
    const day1Payload: StatsSyncRequest = {
      activeSecondsDelta: 45,
      timeByModeDelta: { cards: 30, game1: 15 },
      gamesCompletedDelta: { game1: 1 },
      storiesByContextDelta: { school: 2 },
      scoreDelta: 6,
      scoreByModeDelta: { game1: 6 },
      speechListenDelta: 3,
      clientDate: '2026-11-12',
    };

    const afterDay1 = applySyncToProfile(base, day1Payload);
    expect(afterDay1.stats.currentStreakDays).toBe(1);
    expect(afterDay1.stats.longestStreakDays).toBe(1);
    expect(afterDay1.stats.totalTimeSeconds).toBe(45);
    expect(afterDay1.stats.totalScore).toBe(6);
    expect(afterDay1.stats.scoreByMode.game1).toBe(6);
    expect(afterDay1.stats.totalStoriesPracticed).toBe(2);
    expect(afterDay1.stats.dailyTimeSeconds['2026-11-12']).toBe(45);

    const day2Payload: StatsSyncRequest = {
      activeSecondsDelta: 20,
      timeByModeDelta: { game6: 20 },
      gamesCompletedDelta: { game6: 1 },
      storiesByContextDelta: {},
      scoreDelta: 30,
      scoreByModeDelta: { game6: 30 },
      speechListenDelta: 0,
      clientDate: '2026-11-13',
    };

    const afterDay2 = applySyncToProfile(afterDay1, day2Payload);
    expect(afterDay2.stats.currentStreakDays).toBe(2);
    expect(afterDay2.stats.longestStreakDays).toBe(2);
    expect(afterDay2.stats.totalScore).toBe(36);
    expect(afterDay2.stats.scoreByMode.game1).toBe(6);
    expect(afterDay2.stats.scoreByMode.game6).toBe(30);

    // Multi-day gap resets currentStreakDays back to 1 while preserving longestStreakDays
    const day5Payload: StatsSyncRequest = {
      ...day2Payload,
      clientDate: '2026-11-16',
    };
    const afterGap = applySyncToProfile(afterDay2, day5Payload);
    expect(afterGap.stats.currentStreakDays).toBe(1);
    expect(afterGap.stats.longestStreakDays).toBe(2);
  });

  it('deducts sent deltas while preserving concurrent in-flight increments', () => {
    const outbox = {
      ...createEmptyOutbox('u1'),
      activeSecondsDelta: 35,
      scoreDelta: 15,
      speechListenDelta: 4,
      timeByModeDelta: { cards: 25, game1: 10 },
      gamesCompletedDelta: { game1: 2 },
      scoreByModeDelta: { game1: 15 },
      storiesByContextDelta: { cafe: 1 },
      pendingBatch: {
        activeSecondsDelta: 30,
        timeByModeDelta: { cards: 25, game1: 5 },
        gamesCompletedDelta: { game1: 1 },
        storiesByContextDelta: { cafe: 1 },
        scoreDelta: 10,
        scoreByModeDelta: { game1: 10 },
        speechListenDelta: 4,
        clientDate: '2026-11-13',
        batchId: 'batch-123',
      },
    };

    const built = buildSyncPayload(outbox, '2026-11-13', 'batch-123');
    expect(built.batchId).toBe('batch-123');

    const sentPayload: StatsSyncRequest = outbox.pendingBatch;

    const remaining = deductSentDeltas(outbox, sentPayload);
    expect(remaining.activeSecondsDelta).toBe(5);
    expect(remaining.scoreDelta).toBe(5);
    expect(remaining.speechListenDelta).toBe(0);
    expect(remaining.timeByModeDelta.cards).toBeUndefined();
    expect(remaining.timeByModeDelta.game1).toBe(5);
    expect(remaining.gamesCompletedDelta.game1).toBe(1);
    expect(remaining.scoreByModeDelta.game1).toBe(5);
    expect(remaining.storiesByContextDelta.cafe).toBeUndefined();
    expect(remaining.pendingBatch).toBeUndefined();
  });

  it('merges fresh guest cards study stats while stripping game scores and rejecting stale (>24h) guest data', () => {
    const now = 1_700_100_000_000;
    const guestBox = {
      ...createEmptyOutbox('guest', now - 60_000),
      activeSecondsDelta: 45,
      speechListenDelta: 6,
      timeByModeDelta: { cards: 30, game1: 15 },
      gamesCompletedDelta: { game1: 2 },
      scoreDelta: 12,
      scoreByModeDelta: { game1: 12 },
    };
    expect(isTelemetryOutbox(guestBox)).toBe(true);

    const adopted = resolveOutboxForUid(guestBox, 'child-a', now);
    expect(adopted.ownerUid).toBe('child-a');
    expect(adopted.activeSecondsDelta).toBe(45);
    expect(adopted.speechListenDelta).toBe(6);
    expect(adopted.timeByModeDelta).toEqual({ cards: 30 });
    expect(adopted.scoreDelta).toBe(0);
    expect(adopted.scoreByModeDelta).toEqual({});
    expect(adopted.gamesCompletedDelta).toEqual({});

    const staleGuest = {
      ...guestBox,
      createdAt: now - 25 * 60 * 60 * 1000,
    };
    const discarded = resolveOutboxForUid(staleGuest, 'child-a', now);
    expect(discarded.ownerUid).toBe('child-a');
    expect(discarded.activeSecondsDelta).toBe(0);

    const isolated = resolveOutboxForUid(adopted, 'child-b', now);
    expect(isolated.ownerUid).toBe('child-b');
    expect(isolated.activeSecondsDelta).toBe(0);
  });
});
