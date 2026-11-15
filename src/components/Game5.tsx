import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { cancelSpeech, speakAndSchedule, speakText } from '@/audio/speech';
import { GameScoreBadge } from '@/commons/GameScoreBadge';
import { WordImage } from '@/commons/WordImage';
import { kidsWords } from '@/core/data/index';
import type { Word } from '@/core/data/types';
import { colors, radii, shadows, spacing, touchTargets } from '@/theme/tokens';
import { scoreGame5 } from '@/utils/gameScoring';
import type { GameProps } from './Game1';

const SCRAMBLE_WORDS = kidsWords.filter(
  (w) => w.pt.length >= 3 && w.pt.length <= 8 && !w.pt.includes(' '),
);

function shuffleChars(chars: readonly string[]): string[] {
  const copy = [...chars];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a !== undefined && b !== undefined) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}

function scrambleWord(word: Word): string[] {
  return shuffleChars(word.pt.split(''));
}

function pickRandomWord(): Word {
  return SCRAMBLE_WORDS[Math.floor(Math.random() * SCRAMBLE_WORDS.length)] ?? SCRAMBLE_WORDS[0] ?? kidsWords[0]!;
}

export function Game5({
  language,
  onScore,
  score = 0,
  recentGain = null,
  gainKey = 0,
}: GameProps) {
  const isTr = language === 'tr';
  const reduceMotion = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();

  const [history, setHistory] = useState<Word[]>(() => [pickRandomWord()]);
  const [historyIdx, setHistoryIdx] = useState<number>(0);
  const [wordEpoch, setWordEpoch] = useState<number>(1);
  const target = history[historyIdx] ?? history[0]!;

  const [scrambled, setScrambled] = useState<string[]>(() => scrambleWord(target));
  const [input, setInput] = useState<string[]>([]);
  const [hidden, setHidden] = useState<boolean[]>(() => Array(target.pt.length).fill(false));
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  const hadResetRef = useRef(false);
  const cancelAdvanceRef = useRef<(() => void) | null>(null);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langRef = useRef(language);

  useEffect(() => {
    langRef.current = language;
  }, [language]);

  const shakeX = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  useEffect(() => {
    speakText(target.pt, { language: langRef.current });
  }, [wordEpoch, target.pt]);

  useEffect(() => {
    if (shakeKey <= 0 || reduceMotion) return undefined;
    shakeX.set(
      withSequence(
        withTiming(-9, { duration: 55 }),
        withTiming(9, { duration: 55 }),
        withTiming(-7, { duration: 55 }),
        withTiming(7, { duration: 55 }),
        withTiming(0, { duration: 55 }),
      ),
    );
    return () => cancelAnimation(shakeX);
  }, [shakeKey, reduceMotion, shakeX]);

  useEffect(() => {
    return () => {
      cancelAdvanceRef.current?.();
      cancelAdvanceRef.current = null;
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
      cancelSpeech();
    };
  }, []);

  const applyLoadedWord = useCallback((word: Word) => {
    cancelAdvanceRef.current?.();
    cancelAdvanceRef.current = null;
    if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    hadResetRef.current = false;
    const sc = scrambleWord(word);
    setScrambled(sc);
    setInput([]);
    setHidden(Array(sc.length).fill(false));
    setFeedback(null);
    setWordEpoch((e) => e + 1);
  }, []);

  const loadNew = useCallback(() => {
    const nextWord = pickRandomWord();
    setHistory((prev) => {
      const next = [...prev, nextWord];
      setHistoryIdx(next.length - 1);
      return next;
    });
    applyLoadedWord(nextWord);
  }, [applyLoadedWord]);

  const handlePrev = () => {
    if (historyIdx <= 0) return;
    const prevIdx = historyIdx - 1;
    const prevWord = history[prevIdx];
    if (!prevWord) return;
    setHistoryIdx(prevIdx);
    applyLoadedWord(prevWord);
  };

  const handleNext = () => {
    const nextIdx = historyIdx + 1;
    if (nextIdx < history.length) {
      const existing = history[nextIdx];
      if (!existing) return;
      setHistoryIdx(nextIdx);
      applyLoadedWord(existing);
    } else {
      loadNew();
    }
  };

  const handleReset = useCallback(() => {
    hadResetRef.current = true;
    setInput([]);
    setHidden(Array(scrambled.length).fill(false));
    setFeedback(null);
  }, [scrambled.length]);

  const handleLetter = (idx: number, char: string) => {
    if (hidden[idx] || feedback === 'correct') return;

    const newInput = [...input, char];
    const newHidden = [...hidden];
    newHidden[idx] = true;
    setInput(newInput);
    setHidden(newHidden);

    if (newInput.length === target.pt.length) {
      if (newInput.join('') === target.pt) {
        setFeedback('correct');
        const points = scoreGame5(target.pt.length, hadResetRef.current);
        onScore?.(points);

        cancelAdvanceRef.current?.();
        cancelAdvanceRef.current = speakAndSchedule(target.pt, {
          language,
          minDelayMs: 950,
          postSpeechPauseMs: 250,
          fallbackMs: 2600,
          onAdvance: loadNew,
        });
      } else {
        hadResetRef.current = true;
        setFeedback('wrong');
        setShakeKey((k) => k + 1);
        speakText(target.pt, { language });

        if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
        wrongTimerRef.current = setTimeout(() => {
          setInput([]);
          setHidden(Array(scrambled.length).fill(false));
          setFeedback(null);
        }, 600);
      }
    }
  };

  const remaining = Math.max(0, target.pt.length - input.length);
  const slots =
    input.join(' ') + (input.length > 0 ? ' ' : '') + '_ '.repeat(remaining).trimEnd();

  const tileRowMaxWidth = Math.max(240, Math.min(windowWidth - 92, 380));
  const letterCount = Math.max(1, scrambled.length);
  const tileGap = letterCount >= 7 ? 5 : 7;
  const tileWidth = Math.max(
    28,
    Math.min(
      50,
      Math.floor((tileRowMaxWidth - tileGap * (letterCount - 1)) / letterCount),
    ),
  );
  const tileHeight = Math.max(44, Math.min(50, tileWidth + 6));
  const tileFontSize = tileWidth >= 46 ? 22 : tileWidth >= 38 ? 19 : 17;

  return (
    <Animated.View style={[styles.card, animStyle]}>
      <View style={styles.headerRow}>
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>
          🧩 {isTr ? 'Kelimeyi Bul' : 'Unscramble Word'}
        </Text>
        <GameScoreBadge
          score={score}
          recentGain={recentGain}
          gainKey={gainKey}
          language={language}
        />
      </View>

      <View style={styles.imageStage}>
        <WordImage
          en={target.en}
          emoji={target.emoji}
          size={120}
          onPress={() => speakText(target.pt, { language })}
          accessibilityLabel={isTr ? `${target.tr} kelimesini dinle` : `Listen to ${target.en}`}
        />
      </View>

      <View
        style={[
          styles.slotsBanner,
          feedback === 'correct' && styles.slotsCorrect,
          feedback === 'wrong' && styles.slotsWrong,
        ]}
      >
        <Text
          style={[
            styles.slotsText,
            (feedback === 'correct' || feedback === 'wrong') && styles.slotsTextLight,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={1.2}
        >
          {slots}
        </Text>
      </View>

      <Text style={styles.hintText} maxFontSizeMultiplier={1.2}>
        {isTr ? `Anlamı: ${target.tr}` : `Meaning: ${target.en}`}
      </Text>

      <View style={[styles.tilesPool, { gap: tileGap }]}>
        {scrambled.map((char, idx) => {
          const isHidden = Boolean(hidden[idx]);
          return (
            <Pressable
              key={idx}
              disabled={isHidden || feedback === 'correct'}
              onPress={() => handleLetter(idx, char)}
              accessibilityRole="button"
              accessibilityLabel={char}
              accessibilityState={{ disabled: isHidden || feedback === 'correct' }}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              style={({ pressed }) => [
                styles.tileBtn,
                { width: tileWidth, height: tileHeight },
                isHidden && styles.tileHidden,
                pressed && !isHidden && feedback !== 'correct' && styles.pressed,
              ]}
            >
              <Text
                style={[styles.tileText, { fontSize: tileFontSize }]}
                maxFontSizeMultiplier={1.15}
              >
                {isHidden ? '' : char}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.controlsRow}>
        <Pressable
          disabled={historyIdx <= 0}
          onPress={handlePrev}
          accessibilityRole="button"
          accessibilityLabel={isTr ? 'Önceki kelime' : 'Previous word'}
          accessibilityState={{ disabled: historyIdx <= 0 }}
          style={({ pressed }) => [
            styles.navBtn,
            historyIdx <= 0 && styles.navBtnDisabled,
            pressed && historyIdx > 0 && styles.pressed,
          ]}
        >
          <Text style={styles.ctrlText}>◀</Text>
        </Pressable>

        <Pressable
          onPress={handleReset}
          accessibilityRole="button"
          accessibilityLabel={isTr ? 'Sıfırla' : 'Reset'}
          style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
        >
          <Text style={styles.resetText} maxFontSizeMultiplier={1.2}>
            🔄 {isTr ? 'Sıfırla' : 'Reset'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleNext}
          accessibilityRole="button"
          accessibilityLabel={isTr ? 'Sonraki kelime' : 'Next word'}
          style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
        >
          <Text style={styles.ctrlText}>▶</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 3,
    borderColor: colors.orange,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: colors.orange,
  },
  imageStage: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  slotsBanner: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: '#fff7ed',
    borderWidth: 2,
    borderColor: colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  slotsCorrect: {
    backgroundColor: colors.green,
    borderColor: '#059669',
  },
  slotsWrong: {
    backgroundColor: colors.red,
    borderColor: '#dc2626',
  },
  slotsText: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.navy,
    letterSpacing: 3,
    textAlign: 'center',
  },
  slotsTextLight: {
    color: colors.white,
  },
  hintText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
  },
  tilesPool: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  tileBtn: {
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.orange,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  tileHidden: {
    opacity: 0,
  },
  tileText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#9a3412',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  navBtn: {
    minWidth: touchTargets.min,
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  resetBtn: {
    flex: 1,
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    backgroundColor: '#fff7ed',
    borderWidth: 2,
    borderColor: colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.navy,
  },
  resetText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#9a3412',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});
