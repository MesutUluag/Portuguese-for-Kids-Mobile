import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Volume2,
  X,
} from 'lucide-react-native';
import {
  clearStoredHistory,
  getNewStoryPage,
  loadStoredHistory,
  saveStoredHistory,
} from '@/api/story';
import { cancelSpeech, speakText } from '@/audio/speech';
import type { StoryContext } from '@/core/data/storyTopics';
import type { StoryPage } from '@/core/data/types';
import { StoryIllustration } from '@/story/StoryIllustration';
import { useStoryPrefetch } from '@/story/useStoryPrefetch';
import { buildStoryImagePrompt } from '@/api/image';
import { colors, radii, shadows, spacing, touchTargets } from '@/theme/tokens';
import { translateToTurkish } from '@/utils/translate';

export interface AppStoryPrefetch {
  storyPromise?: Promise<StoryPage>;
  imagePromise?: Promise<string>;
  replyPromise?: Promise<StoryPage | undefined>;
  replyImagePromise?: Promise<string>;
}

export interface StoryModeProps {
  language: 'en' | 'tr';
  getAppPrefetch?: () => AppStoryPrefetch | null;
  onStoryPracticed?: (context: StoryContext, sentencePt: string) => void;
  onSpeechListen?: () => void;
}

interface StoryContextOption {
  value: StoryContext;
  label: string;
  labelTr: string;
  emoji: string;
}

export const STORY_CONTEXT_OPTIONS: readonly StoryContextOption[] = [
  { value: 'school', label: 'School', labelTr: 'Okul', emoji: '🏫' },
  { value: 'restaurant', label: 'Restaurant', labelTr: 'Restoran', emoji: '🍽️' },
  { value: 'bank', label: 'Bank', labelTr: 'Banka', emoji: '🏦' },
  { value: 'hospital', label: 'Hospital', labelTr: 'Hastane', emoji: '🏥' },
  { value: 'cafe', label: 'Café', labelTr: 'Kafe', emoji: '☕' },
  { value: 'airport', label: 'Airport', labelTr: 'Havalimanı', emoji: '✈️' },
  { value: 'market', label: 'Market', labelTr: 'Market', emoji: '🛒' },
  { value: 'aima', label: 'AIMA', labelTr: 'AIMA', emoji: '🏛️' },
  { value: 'bus', label: 'Bus', labelTr: 'Otobüs', emoji: '🚌' },
  { value: 'pharmacy', label: 'Pharmacy', labelTr: 'Eczane', emoji: '💊' },
  { value: 'gas_station', label: 'Gas Station', labelTr: 'Benzin İstasyonu', emoji: '⛽' },
  { value: 'traffic', label: 'Traffic & Cars', labelTr: 'Trafik ve Arabalar', emoji: '🚗' },
];

export function StoryMode({
  language,
  getAppPrefetch,
  onStoryPracticed,
  onSpeechListen,
}: StoryModeProps): React.ReactElement {
  const isTr = language === 'tr';

  const [context, setContext] = useState<StoryContext>('school');
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [history, setHistory] = useState<StoryPage[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageKey, setPageKey] = useState(0);
  const [trTranslation, setTrTranslation] = useState<{
    sourceEn: string;
    text: string;
  } | null>(null);

  const loadIdRef = useRef(0);
  const hasSwitchedContextRef = useRef(false);
  const languageRef = useRef(language);
  const prefetchedReplyRef = useRef<StoryPage | null>(null);
  const prefetchingReplyRef = useRef(false);
  const seenPagesRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  const { prefetchImage, seedImage, imageCache } = useStoryPrefetch(context);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadIdRef.current += 1;
      cancelSpeech();
    };
  }, []);

  const prefetchReply = useCallback(
    async (
      targetContext: StoryContext,
      previousSentence: string,
      currentHistory: string[],
      loadId: number,
    ): Promise<void> => {
      if (prefetchingReplyRef.current) {
        return;
      }
      prefetchingReplyRef.current = true;
      try {
        const result = await getNewStoryPage(
          targetContext,
          previousSentence,
          currentHistory,
        );
        if (!mountedRef.current || loadId !== loadIdRef.current) {
          return;
        }
        prefetchedReplyRef.current = result.page;
        prefetchImage(result.page);
      } catch {
        // Prefetch failures are non-fatal
      } finally {
        prefetchingReplyRef.current = false;
      }
    },
    [prefetchImage],
  );

  // Load first page whenever context mounts or changes
  useEffect(() => {
    const id = ++loadIdRef.current;
    const isContextSwitch = hasSwitchedContextRef.current;
    const appPrefetch = !isContextSwitch ? getAppPrefetch?.() ?? null : null;
    prefetchedReplyRef.current = null;
    prefetchingReplyRef.current = false;

    void (async () => {
      let page: StoryPage | undefined;

      if (!isContextSwitch && appPrefetch?.storyPromise) {
        try {
          page = await appPrefetch.storyPromise;
        } catch {
          page = undefined;
        }
      }

      if (!page) {
        if (isContextSwitch) {
          await clearStoredHistory(context);
        }
        const storedHistory = await loadStoredHistory(context);
        const result = await getNewStoryPage(
          context,
          undefined,
          storedHistory,
        );
        page = result.page;
      }

      if (!mountedRef.current || id !== loadIdRef.current) {
        return;
      }

      setLoading(false);
      setHistory([page]);
      setIndex(0);
      setPageKey((k) => k + 1);

      if (!isContextSwitch && appPrefetch?.imagePromise) {
        void appPrefetch.imagePromise
          .then((uri) => {
            if (!mountedRef.current || id !== loadIdRef.current) return;
            if (uri) {
              seedImage(page, uri);
            } else {
              prefetchImage(page);
            }
          })
          .catch(() => {
            if (mountedRef.current && id === loadIdRef.current) {
              prefetchImage(page);
            }
          });
      } else {
        prefetchImage(page);
      }

      speakText(page.pt, { language: languageRef.current });

      if (!isContextSwitch && appPrefetch?.replyPromise) {
        void appPrefetch.replyPromise
          .then((reply) => {
            if (!mountedRef.current || id !== loadIdRef.current) return;
            if (!reply) {
              void prefetchReply(context, page.pt, [page.pt], id);
              return;
            }
            prefetchedReplyRef.current = reply;
            if (appPrefetch.replyImagePromise) {
              void appPrefetch.replyImagePromise
                .then((uri) => {
                  if (!mountedRef.current || id !== loadIdRef.current) return;
                  if (uri) {
                    seedImage(reply, uri);
                  } else {
                    prefetchImage(reply);
                  }
                })
                .catch(() => {
                  if (mountedRef.current && id === loadIdRef.current) {
                    prefetchImage(reply);
                  }
                });
            } else {
              prefetchImage(reply);
            }
          })
          .catch(() => {
            if (mountedRef.current && id === loadIdRef.current) {
              void prefetchReply(context, page.pt, [page.pt], id);
            }
          });
      } else {
        void prefetchReply(context, page.pt, [page.pt], id);
      }
    })();
  }, [context, getAppPrefetch, prefetchImage, prefetchReply, seedImage]);

  // Persist story sentence history for anti-repetition
  useEffect(() => {
    if (history.length > 0) {
      void saveStoredHistory(context, history);
    }
  }, [context, history]);

  // Report each unique viewed story page to telemetry
  useEffect(() => {
    const page = history[index];
    if (!page || loading) {
      return;
    }
    const key = `${context}:${page.pt}`;
    if (!seenPagesRef.current.has(key)) {
      seenPagesRef.current.add(key);
      onStoryPracticed?.(context, page.pt);
    }
  }, [context, history, index, loading, onStoryPracticed]);

  // Translate active page's English subtitle to Turkish on demand
  useEffect(() => {
    const page = history[index];
    const en = page?.en;
    if (language !== 'tr' || !en) {
      return;
    }
    let cancelled = false;
    void translateToTurkish(en).then((translated) => {
      if (!cancelled) {
        setTrTranslation({ sourceEn: en, text: translated });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [history, index, language]);

  const handleSelectContext = (nextContext: StoryContext) => {
    if (nextContext === context) {
      return;
    }
    cancelSpeech();
    hasSwitchedContextRef.current = true;
    setLoading(true);
    setHistory([]);
    setIndex(0);
    setTrTranslation(null);
    setContext(nextContext);
  };

  const handlePrev = () => {
    if (index <= 0 || loading) {
      return;
    }
    const prevIndex = index - 1;
    const prevPage = history[prevIndex];
    if (!prevPage) {
      return;
    }
    setIndex(prevIndex);
    setPageKey((k) => k + 1);
    speakText(prevPage.pt, { language });
  };

  const handleNext = async () => {
    if (loading) {
      return;
    }

    const nextIndex = index + 1;
    const existing = history[nextIndex];
    if (existing) {
      setIndex(nextIndex);
      setPageKey((k) => k + 1);
      speakText(existing.pt, { language });
      return;
    }

    const activeLoadId = loadIdRef.current;
    const currentPage = history[index];
    const currentHistoryPts = history.map((p) => p.pt);

    if (prefetchedReplyRef.current) {
      const reply = prefetchedReplyRef.current;
      prefetchedReplyRef.current = null;
      const nextHistory = [...history, reply];
      setHistory(nextHistory);
      setIndex(nextIndex);
      setPageKey((k) => k + 1);
      prefetchImage(reply);
      speakText(reply.pt, { language });
      void prefetchReply(
        context,
        reply.pt,
        nextHistory.map((p) => p.pt),
        activeLoadId,
      );
      return;
    }

    setLoading(true);
    const { page } = await getNewStoryPage(
      context,
      currentPage?.pt,
      currentHistoryPts,
    );
    if (!mountedRef.current || activeLoadId !== loadIdRef.current) {
      return;
    }

    const nextHistory = [...history, page];
    setLoading(false);
    setHistory(nextHistory);
    setIndex(nextIndex);
    setPageKey((k) => k + 1);
    prefetchImage(page);
    speakText(page.pt, { language });
    void prefetchReply(
      context,
      page.pt,
      nextHistory.map((p) => p.pt),
      activeLoadId,
    );
  };

  const page = history[index];
  const prompt = page ? buildStoryImagePrompt(page, context) : '';
  const cachedImageUrl = prompt ? imageCache.get(prompt) : undefined;
  const displayedTrText =
    language === 'tr' && page?.en && trTranslation?.sourceEn === page.en
      ? trTranslation.text
      : '';

  const selectedContextOption =
    STORY_CONTEXT_OPTIONS.find((opt) => opt.value === context) ??
    STORY_CONTEXT_OPTIONS[0]!;
  const selectedContextLabel = isTr
    ? selectedContextOption.labelTr
    : selectedContextOption.label;

  return (
    <View style={styles.card} testID="story-mode-card">
      {/* Scenario Dropdown Pill (matches original web StoryMode selector) */}
      <View style={styles.contextRow}>
        <Pressable
          testID="story-context-picker"
          accessibilityRole="button"
          accessibilityLabel={
            isTr ? `Senaryo seç: ${selectedContextLabel}` : `Choose scenario: ${selectedContextLabel}`
          }
          hitSlop={6}
          onPress={() => setContextModalOpen(true)}
          style={({ pressed }) => [
            styles.contextSelectPill,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.contextSelectText} maxFontSizeMultiplier={1.2}>
            {`${selectedContextOption.emoji} ${selectedContextLabel}`}
          </Text>
          <ChevronDown size={18} strokeWidth={2.4} color={colors.sky} />
        </Pressable>
      </View>

      <Modal
        visible={contextModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setContextModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Senaryo listesini kapat' : 'Close scenario picker'}
            style={styles.modalScrim}
            onPress={() => setContextModalOpen(false)}
          />
          <View style={styles.modalCard} testID="story-context-modal">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} maxFontSizeMultiplier={1.2}>
                {isTr ? 'Senaryo Seç' : 'Choose Scenario'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isTr ? 'Kapat' : 'Close'}
                hitSlop={8}
                onPress={() => setContextModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} strokeWidth={2.4} color={colors.skyDark} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {STORY_CONTEXT_OPTIONS.map((opt) => {
                const selected = opt.value === context;
                const label = isTr ? opt.labelTr : opt.label;
                return (
                  <Pressable
                    key={opt.value}
                    testID={`story-context-${opt.value}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={label}
                    onPress={() => {
                      setContextModalOpen(false);
                      handleSelectContext(opt.value);
                    }}
                    style={({ pressed }) => [
                      styles.modalOption,
                      selected && styles.modalOptionSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.modalOptionEmoji}>{opt.emoji}</Text>
                    <Text
                      style={[
                        styles.modalOptionLabel,
                        selected && styles.modalOptionLabelSelected,
                      ]}
                      maxFontSizeMultiplier={1.25}
                    >
                      {label}
                    </Text>
                    {selected ? (
                      <Check size={18} strokeWidth={2.6} color={colors.white} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Illustration */}
      {page ? (
        <StoryIllustration
          page={page}
          pageKey={pageKey}
          language={language}
          prefetchedImageUrl={cachedImageUrl}
        />
      ) : (
        <View style={styles.illustrationPlaceholder}>
          <ActivityIndicator size="large" color={colors.sky} />
        </View>
      )}

      {/* Audio Buttons */}
      <View style={styles.audioRow}>
        <Pressable
          testID="story-listen-btn"
          accessibilityRole="button"
          accessibilityLabel={
            isTr ? 'Cümleyi dinle' : 'Listen to sentence'
          }
          hitSlop={6}
          disabled={!page || loading}
          onPress={() => {
            if (!page) return;
            onSpeechListen?.();
            speakText(page.pt, { language });
          }}
          style={({ pressed }) => [
            styles.audioBtn,
            styles.audioBtnNormal,
            (!page || loading) && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Volume2 size={21} strokeWidth={2.2} color={colors.white} />
        </Pressable>

        <Pressable
          testID="story-listen-slow-btn"
          accessibilityRole="button"
          accessibilityLabel={
            isTr ? 'Cümleyi yavaş dinle' : 'Listen to sentence slowly'
          }
          hitSlop={6}
          disabled={!page || loading}
          onPress={() => {
            if (!page) return;
            onSpeechListen?.();
            speakText(page.pt, { rate: 0.3, language });
          }}
          style={({ pressed }) => [
            styles.audioBtn,
            styles.audioBtnSlow,
            (!page || loading) && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Gauge size={21} strokeWidth={2.2} color={colors.white} />
        </Pressable>
      </View>

      {/* Story Sentence + Translation */}
      <View style={styles.textBlock}>
        <Text
          testID="story-pt-text"
          style={styles.ptText}
          maxFontSizeMultiplier={1.3}
        >
          {loading
            ? isTr
              ? '🤖 Hikaye oluşturuluyor...'
              : '🤖 Generating story...'
            : (page?.pt ?? '…')}
        </Text>
        <Text
          testID="story-translation-text"
          style={styles.translationText}
          maxFontSizeMultiplier={1.3}
        >
          {loading
            ? ''
            : isTr
              ? displayedTrText || (page ? '🔄 …' : '')
              : (page?.en ?? '')}
        </Text>
      </View>

      {/* Prev / Page / Next Controls */}
      <View style={styles.navRow}>
        <Pressable
          testID="story-prev-btn"
          accessibilityRole="button"
          accessibilityLabel={isTr ? 'Önceki sayfa' : 'Previous page'}
          hitSlop={6}
          disabled={index === 0 || loading}
          onPress={handlePrev}
          style={({ pressed }) => [
            styles.navBtn,
            (index === 0 || loading) && styles.navBtnDisabled,
            pressed && styles.pressed,
          ]}
        >
          <ChevronLeft size={16} strokeWidth={2.5} color={colors.white} />
          <Text style={styles.navBtnText} maxFontSizeMultiplier={1.2}>
            Anterior
          </Text>
        </Pressable>

        <Text
          testID="story-page-indicator"
          style={styles.pageLabel}
          maxFontSizeMultiplier={1.2}
        >
          {`Página ${index + 1}`}
        </Text>

        <Pressable
          testID="story-next-btn"
          accessibilityRole="button"
          accessibilityLabel={isTr ? 'Sonraki sayfa' : 'Next page'}
          hitSlop={6}
          disabled={loading}
          onPress={() => void handleNext()}
          style={({ pressed }) => [
            styles.navBtn,
            loading && styles.navBtnDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.navBtnText} maxFontSizeMultiplier={1.2}>
            Próxima
          </Text>
          <ChevronRight size={16} strokeWidth={2.5} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#e6f4fe',
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 3.5,
    borderColor: colors.sky,
    gap: 10,
    ...shadows.lg,
  },
  contextRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextSelectPill: {
    minHeight: 42,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.sky,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  contextSelectText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.skyDark,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  modalScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '72%',
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 3,
    borderColor: colors.sky,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.skyDark,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2fe',
  },
  modalList: {
    flexGrow: 0,
  },
  modalOption: {
    minHeight: touchTargets.nav,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  modalOptionSelected: {
    backgroundColor: colors.sky,
    borderColor: colors.skyDark,
  },
  modalOptionEmoji: {
    fontSize: 18,
  },
  modalOptionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.skyDark,
  },
  modalOptionLabelSelected: {
    color: colors.white,
  },
  illustrationPlaceholder: {
    width: '100%',
    aspectRatio: 768 / 460,
    borderRadius: radii.lg,
    borderWidth: 3,
    borderColor: '#38bdf8',
    backgroundColor: '#bae6fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  audioBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  audioBtnNormal: {
    backgroundColor: colors.rose,
  },
  audioBtnSlow: {
    backgroundColor: colors.sky,
  },
  textBlock: {
    minHeight: 74,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: 4,
  },
  ptText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.skyDark,
    textAlign: 'center',
    lineHeight: 24,
  },
  translationText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  navBtn: {
    minHeight: 42,
    minWidth: 106,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.sky,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...shadows.sm,
  },
  navBtnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  navBtnText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: '700',
  },
  pageLabel: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.sky,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});
