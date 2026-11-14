import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  BookOpen,
  Check,
  ChevronDown,
  Link2,
  Search,
  Volume2,
  X,
  Zap,
} from 'lucide-react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { cancelSpeech, speakText } from '@/audio/speech';
import { AdverbModal } from '@/components/AdverbModal';
import { ConjugationModal } from '@/components/ConjugationModal';
import { PrepositionModal } from '@/components/PrepositionModal';
import { adverbByWord } from '@/core/data/adverbData';
import { kidsWords } from '@/core/data/index';
import { prepGroupByWord } from '@/core/data/prepGroups';
import type { PrepGroup, Word } from '@/core/data/types';
import { verbConjugations } from '@/core/data/verbConjugations';
import { colors, radii, shadows, spacing } from '@/theme/tokens';

export interface CardsModeProps {
  language: 'en' | 'tr';
  listHeader?: React.ReactElement | null;
}

const CARD_HEIGHT = 138;
const CARD_GAP = 10;
const ROW_HEIGHT = CARD_HEIGHT + CARD_GAP;

const CATEGORY_ORDER: readonly string[] = [
  'Numbers',
  'Colours',
  'Family',
  'Animals',
  'Food & Drink',
  'Clothes',
  'Body',
  'Home',
  'School',
  'Places',
  'Transport',
  'Weather',
  'Time',
  'Phrases',
  'Verbs',
  'Adjectives',
  'Pronouns',
  'Prepositions',
  'Adverbs',
  'Nouns',
];

const CATEGORY_EMOJI: Record<string, string> = {
  Verbs: '🏃',
  Family: '👨‍👩‍👧',
  Animals: '🐾',
  'Food & Drink': '🍎',
  Colours: '🎨',
  Numbers: '🔢',
  Body: '💪',
  Clothes: '👕',
  Home: '🏠',
  School: '🏫',
  Places: '🏙️',
  Transport: '🚗',
  Adjectives: '✨',
  Time: '⏰',
  Weather: '☁️',
  Phrases: '💬',
  Nouns: '🔤',
  Pronouns: '👉',
  Adverbs: '⚡',
  Prepositions: '🔗',
};

const CATEGORY_TR: Record<string, string> = {
  Verbs: 'Fiiller',
  Family: 'Aile',
  Animals: 'Hayvanlar',
  'Food & Drink': 'Yiyecek & İçecek',
  Colours: 'Renkler',
  Numbers: 'Sayılar',
  Body: 'Vücut',
  Clothes: 'Kıyafetler',
  Home: 'Ev',
  School: 'Okul',
  Places: 'Yerler',
  Transport: 'Ulaşım',
  Adjectives: 'Sıfatlar',
  Time: 'Zaman',
  Weather: 'Hava Durumu',
  Phrases: 'İfadeler',
  Nouns: 'İsimler',
  Pronouns: 'Zamirler',
  Adverbs: 'Zarflar',
  Prepositions: 'Edatlar',
};

function shuffleArray<T>(array: readonly T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = arr[i];
    const b = arr[j];
    if (a !== undefined && b !== undefined) {
      arr[i] = b;
      arr[j] = a;
    }
  }
  return arr;
}

function GenderIcon({ gender }: { gender: 'm' | 'f' }) {
  if (gender === 'm') {
    return (
      <Svg width={13} height={13} viewBox="0 0 20 20" fill="none">
        <Circle cx={8} cy={13} r={5.5} stroke="#ffffff" strokeWidth={2.5} />
        <Line x1={12.5} y1={8.5} x2={18.5} y2={2.5} stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" />
        <Line x1={13.5} y1={2.5} x2={18.5} y2={2.5} stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" />
        <Line x1={18.5} y1={2.5} x2={18.5} y2={7.5} stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg width={13} height={14} viewBox="0 0 20 22" fill="none">
      <Circle cx={10} cy={7.5} r={5.5} stroke="#ffffff" strokeWidth={2.5} />
      <Line x1={10} y1={13} x2={10} y2={21} stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" />
      <Line x1={6.5} y1={17} x2={13.5} y2={17} stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

interface FlashCardProps {
  word: Word;
  cardWidth: number;
  language: 'en' | 'tr';
  onSpeak: (word: Word) => void;
  onOpenVerb: (pt: string) => void;
  onOpenPrep: (group: PrepGroup) => void;
  onOpenAdverb: (pt: string) => void;
}

const FlashCard = React.memo(function FlashCard({
  word,
  cardWidth,
  language,
  onSpeak,
  onOpenVerb,
  onOpenPrep,
  onOpenAdverb,
}: FlashCardProps) {
  const isTr = language === 'tr';
  const hasVerbConj = word.category === 'Verbs' && verbConjugations[word.pt] != null;
  const prepGroup = word.category === 'Prepositions' ? prepGroupByWord[word.pt] : undefined;
  const hasPrepModal =
    prepGroup != null &&
    (prepGroup.definite.length > 0 || prepGroup.examples.length > 0);
  const hasAdvModal = word.category === 'Adverbs' && adverbByWord[word.pt] != null;
  const hasCornerBtn = hasVerbConj || hasPrepModal || hasAdvModal;
  const isNumberBadge =
    word.category === 'Numbers' || /^\d{2}:\d{2}$/.test(word.emoji);

  const translation = isTr ? word.tr : word.en;
  const parenIdx = hasVerbConj ? translation.indexOf(' (') : -1;

  return (
    <Pressable
      onPress={() => onSpeak(word)}
      accessibilityRole="button"
      accessibilityLabel={
        isTr
          ? `${word.pt}, ${word.tr}. Dinlemek için dokunun.`
          : `${word.pt}, ${word.en}. Tap to listen.`
      }
      style={({ pressed }) => [
        styles.card,
        { width: cardWidth, height: CARD_HEIGHT },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.soundIconWrap} pointerEvents="none">
        <Volume2 size={13} strokeWidth={2.2} color={colors.textMuted} />
      </View>

      {isNumberBadge ? (
        <View style={styles.numberBadge}>
          <Text
            style={styles.numberBadgeText}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            maxFontSizeMultiplier={1.2}
          >
            {word.emoji}
          </Text>
        </View>
      ) : (
        <Text style={styles.emoji}>{word.emoji}</Text>
      )}

      <Text
        style={styles.ptText}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        maxFontSizeMultiplier={1.2}
      >
        {word.pt}
      </Text>

      {parenIdx !== -1 ? (
        <Text
          style={[styles.enText, styles.enTextVerb]}
          numberOfLines={2}
          maxFontSizeMultiplier={1.15}
        >
          {translation.slice(0, parenIdx)}
          {'\n'}
          <Text style={styles.enParenText}>{translation.slice(parenIdx + 1)}</Text>
        </Text>
      ) : (
        <Text
          style={[styles.enText, (hasCornerBtn || word.gender) && styles.enTextCornerPad]}
          numberOfLines={2}
          maxFontSizeMultiplier={1.15}
        >
          {translation}
        </Text>
      )}

      {word.gender ? (
        <View
          pointerEvents="none"
          style={[
            styles.genderBadge,
            word.gender === 'm' ? styles.genderMale : styles.genderFemale,
          ]}
        >
          <GenderIcon gender={word.gender} />
        </View>
      ) : null}

      {hasVerbConj ? (
        <Pressable
          onPress={() => onOpenVerb(word.pt)}
          accessibilityRole="button"
          accessibilityLabel={
            isTr ? `${word.pt} fiil çekimlerini göster` : `Show conjugations for ${word.pt}`
          }
          hitSlop={8}
          style={({ pressed }) => [styles.verbCornerBtn, pressed && styles.cornerPressed]}
        >
          <BookOpen size={15} strokeWidth={2.2} color={colors.white} />
        </Pressable>
      ) : hasPrepModal && prepGroup ? (
        <Pressable
          onPress={() => onOpenPrep(prepGroup)}
          accessibilityRole="button"
          accessibilityLabel={
            isTr ? `${word.pt} birleşimlerini göster` : `Show contractions for ${word.pt}`
          }
          hitSlop={8}
          style={({ pressed }) => [styles.purpleCornerBtn, pressed && styles.cornerPressed]}
        >
          <Link2 size={14} strokeWidth={2.4} color={colors.white} />
        </Pressable>
      ) : hasAdvModal ? (
        <Pressable
          onPress={() => onOpenAdverb(word.pt)}
          accessibilityRole="button"
          accessibilityLabel={
            isTr ? `${word.pt} kullanım örneklerini göster` : `Show examples for ${word.pt}`
          }
          hitSlop={8}
          style={({ pressed }) => [styles.purpleCornerBtn, pressed && styles.cornerPressed]}
        >
          <Zap size={14} strokeWidth={2.4} color={colors.white} />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

interface CardsListHeaderProps {
  listHeader?: React.ReactElement | null;
  isTr: boolean;
  query: string;
  onChangeQuery: (text: string) => void;
  activeCategory: string | null;
  onOpenCategoryMenu: () => void;
}

const CardsListHeader = React.memo(function CardsListHeader({
  listHeader,
  isTr,
  query,
  onChangeQuery,
  activeCategory,
  onOpenCategoryMenu,
}: CardsListHeaderProps) {
  const [focused, setFocused] = useState(false);

  const activeCategoryLabel = activeCategory
    ? `${CATEGORY_EMOJI[activeCategory] ?? '📂'} ${isTr ? (CATEGORY_TR[activeCategory] ?? activeCategory) : activeCategory}`
    : isTr
      ? '🌟 Tümü'
      : '🌟 All';

  return (
    <View style={styles.listHeaderWrap}>
      {listHeader}
      <View style={styles.searchRow}>
        <View style={[styles.searchBoxWrap, focused && styles.searchBoxFocused]}>
          <Search size={16} strokeWidth={2.2} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={isTr ? 'Kelime ara...' : 'Search word...'}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={isTr ? 'Kelime ara' : 'Search word'}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
            maxFontSizeMultiplier={1.25}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => onChangeQuery('')}
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Aramayı temizle' : 'Clear search'}
              hitSlop={8}
              style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
            >
              <X size={15} strokeWidth={2.4} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={onOpenCategoryMenu}
          accessibilityRole="button"
          accessibilityLabel={isTr ? 'Kategori seç' : 'Select category'}
          style={({ pressed }) => [styles.categoryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.categoryBtnText} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {activeCategoryLabel}
          </Text>
          <ChevronDown size={16} strokeWidth={2.4} color={colors.textDark} />
        </Pressable>
      </View>
    </View>
  );
});

export function CardsMode({
  language,
  listHeader = null,
}: CardsModeProps): React.ReactElement {
  const isTr = language === 'tr';
  const { width: windowWidth } = useWindowDimensions();

  const [shuffledWords] = useState<Word[]>(() => shuffleArray(kidsWords));
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isCategoryMenuOpen, setCategoryMenuOpen] = useState(false);

  const [selectedVerb, setSelectedVerb] = useState<string | null>(null);
  const [selectedPrepGroup, setSelectedPrepGroup] = useState<PrepGroup | null>(null);
  const [selectedAdverb, setSelectedAdverb] = useState<string | null>(null);

  useEffect(() => {
    return () => cancelSpeech();
  }, []);

  const allCategories = useMemo(() => {
    const found = new Set(shuffledWords.map((w) => w.category));
    return [
      ...CATEGORY_ORDER.filter((cat) => found.has(cat)),
      ...Array.from(found).filter((cat) => !CATEGORY_ORDER.includes(cat)),
    ];
  }, [shuffledWords]);

  const filteredWords = useMemo(() => {
    let words = shuffledWords;
    if (activeCategory) {
      words = words.filter((w) => w.category === activeCategory);
    }
    const q = query.trim().toLowerCase();
    if (q.length > 0) {
      words = words.filter(
        (w) =>
          w.pt.toLowerCase().includes(q) ||
          w.en.toLowerCase().includes(q) ||
          w.tr.toLowerCase().includes(q),
      );
    }
    return words;
  }, [shuffledWords, activeCategory, query]);

  const numColumns = windowWidth >= 600 ? 4 : windowWidth >= 340 ? 3 : 2;
  const cardWidth = Math.max(
    96,
    Math.floor((windowWidth - spacing.md * 2 - CARD_GAP * (numColumns - 1)) / numColumns),
  );

  const handleSpeak = useCallback(
    (word: Word) => {
      void Haptics.selectionAsync().catch(() => {});
      speakText(word.pt, { language });
    },
    [language],
  );

  const handleOpenCategoryMenu = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    setCategoryMenuOpen(true);
  }, []);

  const handleResetFilters = useCallback(() => {
    setQuery('');
    setActiveCategory(null);
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Word>) => (
      <FlashCard
        word={item}
        cardWidth={cardWidth}
        language={language}
        onSpeak={handleSpeak}
        onOpenVerb={setSelectedVerb}
        onOpenPrep={setSelectedPrepGroup}
        onOpenAdverb={setSelectedAdverb}
      />
    ),
    [cardWidth, handleSpeak, language],
  );

  const keyExtractor = useCallback(
    (item: Word) => `${item.category}-${item.pt}-${item.en}`,
    [],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<Word> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  return (
    <View style={styles.root}>
      <FlatList
        key={`cards-cols-${numColumns}`}
        data={filteredWords}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        numColumns={numColumns}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <CardsListHeader
            listHeader={listHeader}
            isTr={isTr}
            query={query}
            onChangeQuery={setQuery}
            activeCategory={activeCategory}
            onOpenCategoryMenu={handleOpenCategoryMenu}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.25}>
              {isTr ? 'Eşleşen kelime bulunamadı' : 'No matching words found'}
            </Text>
            <Pressable
              onPress={handleResetFilters}
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Tüm kelimeleri göster' : 'Show all words'}
              style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
            >
              <Text style={styles.resetBtnText} maxFontSizeMultiplier={1.2}>
                {isTr ? '🌟 Tümünü Göster' : '🌟 Show All'}
              </Text>
            </Pressable>
          </View>
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={18}
        maxToRenderPerBatch={18}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={isCategoryMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryMenuOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCategoryMenuOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Kategoriyi kapat' : 'Close category picker'}
          />

          <View style={styles.modalCard} accessibilityViewIsModal>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} maxFontSizeMultiplier={1.2}>
                {isTr ? 'Kategori Seç' : 'Select Category'}
              </Text>
              <Pressable
                onPress={() => setCategoryMenuOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={isTr ? 'Kapat' : 'Close'}
                hitSlop={6}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.pressed]}
              >
                <X size={18} strokeWidth={2.4} color={colors.textDark} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.modalList}>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => {});
                  setActiveCategory(null);
                  setCategoryMenuOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={isTr ? 'Tümü' : 'All'}
                accessibilityState={{ selected: activeCategory === null }}
                style={({ pressed }) => [
                  styles.modalOption,
                  activeCategory === null && styles.modalOptionActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    activeCategory === null && styles.modalOptionTextActive,
                  ]}
                  maxFontSizeMultiplier={1.2}
                >
                  {isTr ? '🌟 Tümü' : '🌟 All'}
                </Text>
                {activeCategory === null ? <Check size={16} color={colors.amber} /> : null}
              </Pressable>

              {allCategories.map((cat) => {
                const active = cat === activeCategory;
                const label = `${CATEGORY_EMOJI[cat] ?? '📂'} ${isTr ? (CATEGORY_TR[cat] ?? cat) : cat}`;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      void Haptics.selectionAsync().catch(() => {});
                      setActiveCategory(cat);
                      setCategoryMenuOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={isTr ? (CATEGORY_TR[cat] ?? cat) : cat}
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.modalOption,
                      active && styles.modalOptionActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[styles.modalOptionText, active && styles.modalOptionTextActive]}
                      maxFontSizeMultiplier={1.2}
                    >
                      {label}
                    </Text>
                    {active ? <Check size={16} color={colors.amber} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConjugationModal
        verb={selectedVerb}
        initialLevel="a1"
        language={language}
        onClose={() => setSelectedVerb(null)}
      />

      <PrepositionModal
        group={selectedPrepGroup}
        language={language}
        onClose={() => setSelectedPrepGroup(null)}
      />

      <AdverbModal
        word={selectedAdverb}
        language={language}
        onClose={() => setSelectedAdverb(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  listHeaderWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBoxWrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: colors.amberLight,
    paddingHorizontal: 11,
  },
  searchBoxFocused: {
    borderColor: colors.amber,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
    paddingVertical: 8,
  },
  clearBtn: {
    padding: 4,
  },
  categoryBtn: {
    minHeight: 48,
    maxWidth: 148,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: colors.amberLight,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  categoryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textDark,
    flexShrink: 1,
  },
  columnWrapper: {
    paddingHorizontal: spacing.md,
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 3.5,
    borderColor: colors.amberPale,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    ...shadows.md,
  },
  cardPressed: {
    backgroundColor: '#fffde7',
    borderColor: colors.amber,
    transform: [{ scale: 0.98 }],
  },
  soundIconWrap: {
    position: 'absolute',
    top: 7,
    right: 8,
    opacity: 0.65,
  },
  emoji: {
    fontSize: 36,
    marginBottom: 4,
    lineHeight: 42,
  },
  numberBadge: {
    backgroundColor: colors.amberPale,
    borderWidth: 2,
    borderColor: colors.amberLight,
    borderRadius: radii.sm,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 5,
  },
  numberBadgeText: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.navy,
    letterSpacing: -0.4,
  },
  ptText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
    marginBottom: 2,
  },
  enText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
  },
  enTextCornerPad: {
    paddingHorizontal: 16,
  },
  enTextVerb: {
    paddingRight: 24,
    paddingLeft: 4,
    lineHeight: 14,
  },
  enParenText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.textMuted,
  },
  genderBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 24,
    height: 24,
    borderTopRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderMale: {
    backgroundColor: colors.sky,
  },
  genderFemale: {
    backgroundColor: colors.pink,
  },
  verbCornerBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderTopLeftRadius: 18,
    backgroundColor: '#3d5a9e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purpleCornerBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderTopLeftRadius: 18,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerPressed: {
    opacity: 0.85,
  },
  emptyCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 2.5,
    borderColor: colors.amberPale,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 10,
    ...shadows.sm,
  },
  emptyEmoji: {
    fontSize: 34,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
  },
  resetBtn: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.amber,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '75%',
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.amberLight,
    padding: spacing.md,
    gap: 10,
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalList: {
    gap: 6,
    paddingBottom: 4,
  },
  modalOption: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalOptionActive: {
    backgroundColor: '#fef9c3',
    borderWidth: 1.5,
    borderColor: colors.amber,
  },
  modalOptionText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.textDark,
  },
  modalOptionTextActive: {
    color: colors.navy,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
});
