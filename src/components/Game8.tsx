import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Check, ChevronDown, Delete, Dices, Volume2, X } from 'lucide-react-native';
import { cancelSpeech, speakText } from '@/audio/speech';
import { GameScoreBadge } from '@/commons/GameScoreBadge';
import { kidsWords } from '@/core/data/index';
import {
  type CrosswordPuzzle,
  type PlacedWord,
  formatBoxClue,
  generateCrossword,
} from '@/core/utils/crosswordGenerator';
import { colors, radii, shadows } from '@/theme/tokens';
import { GAME8_BOARD_BONUS, scoreGame8Word } from '@/utils/gameScoring';
import type { GameProps } from './Game1';

const CATEGORY_LIST = [
  'Mixed',
  'Verbs',
  'Numbers',
  'Colours',
  'Animals',
  'Food & Drink',
  'Family',
  'Clothes',
  'Home',
  'School',
  'Body',
  'Places',
  'Transport',
  'Adjectives',
  'Weather',
  'Time',
  'Nouns',
  'Pronouns',
  'Adverbs',
  'Prepositions',
  'ALL',
] as const;

const CATEGORY_EMOJI: Record<string, string> = {
  Mixed: '🔀',
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
  ALL: '🌟',
};

const CATEGORY_TR: Record<string, string> = {
  Mixed: 'Karışık',
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
  ALL: 'Tümü',
};

// 9-9-9 Balanced virtual Portuguese keyboard (same layout as web Game8)
const KEYBOARD_ROW1 = ['A', 'B', 'C', 'Ç', 'D', 'E', 'F', 'G', 'H'] as const;
const KEYBOARD_ROW2 = ['I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'] as const;
const KEYBOARD_ROW3 = ['R', 'S', 'T', 'U', 'V', 'X', 'Y', 'Z'] as const;

const ACCENT_MAP: Record<string, string[]> = {
  A: ['Á', 'À', 'Â', 'Ã', 'A'],
  E: ['É', 'Ê', 'E'],
  I: ['Í', 'I'],
  O: ['Ó', 'Ô', 'Õ', 'O'],
  U: ['Ú', 'U'],
  C: ['Ç', 'C'],
};

type CellKey = string; // `${r},${c}`

function makeCellKey(r: number, c: number): CellKey {
  return `${r},${c}`;
}

function getFilteredWords(category: string) {
  if (category === 'ALL' || category === 'Mixed') return kidsWords;
  const subset = kidsWords.filter((w) => w.category === category);
  return subset.length > 0 ? subset : kidsWords;
}

function buildPuzzle(category: string): CrosswordPuzzle {
  const pool = getFilteredWords(category);
  return (
    generateCrossword(pool, 12) ??
    generateCrossword(kidsWords, 12) ?? {
      width: 1,
      height: 1,
      grid: [[{ type: 'block' }]],
      words: {},
      wordList: [],
    }
  );
}

export function Game8({
  language,
  onScore,
  score = 0,
  recentGain = null,
  gainKey = 0,
}: GameProps) {
  const isTr = language === 'tr';
  const { width: windowWidth } = useWindowDimensions();

  const [selectedCategory, setSelectedCategory] = useState<string>('Mixed');
  const [puzzle, setPuzzle] = useState<CrosswordPuzzle>(() => buildPuzzle('Mixed'));
  const [activeWordId, setActiveWordId] = useState<string>(
    () => puzzle.wordList[0]?.id ?? '',
  );
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(
    () => puzzle.wordList[0]?.cells[0] ?? null,
  );
  const [userInputs, setUserInputs] = useState<Record<CellKey, string>>({});
  const [cellStatus, setCellStatus] = useState<Record<CellKey, 'correct' | 'wrong' | null>>({});
  const [completedWords, setCompletedWords] = useState<string[]>([]);
  const [isCategoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [audioUsedWords, setAudioUsedWords] = useState<Record<string, boolean>>({});
  const [hintsUsedWords, setHintsUsedWords] = useState<Record<string, number>>({});

  const audioUsedWordsRef = useRef<Set<string>>(new Set());
  const hintsUsedWordsRef = useRef<Map<string, number>>(new Map());
  const manualCellWordsRef = useRef<Map<CellKey, string>>(new Map());
  const boardWordPointsRef = useRef<number>(0);
  const revealedAllRef = useRef<boolean>(false);
  const bonusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (bonusTimerRef.current) clearTimeout(bonusTimerRef.current);
      cancelSpeech();
    };
  }, []);

  const initPuzzleForCategory = useCallback((category: string) => {
    if (bonusTimerRef.current) clearTimeout(bonusTimerRef.current);
    const nextPuzzle = buildPuzzle(category);
    const firstWord = nextPuzzle.wordList[0];
    setSelectedCategory(category);
    setCategoryMenuOpen(false);
    setPuzzle(nextPuzzle);
    setUserInputs({});
    setCellStatus({});
    setCompletedWords([]);
    setAudioUsedWords({});
    setHintsUsedWords({});
    audioUsedWordsRef.current.clear();
    hintsUsedWordsRef.current.clear();
    manualCellWordsRef.current.clear();
    boardWordPointsRef.current = 0;
    revealedAllRef.current = false;
    setActiveWordId(firstWord?.id ?? '');
    setSelectedCell(firstWord?.cells[0] ?? null);
  }, []);

  const activeWord: PlacedWord | undefined = puzzle.words[activeWordId];

  const selectWord = useCallback(
    (wordId: string, preferredCell?: [number, number]) => {
      setActiveWordId(wordId);
      const w = puzzle.words[wordId];
      if (!w) return;

      if (preferredCell) {
        setSelectedCell(preferredCell);
      } else {
        const emptyCell = w.cells.find(([r, c]) => !userInputs[makeCellKey(r, c)]);
        setSelectedCell(emptyCell ?? w.cells[0] ?? null);
      }
    },
    [puzzle.words, userInputs],
  );

  const handleLetterCellClick = (r: number, c: number, wordIds: string[]) => {
    const isCurrentCell =
      selectedCell !== null && selectedCell[0] === r && selectedCell[1] === c;

    if (isCurrentCell && wordIds.length > 1) {
      const nextWordId = wordIds.find((id) => id !== activeWordId) ?? wordIds[0];
      if (nextWordId) {
        selectWord(nextWordId, [r, c]);
      }
    } else if (wordIds.includes(activeWordId)) {
      setSelectedCell([r, c]);
    } else if (wordIds[0]) {
      selectWord(wordIds[0], [r, c]);
    }
  };

  const checkWordCompletions = useCallback(
    (candidateWordIds: string[], currentInputs: Record<CellKey, string>) => {
      if (revealedAllRef.current) return;

      const newlyCompleted: PlacedWord[] = [];
      for (const wordId of candidateWordIds) {
        if (completedWords.includes(wordId) || newlyCompleted.some((w) => w.id === wordId)) {
          continue;
        }
        const w = puzzle.words[wordId];
        if (!w) continue;

        const isCompleteAndCorrect = w.cells.every(([r, c]) => {
          const cell = puzzle.grid[r]?.[c];
          if (!cell || cell.type !== 'letter') return false;
          return currentInputs[makeCellKey(r, c)] === cell.solution;
        });

        if (isCompleteAndCorrect) {
          newlyCompleted.push(w);
        }
      }

      if (newlyCompleted.length === 0) return;

      const updatedCompleted = [
        ...completedWords,
        ...newlyCompleted.map((w) => w.id),
      ];
      setCompletedWords(updatedCompleted);

      for (const w of newlyCompleted) {
        const audioUsed = audioUsedWordsRef.current.has(w.id);
        const hintsCount = hintsUsedWordsRef.current.get(w.id) ?? 0;
        const hasManualEntry = w.cells.some(
          ([r, c]) => manualCellWordsRef.current.get(makeCellKey(r, c)) === w.id,
        );
        const solvedOnlyWithHints = hintsCount > 0 && !hasManualEntry;
        const pts = scoreGame8Word(audioUsed, hintsCount, solvedOnlyWithHints);
        if (pts > 0) {
          boardWordPointsRef.current += pts;
          onScore?.(pts);
        }
      }

      const firstWord = newlyCompleted[0];
      if (firstWord) {
        speakText(firstWord.word.pt, { language });
      }

      if (
        puzzle.wordList.length > 0 &&
        updatedCompleted.length === puzzle.wordList.length &&
        !revealedAllRef.current &&
        boardWordPointsRef.current > 0
      ) {
        if (bonusTimerRef.current) clearTimeout(bonusTimerRef.current);
        bonusTimerRef.current = setTimeout(() => {
          onScore?.(GAME8_BOARD_BONUS);
        }, 300);
      }
    },
    [completedWords, puzzle.words, puzzle.grid, puzzle.wordList.length, onScore, language],
  );

  const typeLetter = useCallback(
    (charInput: string) => {
      if (!selectedCell || !activeWord) return;
      const [r, c] = selectedCell;
      const cell = puzzle.grid[r]?.[c];
      if (!cell || cell.type !== 'letter') return;

      let charToSet = charInput.toUpperCase();
      const sol = cell.solution;
      if (ACCENT_MAP[charToSet]?.includes(sol)) {
        charToSet = sol;
      }

      const key = makeCellKey(r, c);
      if (charToSet === sol) {
        manualCellWordsRef.current.set(key, activeWord.id);
      } else {
        manualCellWordsRef.current.delete(key);
      }
      const newInputs = { ...userInputs, [key]: charToSet };
      setUserInputs(newInputs);
      setCellStatus((prev) => ({ ...prev, [key]: null }));

      const cellIdx = activeWord.cells.findIndex(([cr, cc]) => cr === r && cc === c);
      if (cellIdx !== -1 && cellIdx + 1 < activeWord.cells.length) {
        const nextPair = activeWord.cells[cellIdx + 1];
        if (nextPair) {
          setSelectedCell(nextPair);
        }
      }

      checkWordCompletions(cell.wordIds, newInputs);
    },
    [selectedCell, activeWord, puzzle.grid, userInputs, checkWordCompletions],
  );

  const deleteLetter = useCallback(() => {
    if (!selectedCell || !activeWord) return;
    const [r, c] = selectedCell;
    const key = makeCellKey(r, c);

    if (userInputs[key]) {
      manualCellWordsRef.current.delete(key);
      setUserInputs((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setCellStatus((prev) => ({ ...prev, [key]: null }));
    } else {
      const cellIdx = activeWord.cells.findIndex(([cr, cc]) => cr === r && cc === c);
      if (cellIdx > 0) {
        const prevCell = activeWord.cells[cellIdx - 1];
        if (!prevCell) return;
        const prevKey = makeCellKey(prevCell[0], prevCell[1]);
        manualCellWordsRef.current.delete(prevKey);
        setSelectedCell(prevCell);
        setUserInputs((prev) => {
          const next = { ...prev };
          delete next[prevKey];
          return next;
        });
        setCellStatus((prev) => ({ ...prev, [prevKey]: null }));
      }
    }
  }, [selectedCell, activeWord, userInputs]);

  const handleHint = () => {
    if (!activeWord || revealedAllRef.current || completedWords.includes(activeWord.id)) {
      return;
    }

    let targetPair: [number, number] | null = null;
    if (selectedCell) {
      const [sr, sc] = selectedCell;
      const selectedGridCell = puzzle.grid[sr]?.[sc];
      if (
        selectedGridCell &&
        selectedGridCell.type === 'letter' &&
        selectedGridCell.wordIds.includes(activeWord.id) &&
        userInputs[makeCellKey(sr, sc)] !== selectedGridCell.solution
      ) {
        targetPair = [sr, sc];
      }
    }

    if (!targetPair) {
      const unsolved = activeWord.cells.find(([cr, cc]) => {
        const c = puzzle.grid[cr]?.[cc];
        return c?.type === 'letter' && userInputs[makeCellKey(cr, cc)] !== c.solution;
      });
      if (!unsolved) return;
      targetPair = unsolved;
    }

    const [r, c] = targetPair;
    const cell = puzzle.grid[r]?.[c];
    if (!cell || cell.type !== 'letter') return;

    const nextHints = (hintsUsedWordsRef.current.get(activeWord.id) ?? 0) + 1;
    hintsUsedWordsRef.current.set(activeWord.id, nextHints);
    setHintsUsedWords((prev) => ({
      ...prev,
      [activeWord.id]: nextHints,
    }));

    const key = makeCellKey(r, c);
    manualCellWordsRef.current.delete(key);
    const newInputs = { ...userInputs, [key]: cell.solution };
    setUserInputs(newInputs);
    setCellStatus((prev) => ({ ...prev, [key]: 'correct' }));

    const nextEmpty = activeWord.cells.find(([cr, cc]) => {
      const targetCell = puzzle.grid[cr]?.[cc];
      return targetCell?.type === 'letter' && !newInputs[makeCellKey(cr, cc)];
    });
    if (nextEmpty) {
      setSelectedCell(nextEmpty);
    }

    checkWordCompletions(cell.wordIds, newInputs);
  };

  const handleCheck = () => {
    const newStatus: Record<CellKey, 'correct' | 'wrong' | null> = {};

    puzzle.grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell.type === 'letter') {
          const key = makeCellKey(r, c);
          const input = userInputs[key];
          if (!input) {
            newStatus[key] = null;
          } else if (input === cell.solution) {
            newStatus[key] = 'correct';
          } else {
            newStatus[key] = 'wrong';
          }
        }
      });
    });

    setCellStatus(newStatus);
  };

  const handleRevealAll = () => {
    revealedAllRef.current = true;
    if (bonusTimerRef.current) clearTimeout(bonusTimerRef.current);
    const filled: Record<CellKey, string> = {};
    const status: Record<CellKey, 'correct' | 'wrong' | null> = {};

    puzzle.grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell.type === 'letter') {
          const key = makeCellKey(r, c);
          filled[key] = cell.solution;
          status[key] = 'correct';
        }
      });
    });

    setUserInputs(filled);
    setCellStatus(status);
    setCompletedWords(puzzle.wordList.map((w) => w.id));
  };

  const activeWordProgress = useMemo(() => {
    if (!activeWord) return '';
    return activeWord.cells
      .map(([r, c]) => userInputs[makeCellKey(r, c)] || '_')
      .join(' ');
  }, [activeWord, userInputs]);

  const totalWords = puzzle.wordList.length;
  const solvedCount = completedWords.length;

  const formatCategoryLabel = (cat: string) =>
    isTr ? CATEGORY_TR[cat] ?? cat : cat === 'ALL' ? 'All' : cat;

  const activeWordCompleted = activeWord ? completedWords.includes(activeWord.id) : false;
  const activeWordEarnablePts = activeWord
    ? scoreGame8Word(
        Boolean(audioUsedWords[activeWord.id]),
        hintsUsedWords[activeWord.id] ?? 0,
      )
    : 10;

  const gridAvailableWidth = Math.min(windowWidth - 40, 480);
  const cellSize = Math.max(25, Math.floor(gridAvailableWidth / Math.max(1, puzzle.width)));
  const letterFontSize = Math.max(13, Math.floor(cellSize * 0.48));
  const clueFontSize = Math.max(9.5, Math.min(13, Number((cellSize * 0.33).toFixed(1))));
  const clueLineHeight = Math.ceil(clueFontSize * 1.08);
  const splitClueFontSize = Math.max(8, Number((clueFontSize - 1.5).toFixed(1)));
  const splitClueLineHeight = Math.ceil(splitClueFontSize * 1.05);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerMain}>
          <View style={styles.titleBadge}>
            <Text style={styles.titleBadgeText} maxFontSizeMultiplier={1.1}>
              {CATEGORY_EMOJI[selectedCategory] ?? '✏️'}
            </Text>
          </View>

          <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={1.15}>
            {isTr ? 'ÇENGEL' : 'CROSSWORD'}
          </Text>

          <Pressable
            onPress={() => {
              setCategoryMenuOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Kategori seç' : 'Select category'}
            hitSlop={6}
            style={({ pressed }) => [styles.dropdownBtn, pressed && styles.pressed]}
          >
            <Text style={styles.dropdownBtnText} numberOfLines={1} maxFontSizeMultiplier={1.1}>
              {formatCategoryLabel(selectedCategory)}
            </Text>
            <ChevronDown size={13} color="#475569" />
          </Pressable>
        </View>

        <View style={styles.headerBadges}>
          <Pressable
            onPress={() => {
              initPuzzleForCategory(selectedCategory);
            }}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Yeni rastgele bulmaca üret' : 'Generate new random puzzle'}
            hitSlop={6}
            style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
          >
            <Dices size={13} color="#047857" />
            <Text style={styles.newBtnText} maxFontSizeMultiplier={1.1}>
              {isTr ? 'Yeni' : 'New'}
            </Text>
          </Pressable>

          <View style={styles.progressPill}>
            <Text style={styles.progressText} maxFontSizeMultiplier={1.1}>
              ⭐ {solvedCount}/{totalWords}
            </Text>
          </View>

          <GameScoreBadge
            score={score}
            recentGain={recentGain}
            gainKey={gainKey}
            language={language}
            compact
          />
        </View>
      </View>

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
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} maxFontSizeMultiplier={1.2}>
                {isTr ? 'Kategori Seç' : 'Select Category'}
              </Text>
              <Pressable
                onPress={() => setCategoryMenuOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={isTr ? 'Kapat' : 'Close'}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.pressed]}
              >
                <X size={18} color={colors.textDark} />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator
              contentContainerStyle={styles.modalList}
            >
              {CATEGORY_LIST.map((cat) => {
                const active = cat === selectedCategory;
                const label = formatCategoryLabel(cat);
                return (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      initPuzzleForCategory(cat);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={label}
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
                      {CATEGORY_EMOJI[cat] ?? ''} {label}
                    </Text>
                    {active ? <Check size={16} color="#047857" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {activeWord ? (
        <View style={styles.clueBanner}>
          <View style={styles.clueRow1}>
            <View style={styles.dirBadge}>
              <Text style={styles.dirBadgeText} maxFontSizeMultiplier={1.15}>
                {activeWord.dir === 'across'
                  ? isTr
                    ? 'SAĞA ▶'
                    : 'ACROSS ▶'
                  : isTr
                    ? 'AŞAĞI ▼'
                    : 'DOWN ▼'}
              </Text>
            </View>
            <Text style={styles.clueMeaning} numberOfLines={2} maxFontSizeMultiplier={1.2}>
              {activeWord.word.emoji} {isTr ? activeWord.word.tr : activeWord.word.en}
            </Text>
            {!activeWordCompleted ? (
              <View
                style={[
                  styles.wordPtsPill,
                  activeWordEarnablePts < 10 && styles.wordPtsPillReduced,
                ]}
              >
                <Text
                  style={[
                    styles.wordPtsText,
                    activeWordEarnablePts < 10 && styles.wordPtsTextReduced,
                  ]}
                  maxFontSizeMultiplier={1.1}
                >
                  +{activeWordEarnablePts} {isTr ? 'p' : 'pts'}
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => {
                if (!audioUsedWordsRef.current.has(activeWord.id)) {
                  audioUsedWordsRef.current.add(activeWord.id);
                  setAudioUsedWords((prev) => ({ ...prev, [activeWord.id]: true }));
                }
                speakText(activeWord.word.pt, { language });
              }}
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Telaffuzunu Dinle' : 'Listen pronunciation'}
              hitSlop={6}
              style={({ pressed }) => [styles.audioBtn, pressed && styles.pressed]}
            >
              <Volume2 size={15} color="#3730a3" />
            </Pressable>
          </View>

          <View style={styles.clueRow2}>
            <View style={styles.previewWrap}>
              <Text
                style={[
                  styles.previewLetters,
                  activeWordCompleted && styles.previewLettersDone,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.68}
                maxFontSizeMultiplier={1.1}
              >
                {activeWordCompleted ? '✅ ' : ''}
                {activeWordProgress}
              </Text>
              <Text style={styles.letterCountText} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                ({activeWord.id.length} {isTr ? 'harf' : 'letters'})
              </Text>
            </View>

            <View style={styles.clueActions}>
              <Pressable
                onPress={handleHint}
                disabled={activeWordCompleted}
                accessibilityRole="button"
                accessibilityLabel={isTr ? 'İpucu' : 'Hint'}
                hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.hintAction,
                  activeWordCompleted && styles.actionBtnDisabled,
                  pressed && !activeWordCompleted && styles.pressed,
                ]}
              >
                <Text style={[styles.actionBtnText, styles.hintActionText]} maxFontSizeMultiplier={1.1}>
                  💡 {isTr ? 'İpucu' : 'Hint'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleCheck}
                accessibilityRole="button"
                accessibilityLabel={isTr ? 'Kontrol' : 'Check'}
                hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
                style={({ pressed }) => [styles.actionBtn, styles.checkAction, pressed && styles.pressed]}
              >
                <Text style={[styles.actionBtnText, styles.checkActionText]} maxFontSizeMultiplier={1.1}>
                  ✅ {isTr ? 'Kontrol' : 'Check'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleRevealAll}
                accessibilityRole="button"
                accessibilityLabel={isTr ? 'Çözüm' : 'Solve'}
                hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
                style={({ pressed }) => [styles.actionBtn, styles.solveAction, pressed && styles.pressed]}
              >
                <Text style={[styles.actionBtnText, styles.solveActionText]} maxFontSizeMultiplier={1.1}>
                  👁️ {isTr ? 'Çözüm' : 'Solve'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.boardWrapper}>
        <View
          style={[
            styles.gridFrame,
            {
              width: cellSize * puzzle.width + 4,
            },
          ]}
        >
          {puzzle.grid.map((row, r) => (
            <View key={r} style={styles.gridRow}>
              {row.map((cell, c) => {
                if (cell.type === 'block') {
                  const hasTopEdge = r > 0 && puzzle.grid[r - 1]?.[c]?.type !== 'block';
                  const hasBottomEdge =
                    r < puzzle.grid.length - 1 && puzzle.grid[r + 1]?.[c]?.type !== 'block';
                  const hasLeftEdge = c > 0 && row[c - 1]?.type !== 'block';
                  const hasRightEdge = c < row.length - 1 && row[c + 1]?.type !== 'block';
                  return (
                    <View
                      key={c}
                      style={[
                        styles.cellBlock,
                        {
                          width: cellSize,
                          height: cellSize,
                          borderColor: '#64748b',
                          borderTopWidth: hasTopEdge ? 1 : 0,
                          borderBottomWidth: hasBottomEdge ? 1 : 0,
                          borderLeftWidth: hasLeftEdge ? 1 : 0,
                          borderRightWidth: hasRightEdge ? 1 : 0,
                        },
                      ]}
                    />
                  );
                }

                if (cell.type === 'clue') {
                  if (cell.clueType === 'single') {
                    const text = formatBoxClue(isTr ? cell.clue.word.tr : cell.clue.word.en);
                    const isRight = cell.clue.arrow === 'right';
                    const isActiveClue = activeWordId === cell.clue.wordId;
                    const lines = text.includes('\n') ? 2 : 1;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => selectWord(cell.clue.wordId)}
                        accessibilityRole="button"
                        accessibilityLabel={text}
                        style={[
                          styles.cellBase,
                          styles.cellClue,
                          isActiveClue && styles.cellClueActive,
                          { width: cellSize, height: cellSize },
                        ]}
                      >
                        <Text
                          style={[
                            styles.clueBoxText,
                            {
                              fontSize: clueFontSize,
                              lineHeight: clueLineHeight,
                              paddingRight: isRight ? 3 : 0,
                              paddingBottom: isRight ? 0 : 3,
                            },
                          ]}
                          numberOfLines={lines}
                          adjustsFontSizeToFit
                          minimumFontScale={0.62}
                          maxFontSizeMultiplier={1.05}
                        >
                          {text}
                        </Text>
                        <View
                          pointerEvents="none"
                          style={isRight ? styles.arrowRightTriangle : styles.arrowDownTriangle}
                        />
                      </Pressable>
                    );
                  }

                  const topText = formatBoxClue(
                    isTr ? cell.topClue.word.tr : cell.topClue.word.en,
                  );
                  const bottomText = formatBoxClue(
                    isTr ? cell.bottomClue.word.tr : cell.bottomClue.word.en,
                  );
                  return (
                    <View
                      key={c}
                      style={[
                        styles.cellBase,
                        styles.cellSplitClue,
                        { width: cellSize, height: cellSize },
                      ]}
                    >
                      <Pressable
                        onPress={() => selectWord(cell.topClue.wordId)}
                        accessibilityRole="button"
                        accessibilityLabel={topText}
                        style={[
                          styles.splitHalf,
                          activeWordId === cell.topClue.wordId && styles.cellClueActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.clueBoxText,
                            {
                              fontSize: splitClueFontSize,
                              lineHeight: splitClueLineHeight,
                              paddingRight: 3,
                            },
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.58}
                          maxFontSizeMultiplier={1.05}
                        >
                          {topText.replace('\n', ' ')}
                        </Text>
                        <View pointerEvents="none" style={styles.arrowRightTriangle} />
                      </Pressable>
                      <View style={styles.splitDivider} />
                      <Pressable
                        onPress={() => selectWord(cell.bottomClue.wordId)}
                        accessibilityRole="button"
                        accessibilityLabel={bottomText}
                        style={[
                          styles.splitHalf,
                          activeWordId === cell.bottomClue.wordId && styles.cellClueActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.clueBoxText,
                            {
                              fontSize: splitClueFontSize,
                              lineHeight: splitClueLineHeight,
                              paddingBottom: 2,
                            },
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.58}
                          maxFontSizeMultiplier={1.05}
                        >
                          {bottomText.replace('\n', ' ')}
                        </Text>
                        <View pointerEvents="none" style={styles.arrowDownTriangle} />
                      </Pressable>
                    </View>
                  );
                }

                const key = makeCellKey(r, c);
                const val = userInputs[key] ?? '';
                const status = cellStatus[key];
                const isSelected =
                  selectedCell !== null && selectedCell[0] === r && selectedCell[1] === c;
                const isInActiveWord = cell.wordIds.includes(activeWordId);

                return (
                  <Pressable
                    key={c}
                    onPress={() => handleLetterCellClick(r, c, cell.wordIds)}
                    accessibilityRole="button"
                    accessibilityLabel={val || (isTr ? 'Boş harf kutusu' : 'Empty letter cell')}
                    style={[
                      styles.cellBase,
                      styles.cellLetter,
                      isInActiveWord && styles.cellInWord,
                      isSelected && styles.cellSelected,
                      status === 'correct' && styles.cellCorrect,
                      status === 'wrong' && styles.cellWrong,
                      { width: cellSize, height: cellSize },
                    ]}
                  >
                    {cell.startArrows.includes('right') ? (
                      <View pointerEvents="none" style={styles.startArrowRight} />
                    ) : null}
                    {cell.startArrows.includes('down') ? (
                      <View pointerEvents="none" style={styles.startArrowDown} />
                    ) : null}
                    <Text
                      style={[
                        styles.letterCellText,
                        { fontSize: letterFontSize },
                        status === 'correct' && styles.letterCorrectText,
                        status === 'wrong' && styles.letterWrongText,
                      ]}
                      maxFontSizeMultiplier={1.1}
                    >
                      {val}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.keyboard}>
        <View style={styles.keyboardRow}>
          {KEYBOARD_ROW1.map((ch) => (
            <Pressable
              key={ch}
              onPress={() => typeLetter(ch)}
              accessibilityRole="button"
              accessibilityLabel={ch}
              hitSlop={2}
              style={({ pressed }) => [styles.keyBtn, pressed && styles.keyPressed]}
            >
              <Text style={styles.keyText} maxFontSizeMultiplier={1.2}>
                {ch}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.keyboardRow}>
          {KEYBOARD_ROW2.map((ch) => (
            <Pressable
              key={ch}
              onPress={() => typeLetter(ch)}
              accessibilityRole="button"
              accessibilityLabel={ch}
              hitSlop={2}
              style={({ pressed }) => [styles.keyBtn, pressed && styles.keyPressed]}
            >
              <Text style={styles.keyText} maxFontSizeMultiplier={1.2}>
                {ch}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.keyboardRow}>
          {KEYBOARD_ROW3.map((ch) => (
            <Pressable
              key={ch}
              onPress={() => typeLetter(ch)}
              accessibilityRole="button"
              accessibilityLabel={ch}
              hitSlop={2}
              style={({ pressed }) => [styles.keyBtn, pressed && styles.keyPressed]}
            >
              <Text style={styles.keyText} maxFontSizeMultiplier={1.2}>
                {ch}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={deleteLetter}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Harf sil' : 'Delete letter'}
            hitSlop={2}
            style={({ pressed }) => [
              styles.keyBtn,
              styles.keyBackBtn,
              pressed && styles.keyPressed,
            ]}
          >
            <Delete size={17} color={colors.textDark} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radii.xxl,
    borderWidth: 3,
    borderColor: '#059669',
    paddingHorizontal: 7,
    paddingVertical: 8,
    gap: 8,
    ...shadows.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#059669',
    flexWrap: 'wrap',
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  titleBadge: {
    backgroundColor: '#059669',
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBadgeText: {
    fontSize: 12,
    lineHeight: 15,
  },
  title: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#065f46',
    letterSpacing: -0.2,
  },
  dropdownBtn: {
    height: 30,
    maxWidth: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    flexShrink: 1,
  },
  dropdownBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textDark,
    flexShrink: 1,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  progressPill: {
    minHeight: 30,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    borderRadius: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 30,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
  },
  newBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '90%',
    maxWidth: 360,
    maxHeight: '72%',
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: '#059669',
    overflow: 'hidden',
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ecfdf5',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#065f46',
  },
  modalCloseBtn: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  modalList: {
    padding: 8,
    gap: 4,
  },
  modalOption: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    backgroundColor: '#f8fafc',
  },
  modalOptionActive: {
    backgroundColor: '#dcfce7',
    borderWidth: 1.5,
    borderColor: '#059669',
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
  },
  modalOptionTextActive: {
    color: '#065f46',
    fontWeight: '800',
  },
  boardWrapper: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  gridFrame: {
    backgroundColor: '#cfd8d3',
    borderWidth: 2,
    borderColor: '#0f172a',
    borderRadius: 6,
    overflow: 'hidden',
    ...shadows.sm,
  },
  gridRow: {
    flexDirection: 'row',
  },
  cellBase: {
    borderWidth: 1,
    borderColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellBlock: {
    backgroundColor: '#cfd8d3',
  },
  cellClue: {
    backgroundColor: '#fdf3c7',
    paddingHorizontal: 1,
    paddingVertical: 0.5,
    position: 'relative',
  },
  cellSplitClue: {
    backgroundColor: '#fdf3c7',
    padding: 0,
  },
  splitHalf: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 1,
    position: 'relative',
  },
  splitDivider: {
    height: 1,
    width: '100%',
    backgroundColor: '#64748b',
  },
  cellClueActive: {
    backgroundColor: '#fcd34d',
    borderColor: '#2563eb',
    borderWidth: 1.5,
  },
  arrowRightTriangle: {
    position: 'absolute',
    right: 1,
    top: '50%',
    marginTop: -3,
    width: 0,
    height: 0,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderLeftWidth: 4,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#dc2626',
  },
  arrowDownTriangle: {
    position: 'absolute',
    bottom: 1,
    left: '50%',
    marginLeft: -3,
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#dc2626',
  },
  clueBoxText: {
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    includeFontPadding: false,
  },
  cellLetter: {
    backgroundColor: colors.white,
    position: 'relative',
  },
  cellInWord: {
    backgroundColor: '#dbeafe',
  },
  cellSelected: {
    backgroundColor: '#93c5fd',
    borderWidth: 2,
    borderColor: '#1d4ed8',
  },
  cellCorrect: {
    backgroundColor: '#dcfce7',
  },
  cellWrong: {
    backgroundColor: '#fee2e2',
  },
  startArrowRight: {
    position: 'absolute',
    left: 1,
    top: '50%',
    marginTop: -2.5,
    width: 0,
    height: 0,
    borderTopWidth: 2.5,
    borderTopColor: 'transparent',
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  startArrowDown: {
    position: 'absolute',
    top: 1,
    left: '50%',
    marginLeft: -2.5,
    width: 0,
    height: 0,
    borderLeftWidth: 2.5,
    borderLeftColor: 'transparent',
    borderRightWidth: 2.5,
    borderRightColor: 'transparent',
    borderTopWidth: 4,
    borderTopColor: '#dc2626',
  },
  letterCellText: {
    fontWeight: '800',
    color: '#0f172a',
  },
  letterCorrectText: {
    color: '#166534',
  },
  letterWrongText: {
    color: '#991b1b',
  },
  clueBanner: {
    backgroundColor: '#fefce8',
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: '#fde047',
    paddingHorizontal: 9,
    paddingVertical: 6,
    gap: 5,
  },
  clueRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dirBadge: {
    backgroundColor: '#dc2626',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  dirBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
  },
  clueMeaning: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1e293b',
  },
  audioBtn: {
    minWidth: 32,
    minHeight: 28,
    borderRadius: 8,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  clueRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
  },
  previewWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewLetters: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 1.3,
    flexShrink: 1,
  },
  previewLettersDone: {
    color: '#166534',
  },
  letterCountText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748b',
    flexShrink: 0,
  },
  wordPtsPill: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    flexShrink: 0,
  },
  wordPtsPillReduced: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
  },
  wordPtsText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  wordPtsTextReduced: {
    color: '#b45309',
  },
  clueActions: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
    paddingHorizontal: 6,
    borderRadius: 7,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  hintAction: {
    backgroundColor: '#facc15',
  },
  checkAction: {
    backgroundColor: '#2563eb',
  },
  solveAction: {
    backgroundColor: '#dcfce7',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  hintActionText: {
    color: '#713f12',
  },
  checkActionText: {
    color: colors.white,
  },
  solveActionText: {
    color: '#166534',
  },
  keyboard: {
    backgroundColor: '#e2e8f0',
    borderRadius: radii.md,
    padding: 5,
    gap: 5,
  },
  keyboardRow: {
    flexDirection: 'row',
    gap: 4,
  },
  keyBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 7,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#94a3b8',
  },
  keyBackBtn: {
    backgroundColor: '#cbd5e1',
  },
  keyPressed: {
    backgroundColor: '#bae6fd',
    transform: [{ scale: 0.95 }],
  },
  keyText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
  },
  pressed: {
    opacity: 0.85,
  },
});
