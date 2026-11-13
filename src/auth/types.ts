import type { Mode } from '@/core/data/types';
import type { StoryContext } from '@/core/data/storyTopics';

export interface UserStats {
  totalTimeSeconds: number;
  currentStreakDays: number;
  longestStreakDays: number;
  lastActiveDate: string | null;
  totalStoriesPracticed: number;
  totalScore: number;
  speechListenCount: number;
  timeByModeSeconds: Record<string, number>;
  gamesCompletedByMode: Record<string, number>;
  scoreByMode: Record<string, number>;
  storiesByContext: Record<string, number>;
  dailyTimeSeconds: Record<string, number>;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  tier: string;
  stats: UserStats;
  createdAt: number;
  updatedAt: number;
}

export interface StatsSyncRequest {
  activeSecondsDelta: number;
  timeByModeDelta: Partial<Record<string, number>>;
  gamesCompletedDelta: Partial<Record<string, number>>;
  storiesByContextDelta: Partial<Record<string, number>>;
  scoreDelta: number;
  scoreByModeDelta?: Partial<Record<string, number>>;
  speechListenDelta: number;
  clientDate: string;
  batchId?: string;
}

export interface TelemetryOutbox {
  ownerUid: string; // 'guest' or specific user uid
  createdAt?: number;
  activeSecondsDelta: number;
  timeByModeDelta: Partial<Record<Mode, number>>;
  gamesCompletedDelta: Partial<Record<Mode, number>>;
  storiesByContextDelta: Partial<Record<StoryContext, number>>;
  scoreDelta: number;
  scoreByModeDelta: Partial<Record<Mode, number>>;
  speechListenDelta: number;
  pendingBatch?: StatsSyncRequest;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  avatarInitial: string;
  totalScore: number;
  scoreByMode: Record<string, number>;
  gamesCompleted: number;
  isCurrentUser: boolean;
}

export interface LeaderboardResponse {
  topUsers: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
  totalUsersCount: number;
  lastUpdated: number;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Runtime type guard for UserProfile API responses.
 */
export function isUserProfile(value: unknown): value is UserProfile {
  if (!isObjectRecord(value)) return false;
  if (typeof value.uid !== 'string' || typeof value.displayName !== 'string') {
    return false;
  }
  if (!isObjectRecord(value.stats)) return false;
  return (
    typeof value.stats.totalTimeSeconds === 'number' &&
    typeof value.stats.currentStreakDays === 'number' &&
    typeof value.stats.totalScore === 'number'
  );
}

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  if (!isObjectRecord(value)) return false;
  return (
    typeof value.rank === 'number' &&
    typeof value.displayName === 'string' &&
    typeof value.totalScore === 'number' &&
    typeof value.gamesCompleted === 'number'
  );
}

/**
 * Runtime type guard for LeaderboardResponse API payloads.
 */
export function isLeaderboardResponse(value: unknown): value is LeaderboardResponse {
  if (!isObjectRecord(value)) return false;
  if (!Array.isArray(value.topUsers) || !value.topUsers.every(isLeaderboardEntry)) {
    return false;
  }
  if (value.currentUser !== null && !isLeaderboardEntry(value.currentUser)) {
    return false;
  }
  return (
    typeof value.totalUsersCount === 'number' &&
    typeof value.lastUpdated === 'number'
  );
}
