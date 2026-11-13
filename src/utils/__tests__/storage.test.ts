import AsyncStorage from '@react-native-async-storage/async-storage';
import { isTelemetryOutbox } from '@/auth/telemetryHelpers';
import {
  clearAppStorage,
  getJSON,
  removeKey,
  setJSON,
  STORAGE_KEYS,
  storyHistoryKey,
} from '@/utils/storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);

describe('storage utilities', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('returns null safely when stored JSON is corrupt', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await AsyncStorage.setItem(STORAGE_KEYS.OUTBOX, '{bad-json');

    const loaded = await getJSON(STORAGE_KEYS.OUTBOX, isTelemetryOutbox);
    expect(loaded).toBeNull();
    warnSpy.mockRestore();
  });

  it('rejects valid JSON that fails the validator', async () => {
    await setJSON(STORAGE_KEYS.OUTBOX, { ownerUid: '', activeSecondsDelta: -5 });

    const loaded = await getJSON(STORAGE_KEYS.OUTBOX, isTelemetryOutbox);
    expect(loaded).toBeNull();
  });

  it('persists, reads, removes, and clears documented app keys cleanly', async () => {
    await setJSON(STORAGE_KEYS.MUSIC_ENABLED, true);
    await setJSON(storyHistoryKey('school'), ['Olá!']);
    await AsyncStorage.setItem('unrelated_key', 'keep');

    const music = await getJSON<boolean>(
      STORAGE_KEYS.MUSIC_ENABLED,
      (v): v is boolean => typeof v === 'boolean',
    );
    expect(music).toBe(true);

    await removeKey(STORAGE_KEYS.MUSIC_ENABLED);
    expect(await AsyncStorage.getItem(STORAGE_KEYS.MUSIC_ENABLED)).toBeNull();

    await clearAppStorage();
    expect(await AsyncStorage.getItem(storyHistoryKey('school'))).toBeNull();
    expect(await AsyncStorage.getItem('unrelated_key')).toBe('keep');
  });
});
