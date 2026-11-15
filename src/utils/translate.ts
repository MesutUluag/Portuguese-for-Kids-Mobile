const MYMEMORY_TIMEOUT_MS = 2500;
const translationCache = new Map<string, string>();

interface MyMemoryResponse {
  responseStatus?: number;
  responseData?: {
    translatedText?: string;
  };
}

/**
 * Translates an English sentence to Turkish using the free MyMemory API.
 * Caches results in memory and falls back cleanly to the original text offline.
 */
export async function translateToTurkish(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const cached = translationCache.get(trimmed);
  if (cached !== undefined) {
    return cached;
  }

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|tr`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MYMEMORY_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return text;
    }
    const data = (await res.json()) as MyMemoryResponse;
    const translated = data.responseData?.translatedText?.trim();
    if (data.responseStatus !== 200 || !translated) {
      return text;
    }
    translationCache.set(trimmed, translated);
    return translated;
  } catch (err) {
    console.warn('[translate] MyMemory translation unavailable, showing English:', err);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export function __clearTranslationCacheForTests(): void {
  translationCache.clear();
}
