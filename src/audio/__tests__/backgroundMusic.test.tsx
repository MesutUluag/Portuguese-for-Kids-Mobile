import React from 'react';
import { AppState } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { createAudioPlayer } from 'expo-audio';
import {
  __resetAudioSessionForTests,
  notifySpeechEnd,
  notifySpeechStart,
} from '@/audio/audioSession';
import { useBackgroundMusic } from '@/audio/backgroundMusic';
import { getJSON, setJSON, STORAGE_KEYS } from '@/utils/storage';

const mockPlayer = {
  volume: 1,
  playing: false,
  play: jest.fn(() => {
    mockPlayer.playing = true;
  }),
  pause: jest.fn(() => {
    mockPlayer.playing = false;
  }),
  replace: jest.fn(),
  remove: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => mockPlayer),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/config', () => ({
  IS_DEV: false,
}));

jest.mock('@/utils/storage', () => ({
  STORAGE_KEYS: { MUSIC_ENABLED: 'kids_music_enabled' },
  getJSON: jest.fn(),
  setJSON: jest.fn().mockResolvedValue(true),
}));

const mockGetJSON = getJSON as jest.MockedFunction<typeof getJSON>;
const mockSetJSON = setJSON as jest.MockedFunction<typeof setJSON>;

describe('useBackgroundMusic', () => {
  let latestHook: ReturnType<typeof useBackgroundMusic> | null = null;
  let addEventSpy: jest.SpyInstance;

  function Harness() {
    latestHook = useBackgroundMusic();
    return null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    __resetAudioSessionForTests();
    mockPlayer.playing = false;
    latestHook = null;
    addEventSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(() => ({ remove: jest.fn() }) as unknown as ReturnType<typeof AppState.addEventListener>);
  });

  afterEach(() => {
    addEventSpy.mockRestore();
    jest.useRealTimers();
  });

  it('does not play before persisted preference hydrates when muted', async () => {
    let resolvePref: (v: boolean | null) => void = () => {};
    mockGetJSON.mockReturnValue(
      new Promise<boolean | null>((resolve) => {
        resolvePref = resolve;
      }),
    );

    const view = await render(<Harness />);
    expect(mockPlayer.play).not.toHaveBeenCalled();

    await act(async () => {
      resolvePref(false);
    });

    await waitFor(() => expect(latestHook?.musicEnabled).toBe(false));
    expect(mockPlayer.play).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('starts playing after hydrating true preference and persists toggles', async () => {
    mockGetJSON.mockResolvedValue(true);

    const view = await render(<Harness />);
    await waitFor(() => expect(mockPlayer.play).toHaveBeenCalledTimes(1));

    await act(async () => {
      latestHook?.toggleMusic();
    });

    expect(mockSetJSON).toHaveBeenCalledWith(STORAGE_KEYS.MUSIC_ENABLED, false);
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    await view.unmount();
  });

  it('pauses music while speech is active and resumes 300ms after speech ends using 4s updateInterval', async () => {
    jest.useFakeTimers();
    mockGetJSON.mockResolvedValue(true);

    const view = await render(<Harness />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(createAudioPlayer).toHaveBeenCalledWith(expect.anything(), {
      updateInterval: 4000,
    });
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);

    await act(async () => {
      notifySpeechStart();
    });
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);

    await act(async () => {
      notifySpeechEnd();
      jest.advanceTimersByTime(250);
    });
    // Still waiting for 300ms post-speech grace window
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);
    await view.unmount();
  });
});
