import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { getAuthToken } from '@/auth/firebase';
import { API_BASE_URL } from '@/config';
import type { StoryContext } from '@/core/data/storyTopics';
import type { StoryPage } from '@/core/data/types';

const RETRY_DELAYS_MS = [2_000, 5_000] as const;
const DEFAULT_MAX_CACHE_FILES = 100;
const DEFAULT_MAX_CACHE_BYTES = 30 * 1024 * 1024;
const STORY_IMAGE_CACHE_DIR = 'story-images';

const CONTEXT_SCENE: Record<StoryContext, string> = {
  school: 'a Portuguese school classroom',
  restaurant: 'a sunny Portuguese restaurant',
  bank: 'a bright Portuguese bank',
  hospital: 'a Portuguese clinic',
  cafe: 'a sunny Portuguese café',
  airport: 'a Portuguese airport',
  market: 'a Portuguese market',
  aima: 'a Portuguese government service office',
  bus: 'a Lisbon bus stop',
  pharmacy: 'a Portuguese pharmacy',
  gas_station: 'a Portuguese petrol station',
  traffic: 'a Portuguese road with traffic',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildImageRequestUrl(prompt: string): string {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${base}/image?imagePrompt=${encodeURIComponent(prompt)}&width=768&height=336`;
}

function getStoryImageCacheDir(): Directory {
  return new Directory(Paths.cache, STORY_IMAGE_CACHE_DIR);
}

/**
 * Builds the image generation / cache lookup prompt for a story page.
 */
export function buildStoryImagePrompt(
  page: StoryPage,
  context: StoryContext = 'school',
): string {
  if (page.imagePrompt) {
    return page.imagePrompt;
  }
  const scene = page.en.replace(/[.,!?]/g, '').trim();
  const location = CONTEXT_SCENE[context];
  return `a child in ${location}, ${scene}, colorful cute kids illustration, storybook art, bright colors, simple background, no text`;
}

async function fetchTimedImage(
  url: string,
  token: string | null,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves a cached JPEG `file://` URI for a story prompt from `Paths.cache/story-images/`
 * or downloads and caches it from `/api/image` on cache miss.
 */
export async function fetchAndCacheStoryImage(
  prompt: string,
  timeoutMs = 30_000,
): Promise<string> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error('Empty image prompt');
  }

  const sha = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    trimmed,
  );
  const cacheDir = getStoryImageCacheDir();
  const targetFile = new File(cacheDir, `${sha}.jpg`);

  if (targetFile.exists && targetFile.size > 0) {
    return targetFile.uri;
  }

  const url = buildImageRequestUrl(trimmed);
  const maxAttempts = RETRY_DELAYS_MS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      let token = await getAuthToken(false);
      let res = await fetchTimedImage(url, token, timeoutMs);

      if (res.status === 401) {
        token = await getAuthToken(true);
        if (token) {
          res = await fetchTimedImage(url, token, timeoutMs);
        }
      }

      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (bytes.byteLength === 0) {
          throw new Error('Empty image payload');
        }
        cacheDir.create({ intermediates: true, idempotent: true });
        await targetFile.write(bytes);
        return targetFile.uri;
      }

      if (res.status === 429) {
        throw new Error('rate-limited');
      }

      if (res.status === 401) {
        throw new Error('unauthorized');
      }

      if (attempt === maxAttempts - 1) {
        throw new Error(`Image fetch failed: ${res.status}`);
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === 'rate-limited' || err.message === 'unauthorized')
      ) {
        throw err;
      }
      if (attempt === maxAttempts - 1) {
        throw err;
      }
    }

    const delayMs = RETRY_DELAYS_MS[attempt] ?? 5_000;
    await sleep(delayMs);
  }

  throw new Error('Image fetch failed after all retries');
}

/**
 * Enforces an LRU upper bound on cached story illustrations in `Paths.cache/story-images/`.
 */
export async function pruneStoryImageCache(
  maxFiles = DEFAULT_MAX_CACHE_FILES,
  maxBytes = DEFAULT_MAX_CACHE_BYTES,
): Promise<void> {
  try {
    const cacheDir = getStoryImageCacheDir();
    if (!cacheDir.exists) {
      return;
    }

    const files = cacheDir
      .list()
      .filter((entry): entry is File => entry instanceof File);

    let totalBytes = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
    if (files.length <= maxFiles && totalBytes <= maxBytes) {
      return;
    }

    const sortedOldestFirst = [...files].sort(
      (a, b) => (a.lastModified ?? 0) - (b.lastModified ?? 0),
    );

    let remainingCount = sortedOldestFirst.length;
    for (const file of sortedOldestFirst) {
      if (remainingCount <= maxFiles && totalBytes <= maxBytes) {
        break;
      }
      const size = file.size ?? 0;
      file.delete();
      remainingCount -= 1;
      totalBytes -= size;
    }
  } catch (err) {
    console.warn('[story-image] Failed to prune story image cache:', err);
  }
}
