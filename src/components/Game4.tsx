import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { colors, shadows } from '@/theme/tokens';
import { scoreGame4 } from '@/utils/gameScoring';
import type { GameProps } from './Game1';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzáéíóúãõç';

const BLANK_WORDS = kidsWords.filter((w) => w.pt.length >= 3 && !w.pt.includes(' '));

interface RoundState {
  roundId: number;
  target: Word;
  missingIndex: number;
  correctChar: string;
  options: string[];
}

function shuffleChars(chars: readonly string[]): string[] {
  const copy = [...chars];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a && b) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}

function buildRound(roundId: number): RoundState {
  const target =
    BLANK_WORDS[Math.floor(Math.random() * BLANK_WORDS.length)] ??
    BLANK_WORDS[0] ??
    kidsWords[0]!;
  const missingIndex = Math.floor(Math.random() * target.pt.length);
  const correctChar = target.pt[missingIndex] ?? 'a';

  const opts = [correctChar];
  let guard = 0;
  while (opts.length < 4 && guard < 120) {
    guard += 1;
    const rand = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (rand && !opts.includes(rand)) {
      opts.push(rand);
    }
  }

  return {
    roundId,
    target,
    missingIndex,
    correctChar,
    options: shuffleChars(opts),
  };
}

export function Game4({
  language,
  onScore,
  score = 0,
  recentGain = null,
  gainKey = 0,
}: GameProps) {
  const isTr = language === 'tr';
  const reduceMotion = useReducedMotion();

  const [round, setRound] = useState<RoundState>(() => buildRound(1));
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastWrongChar, setLastWrongChar] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  const hasWrongAttemptRef = useRef(false);
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
    speakText(round.target.pt, { language: langRef.current });
  }, [round.roundId, round.target.pt]);

  useEffect(() => {
    if (shakeKey <= 0 || reduceMotion) return undefined;
    shakeX.set(
      withSequence(
        withTiming(-8, { duration: 55 }),
        withTiming(8, { duration: 55 }),
        withTiming(-6, { duration: 55 }),
        withTiming(6, { duration: 55 }),
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

  const handleAnswer = (c: string) => {
    if (showSuccess) return;

    if (c === round.correctChar) {
      setShowSuccess(true);
      setLastWrongChar(null);
      const points = scoreGame4(hasWrongAttemptRef.current);
      onScore?.(points);

      cancelAdvanceRef.current?.();
      cancelAdvanceRef.current = speakAndSchedule(round.target.pt, {
        language,
        minDelayMs: 1600,
        fallbackMs: 2800,
        onAdvance: () => {
          hasWrongAttemptRef.current = false;
          setShowSuccess(false);
          setLastWrongChar(null);
          setRound((prev) => buildRound(prev.roundId + 1));
        },
      });
    } else {
      hasWrongAttemptRef.current = true;
      setLastWrongChar(c);
      setShakeKey((k) => k + 1);
      speakText(round.target.pt, { language });

      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = setTimeout(() => {
        setLastWrongChar(null);
      }, 600);
    }
  };

  const chars = round.target.pt.split('');
  const blankText = chars
    .map((ch, idx) => (!showSuccess && idx === round.missingIndex ? '_' : ch))
    .join(' ');

  return (
    <Animated.View style={[styles.card, animStyle]}>
      <View style={styles.badgeSlot}>
        <GameScoreBadge
          score={score}
          recentGain={recentGain}
          gainKey={gainKey}
          language={language}
        />
      </View>

      <Text style={styles.title} maxFontSizeMultiplier={1.25}>
        ✍️ {isTr ? 'Eksik Harfi Bul' : 'Fill Missing Letter'}
      </Text>

      <View style={styles.imageStage}>
        <WordImage
          en={round.target.en}
          emoji={round.target.emoji}
          size={120}
          onPress={() => speakText(round.target.pt, { language })}
          accessibilityLabel={
            isTr
              ? `${round.target.tr} kelimesini dinle`
              : `Listen to ${round.target.en}`
          }
        />
      </View>

      <Text style={styles.blankDisplay} maxFontSizeMultiplier={1.2}>
        {blankText}
      </Text>

      <Text style={styles.blankTranslation} maxFontSizeMultiplier={1.2}>
        {isTr ? round.target.tr : round.target.en}
      </Text>

      <View style={styles.letterOptions}>
        {round.options.map((c) => {
          const isCorrect = showSuccess && c === round.correctChar;
          const isWrong = lastWrongChar === c;
          return (
            <Pressable
              key={c}
              disabled={showSuccess}
              onPress={() => handleAnswer(c)}
              accessibilityRole="button"
              accessibilityLabel={c}
              accessibilityState={{ disabled: showSuccess }}
              hitSlop={4}
              style={({ pressed }) => [
                styles.charBtn,
                isCorrect && styles.charCorrect,
                isWrong && styles.charWrong,
                showSuccess && !isCorrect && styles.charDisabled,
                pressed && !showSuccess && styles.pressed,
              ]}
            >
              <Text style={styles.charBtnText} maxFontSizeMultiplier={1.2}>
                {c}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 3.5,
    borderColor: colors.blue,
    padding: 20,
    gap: 10,
    position: 'relative',
    ...shadows.md,
  },
  badgeSlot: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.blue,
    textAlign: 'center',
    paddingHorizontal: 58,
    minHeight: 34,
  },
  imageStage: {
    alignItems: 'center',
    paddingTop: 2,
  },
  blankDisplay: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
    letterSpacing: 3.5,
  },
  blankTranslation: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -2,
  },
  letterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },
  charBtn: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  charCorrect: {
    backgroundColor: colors.green,
  },
  charWrong: {
    backgroundColor: colors.red,
  },
  charDisabled: {
    opacity: 0.4,
  },
  charBtnText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.94 }],
  },
});
