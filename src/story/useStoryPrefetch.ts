import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildStoryImagePrompt,
  fetchAndCacheStoryImage,
  pruneStoryImageCache,
} from '@/api/image';
import type { StoryContext } from '@/core/data/storyTopics';
import type { StoryPage } from '@/core/data/types';

export interface StoryPrefetchResult {
  prefetchImage: (page: StoryPage) => void;
  seedImage: (page: StoryPage, uri: string) => void;
  imageCache: Map<string, string>;
}

interface ScopedImageCache {
  ownerContext: StoryContext;
  entries: Map<string, string>;
}

const EMPTY_IMAGE_CACHE = new Map<string, string>();

/**
 * Deduplicates and caches story illustrations per context using the SHA-256 disk store.
 */
export function useStoryPrefetch(
  context: StoryContext = 'school',
): StoryPrefetchResult {
  const [cacheState, setCacheState] = useState<ScopedImageCache>(() => ({
    ownerContext: context,
    entries: new Map(),
  }));
  const fetchedRef = useRef<Set<string>>(new Set());
  const activeContextRef = useRef<StoryContext>(context);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    void pruneStoryImageCache();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    activeContextRef.current = context;
    fetchedRef.current.clear();
  }, [context]);

  const prefetchImage = useCallback(
    (page: StoryPage) => {
      const targetContext = context;
      const prompt = buildStoryImagePrompt(page, targetContext);
      if (fetchedRef.current.has(prompt)) {
        return;
      }
      fetchedRef.current.add(prompt);

      void fetchAndCacheStoryImage(prompt)
        .then((fileUri) => {
          if (!mountedRef.current || activeContextRef.current !== targetContext) {
            return;
          }
          setCacheState((prev) => {
            const base =
              prev.ownerContext === targetContext
                ? prev.entries
                : new Map<string, string>();
            if (base.get(prompt) === fileUri) {
              return prev;
            }
            const next = new Map(base);
            next.set(prompt, fileUri);
            return { ownerContext: targetContext, entries: next };
          });
        })
        .catch(() => {
          if (activeContextRef.current === targetContext) {
            fetchedRef.current.delete(prompt);
          }
        });
    },
    [context],
  );

  const seedImage = useCallback(
    (page: StoryPage, uri: string) => {
      const targetContext = context;
      const prompt = buildStoryImagePrompt(page, targetContext);
      fetchedRef.current.add(prompt);
      setCacheState((prev) => {
        const base =
          prev.ownerContext === targetContext
            ? prev.entries
            : new Map<string, string>();
        const next = new Map(base);
        next.set(prompt, uri);
        return { ownerContext: targetContext, entries: next };
      });
    },
    [context],
  );

  const imageCache =
    cacheState.ownerContext === context ? cacheState.entries : EMPTY_IMAGE_CACHE;

  return { prefetchImage, seedImage, imageCache };
}
