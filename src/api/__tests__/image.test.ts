import * as Crypto from 'expo-crypto';
import { getAuthToken } from '@/auth/firebase';
import {
  buildStoryImagePrompt,
  fetchAndCacheStoryImage,
  pruneStoryImageCache,
} from '@/api/image';
import type { StoryPage } from '@/core/data/types';

jest.mock('@/auth/firebase', () => ({
  getAuthToken: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(),
}));

const mockFileStore = new Map<
  string,
  { bytes: Uint8Array; lastModified: number; deleted?: boolean }
>();
let mockDirExists = false;

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    constructor(dir: { uri: string }, name: string) {
      this.uri = `${dir.uri}/${name}`;
    }
    get exists(): boolean {
      return mockFileStore.has(this.uri);
    }
    get size(): number {
      return mockFileStore.get(this.uri)?.bytes.byteLength ?? 0;
    }
    get lastModified(): number {
      return mockFileStore.get(this.uri)?.lastModified ?? 0;
    }
    async write(bytes: Uint8Array): Promise<void> {
      mockFileStore.set(this.uri, {
        bytes,
        lastModified: Date.now(),
      });
    }
    delete(): void {
      const entry = mockFileStore.get(this.uri);
      if (entry) {
        entry.deleted = true;
      }
      mockFileStore.delete(this.uri);
    }
  }

  class MockDirectory {
    uri: string;
    constructor(base: string, name: string) {
      this.uri = `${base}/${name}`;
    }
    get exists(): boolean {
      return mockDirExists;
    }
    create(): void {
      mockDirExists = true;
    }
    list(): MockFile[] {
      const result: MockFile[] = [];
      for (const uri of mockFileStore.keys()) {
        if (uri.startsWith(`${this.uri}/`)) {
          const filename = uri.slice(this.uri.length + 1);
          result.push(new MockFile(this, filename));
        }
      }
      return result;
    }
  }

  return {
    Paths: { cache: 'file:///cache' },
    File: MockFile,
    Directory: MockDirectory,
  };
});

const mockedDigest = jest.mocked(Crypto.digestStringAsync);
const mockedGetAuthToken = jest.mocked(getAuthToken);

describe('story image cache & client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileStore.clear();
    mockDirExists = false;
    mockedDigest.mockResolvedValue('abc123sha');
    mockedGetAuthToken.mockResolvedValue('firebase-jwt-token');
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  describe('buildStoryImagePrompt', () => {
    it('uses explicit imagePrompt when provided', () => {
      const page: StoryPage = {
        pt: 'Bom dia!',
        en: 'Good morning!',
        mainEmoji: '☀️',
        bgLeft: '🏫',
        bgRight: '🎒',
        imagePrompt: 'a smiling kid entering a sunlit classroom',
      };
      expect(buildStoryImagePrompt(page, 'school')).toBe(
        'a smiling kid entering a sunlit classroom',
      );
    });

    it('synthesizes a kids illustration prompt when imagePrompt is absent', () => {
      const page: StoryPage = {
        pt: 'Quero um pastel de nata.',
        en: 'I want a custard tart!',
        mainEmoji: '🥐',
        bgLeft: '☕',
        bgRight: '🧁',
      };
      const prompt = buildStoryImagePrompt(page, 'cafe');
      expect(prompt).toContain('a sunny Portuguese café');
      expect(prompt).toContain('I want a custard tart');
      expect(prompt).toContain('no text');
    });
  });

  describe('fetchAndCacheStoryImage', () => {
    it('returns cached file:// URI immediately without network calls on disk hit', async () => {
      mockFileStore.set('file:///cache/story-images/abc123sha.jpg', {
        bytes: new Uint8Array([1, 2, 3, 4]),
        lastModified: 1000,
      });
      const fetchMock = jest.fn();
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const uri = await fetchAndCacheStoryImage('a kid at school');
      expect(uri).toBe('file:///cache/story-images/abc123sha.jpg');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('downloads image bytes with Bearer auth and caches on disk', async () => {
      const payload = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const fetchMock = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => payload.buffer,
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const uri = await fetchAndCacheStoryImage('child eating apple');
      expect(uri).toBe('file:///cache/story-images/abc123sha.jpg');
      expect(mockDirExists).toBe(true);
      expect(mockFileStore.get(uri)?.bytes).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/image?imagePrompt=child%20eating%20apple&width=768&height=336'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer firebase-jwt-token' },
        }),
      );
    });

    it('fails immediately on 429 rate limit without retrying', async () => {
      const fetchMock = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await expect(fetchAndCacheStoryImage('rate limited prompt')).rejects.toThrow(
        'rate-limited',
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('pruneStoryImageCache', () => {
    it('evicts oldest files first when exceeding maxFiles', async () => {
      mockDirExists = true;
      mockFileStore.set('file:///cache/story-images/oldest.jpg', {
        bytes: new Uint8Array(10),
        lastModified: 100,
      });
      mockFileStore.set('file:///cache/story-images/middle.jpg', {
        bytes: new Uint8Array(10),
        lastModified: 200,
      });
      mockFileStore.set('file:///cache/story-images/newest.jpg', {
        bytes: new Uint8Array(10),
        lastModified: 300,
      });

      await pruneStoryImageCache(2, 1024);

      expect(mockFileStore.has('file:///cache/story-images/oldest.jpg')).toBe(false);
      expect(mockFileStore.has('file:///cache/story-images/middle.jpg')).toBe(true);
      expect(mockFileStore.has('file:///cache/story-images/newest.jpg')).toBe(true);
    });
  });
});
