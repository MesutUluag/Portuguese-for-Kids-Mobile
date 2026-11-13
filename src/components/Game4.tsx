import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { cancelSpeech, speakText } from '@/audio/speech';
import { GameScoreBadge } from '@/commons/GameScoreBadge';
import { WordImage } from '@/commons/WordImage';
import { kidsWords } from '@/core/data/index';
import type { Word } from '@/core/data/types';
import { colors, radii, shadows, spacing, touchTargets } from '@/theme/tokens';
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
  const [popKey, setPopKey] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);

  const hasWrongAttemptRef = useRef(false);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langRef = useRef(language);

  useEffect(() => {
    langRef.current = language;
  }, [language]);

  const shakeX = useSharedValue(0);
  const cardScale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: cardScale.value }],
  }));

  useEffect(() => {
    speakText(round.target.pt, { language: langRef.current });
  }, [round.roundId, round.target.pt]);

  useEffect(() => {
    if (popKey <= 0 || reduceMotion) return undefined;
    cardScale.set(
      withSequence(
        withSpring(1.04, { damping: 12, stiffness: 280 }),
        withSpring(1, { damping: 14, stiffness: 260 }),
      ),
    );
    return () => cancelAnimation(cardScale);
  }, [popKey, reduceMotion, cardScale]);

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
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
      cancelSpeech();
    };
  }, []);

  const triggerNextRound = useCallback(() => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    nextTimerRef.current = setTimeout(() => {
      hasWrongAttemptRef.current = false;
      setShowSuccess(false);
      setLastWrongChar(null);
      setRound((prev) => buildRound(prev.roundId + 1));
    }, 2000);
  }, []);

  const handleAnswer = (c: string) => {
    if (showSuccess) return;

    if (c === round.correctChar) {
      setShowSuccess(true);
      setLastWrongChar(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const points = scoreGame4(hasWrongAttemptRef.current);
      onScore?.(points);
      speakText(round.target.pt, { language });
      setPopKey((k) => k + 1);
      triggerNextRound();
    } else {
      hasWrongAttemptRef.current = true;
      setLastWrongChar(c);
      setShakeKey((k) => k + 1);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      speakText(round.target.pt, { language });

      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = setTimeout(() => {
        setLastWrongChar(null);
      }, 600);
    }
  };

  const rows: [string[], string[]] = [round.options.slice(0, 2), round.options.slice(2, 4)];
  const chars = round.target.pt.split('');
  const blankText = chars
    .map((ch, idx) => (!showSuccess && idx === round.missingIndex ? '_' : ch))
    .join(' ');

  return (
    <Animated.View style={[styles.card, animStyle]}>
      <View style={styles.headerRow}>
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>
          ✍️ {isTr ? 'Eksik Harfi Bul' : 'Fill Missing Letter'}
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

      <View style={styles.optionsGrid}>
        {rows.map((pair, rIdx) => (
          <View key={rIdx} style={styles.optionRow}>
            {pair.map((c) => {
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
                  style={({ pressed }) => [
                    styles.charBtn,
                    isCorrect && styles.charCorrect,
                    isWrong && styles.charWrong,
                    showSuccess && !isCorrect && styles.charDisabled,
                    pressed && !showSuccess && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.charBtnText,
                      (isCorrect || isWrong) && styles.charBtnLight,
                    ]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 3,
    borderColor: colors.blue,
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
    color: colors.blue,
  },
  imageStage: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  blankDisplay: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.navy,
    textAlign: 'center',
    letterSpacing: 3,
  },
  blankTranslation: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
  },
  optionsGrid: {
    gap: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  charBtn: {
    flex: 1,
    minHeight: touchTargets.min,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.blueLight,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  charCorrect: {
    backgroundColor: colors.green,
    borderColor: '#059669',
  },
  charWrong: {
    backgroundColor: colors.red,
    borderColor: '#dc2626',
  },
  charDisabled: {
    opacity: 0.5,
  },
  charBtnText: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.navy,
  },
  charBtnLight: {
    color: colors.white,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});
