import React from 'react';
import { AppState } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { fetchWithAuth } from '@/api/client';
import { useAuthState } from '@/auth/AuthContext';
import { createDefaultProfile } from '@/auth/telemetryHelpers';
import { useStatsTracker } from '@/auth/useStatsTracker';
import { getJSON, setJSON, STORAGE_KEYS } from '@/utils/storage';

let mockNetInfoListener: ((state: NetInfoState) => void) | null = null;
let mockAppStateListener: ((state: string) => void) | null = null;
let mockBeforeSignOut: (() => Promise<void>) | null = null;
let mockFlushHandler: (() => Promise<void>) | null = null;
let mockDiscardOutbox: (() => void) | null = null;
const mockSetProfile = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn((cb: (state: NetInfoState) => void) => {
      mockNetInfoListener = cb;
      return jest.fn();
    }),
  },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}));

jest.mock('@/api/client', () => ({
  fetchWithAuth: jest.fn(),
}));

jest.mock('@/auth/AuthContext', () => ({
  useAuthState: jest.fn(),
}));

jest.mock('@/utils/storage', () => ({
  STORAGE_KEYS: { OUTBOX: 'pk_outbox' },
  getJSON: jest.fn(),
  setJSON: jest.fn().mockResolvedValue(undefined),
}));

const mockFetchWithAuth = fetchWithAuth as jest.MockedFunction<typeof fetchWithAuth>;
const mockUseAuthState = useAuthState as jest.MockedFunction<typeof useAuthState>;
const mockGetJSON = getJSON as jest.MockedFunction<typeof getJSON>;
const mockSetJSON = setJSON as jest.MockedFunction<typeof setJSON>;
const mockRandomUUID = Crypto.randomUUID as jest.MockedFunction<typeof Crypto.randomUUID>;

describe('useStatsTracker', () => {
  let latestTracker: ReturnType<typeof useStatsTracker> | null = null;
  let addEventSpy: jest.SpyInstance;

  function Harness({ mode = 'game1' }: { mode?: 'cards' | 'game1' }) {
    latestTracker = useStatsTracker(mode);
    return null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockNetInfoListener = null;
    mockAppStateListener = null;
    mockBeforeSignOut = null;
    mockFlushHandler = null;
    mockDiscardOutbox = null;
    latestTracker = null;
    mockRandomUUID.mockReturnValue('batch-uuid-1');
    mockGetJSON.mockResolvedValue(null);

    addEventSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, listener) => {
        mockAppStateListener = listener as (state: string) => void;
        return { remove: jest.fn() } as unknown as ReturnType<
          typeof AppState.addEventListener
        >;
      });

    const profile = createDefaultProfile('u1', 'p@example.com', 'BraveOwl');
    mockUseAuthState.mockReturnValue({
      user: { uid: 'u1' } as never,
      profile,
      authReady: true,
      isFirebaseConfigured: true,
      setProfile: mockSetProfile,
      refreshProfile: jest.fn(),
      registerBeforeSignOut: (cb) => {
        mockBeforeSignOut = cb;
      },
      registerFlushHandler: (cb) => {
        mockFlushHandler = cb;
      },
      registerDiscardOutboxHandler: (cb) => {
        mockDiscardOutbox = cb;
      },
    });
  });

  afterEach(() => {
    addEventSpy.mockRestore();
    jest.useRealTimers();
  });

  it('reuses a persisted pendingBatch batchId across a failed flush and clears it on success', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const updatedProfile = {
      ...createDefaultProfile('u1', 'p@example.com', 'BraveOwl'),
      stats: {
        ...createDefaultProfile('u1', 'p@example.com', 'BraveOwl').stats,
        totalScore: 5,
      },
    };
    mockFetchWithAuth
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(updatedProfile);

    await render(<Harness />);
    await waitFor(() => expect(mockGetJSON).toHaveBeenCalledWith(STORAGE_KEYS.OUTBOX, expect.any(Function)));

    await act(async () => {
      latestTracker!.recordGameScore('game1', 5);
    });

    await waitFor(() => expect(mockFetchWithAuth).toHaveBeenCalledTimes(1));
    const firstBody = JSON.parse(
      (mockFetchWithAuth.mock.calls[0]?.[1]?.body as string) ?? '{}',
    ) as { batchId?: string; scoreDelta?: number };
    expect(firstBody.batchId).toBe('batch-uuid-1');
    expect(firstBody.scoreDelta).toBe(5);

    // Next attempt (via NetInfo reconnect) reuses the exact same pendingBatch & batchId
    expect(NetInfo.addEventListener).toHaveBeenCalled();
    await act(async () => {
      mockNetInfoListener?.({
        isConnected: false,
        isInternetReachable: false,
      } as NetInfoState);
      mockNetInfoListener?.({
        isConnected: true,
        isInternetReachable: true,
      } as NetInfoState);
    });

    await waitFor(() => expect(mockFetchWithAuth).toHaveBeenCalledTimes(2));
    const secondBody = JSON.parse(
      (mockFetchWithAuth.mock.calls[1]?.[1]?.body as string) ?? '{}',
    ) as { batchId?: string };
    expect(secondBody.batchId).toBe('batch-uuid-1');
    expect(mockSetProfile).toHaveBeenCalledWith(updatedProfile);
    warnSpy.mockRestore();
  });

  it('throttles outbox writes to every 5 seconds and flushes when backgrounded', async () => {
    jest.useFakeTimers();
    const updatedProfile = createDefaultProfile('u1', 'p@example.com', 'BraveOwl');
    mockFetchWithAuth.mockResolvedValue(updatedProfile);

    await render(<Harness mode="cards" />);
    await act(async () => {
      await Promise.resolve();
    });

    mockSetJSON.mockClear();

    // 1st active tick happens at t=1000ms and schedules a 5000ms throttle timeout (fires at t=6000ms)
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockSetJSON).not.toHaveBeenCalled();

    // Advance past t=6000ms -> single persisted write
    await act(async () => {
      jest.advanceTimersByTime(3500);
    });
    expect(mockSetJSON).toHaveBeenCalledTimes(1);

    // Backgrounding flushes accumulated active seconds
    mockFetchWithAuth.mockClear();
    await act(async () => {
      mockAppStateListener?.('background');
    });
    expect(mockFetchWithAuth).toHaveBeenCalledTimes(1);
    expect(mockBeforeSignOut).not.toBeNull();
    expect(mockFlushHandler).not.toBeNull();
    expect(mockDiscardOutbox).not.toBeNull();
  });
});
