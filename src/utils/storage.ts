import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoryContext } from '@/core/data/storyTopics';

/**
 * Documented AsyncStorage key registry for Portuguese for Kids Mobile.
 * Never store credentials, auth tokens, or unhashed PII in AsyncStorage.
 */
export const STORAGE_KEYS = {
  OUTBOX: 'kids_unsynced_stats_v1',
  MUSIC_ENABLED: 'kids_music_enabled',
  LANGUAGE: 'kids_language_v1',
  STUDY_DATE: 'kids_study_time_date',
  STUDY_SECONDS: 'kids_study_time_seconds',
  PT_VOICE_HINT_SHOWN: 'kids_pt_voice_hint_shown_v1',
  WIKI_IMAGE_CACHE: 'kids_wiki_img_cache_v1',
  STORY_HISTORY_PREFIX: 'story_history_',
  NICKNAME_CONFIRMED_PREFIX: 'kids_nickname_confirmed_v1_',
} as const;

export function storyHistoryKey(context: StoryContext): string {
  return `${STORAGE_KEYS.STORY_HISTORY_PREFIX}${context}`;
}

export function nicknameConfirmedKey(uid: string): string {
  return `${STORAGE_KEYS.NICKNAME_CONFIRMED_PREFIX}${uid}`;
}

/**
 * Reads and parses a JSON value from AsyncStorage. Returns null if missing,
 * malformed, or rejected by the optional type-guard validator.
 */
export async function getJSON<T>(
  key: string,
  validator?: (value: unknown) => value is T,
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (validator && !validator(parsed)) {
      return null;
    }
    return parsed as T;
  } catch (err) {
    console.warn(`[storage] Failed to read key "${key}":`, err);
    return null;
  }
}

/**
 * Serializes and writes a JSON value to AsyncStorage.
 */
export async function setJSON(key: string, value: unknown): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[storage] Failed to write key "${key}":`, err);
    return false;
  }
}

/**
 * Removes a single key from AsyncStorage.
 */
export async function removeKey(key: string): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (err) {
    console.warn(`[storage] Failed to remove key "${key}":`, err);
    return false;
  }
}

/**
 * Removes all keys belonging to the documented app namespace (used during
 * account deletion so no child activity or history survives on device).
 */
export async function clearAppStorage(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const prefixes: readonly string[] = [
      STORAGE_KEYS.OUTBOX,
      STORAGE_KEYS.MUSIC_ENABLED,
      STORAGE_KEYS.LANGUAGE,
      STORAGE_KEYS.STUDY_DATE,
      STORAGE_KEYS.STUDY_SECONDS,
      STORAGE_KEYS.PT_VOICE_HINT_SHOWN,
      STORAGE_KEYS.WIKI_IMAGE_CACHE,
      STORAGE_KEYS.STORY_HISTORY_PREFIX,
      STORAGE_KEYS.NICKNAME_CONFIRMED_PREFIX,
    ];
    const keysToRemove = allKeys.filter((k) =>
      prefixes.some((prefix) => k === prefix || k.startsWith(prefix)),
    );
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
  } catch (err) {
    console.warn('[storage] Failed to clear app storage:', err);
  }
}
