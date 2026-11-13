import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
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
import { scoreGame2 } from '@/utils/gameScoring';
import type { GameProps } from './Game1';

interface RoundState {
  roundId: number;
  target: Word;
  options: Word[];
}

function shuffleWords(list: readonly Word[]): Word[] {
  const copy = [...list];
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
  const target = kidsWords[Math.floor(Math.random() * kidsWords.length)] ?? kidsWords[0]!;
  const opts: Word[] = [target];
  while (opts.length < 4 && opts.length < kidsWords.length) {
    const rand = kidsWords[Math.floor(Math.random() * kidsWords.length)];
    if (rand && !opts.some((o) => o.pt === rand.pt)) {
      opts.push(rand);
    }
  }
  return {
    roundId,
    target,
    options: shuffleWords(opts),
  };
}

export function Game2({
  language,
  onScore,
  score = 0,
  recentGain = null,
  gainKey = 0,
}: GameProps) {
  const isTr = language === 'tr';
  const reduceMotion = useReducedMotion();

  const [round, setRound] = useState<RoundState>(() => buildRound(1));
  const [correctPt, setCorrectPt] = useState<string | null>(null);
  const [lastWrongPt, setLastWrongPt] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  const attemptsRef = useRef(0);
  const lockedRef = useRef(false);
  const cancelAdvanceRef = useRef<(() => void) | null>(null);
  const wrongFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (wrongFlashTimerRef.current) clearTimeout(wrongFlashTimerRef.current);
      cancelSpeech();
    };
  }, []);

  const handleAnswer = (opt: Word) => {
    if (lockedRef.current || correctPt) return;

    if (opt.pt === round.target.pt) {
      lockedRef.current = true;
      setCorrectPt(round.target.pt);
      setLastWrongPt(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const points = scoreGame2(attemptsRef.current);
      onScore?.(points);

      cancelAdvanceRef.current?.();
      cancelAdvanceRef.current = speakAndSchedule(round.target.pt, {
        language,
        onAdvance: () => {
          attemptsRef.current = 0;
          lockedRef.current = false;
          setCorrectPt(null);
          setLastWrongPt(null);
          setRound((prev) => buildRound(prev.roundId + 1));
        },
      });
    } else {
      attemptsRef.current += 1;
      setLastWrongPt(opt.pt);
      setShakeKey((k) => k + 1);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      speakText(round.target.pt, { language });

      if (wrongFlashTimerRef.current) clearTimeout(wrongFlashTimerRef.current);
      wrongFlashTimerRef.current = setTimeout(() => {
        setLastWrongPt(null);
      }, 600);
    }
  };

  const rows: [Word[], Word[]] = [round.options.slice(0, 2), round.options.slice(2, 4)];

  return (
    <Animated.View style={[styles.card, animStyle]}>
      <View style={styles.headerRow}>
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>
          {isTr ? 'Dinle! 🔊' : 'Tap to Listen! 🔊'}
        </Text>
        <GameScoreBadge
          score={score}
          recentGain={recentGain}
          gainKey={gainKey}
          language={language}
        />
      </View>

      <View style={styles.audioCenter}>
        <Pressable
          style={({ pressed }) => [styles.speakerBtn, pressed && styles.pressed]}
          onPress={() => {
            void Haptics.selectionAsync().catch(() => {});
            speakText(round.target.pt, { language });
          }}
          accessibilityRole="button"
          accessibilityLabel={isTr ? 'Kelimeyi tekrar dinle' : 'Replay spoken word'}
        >
          <Text style={styles.speakerEmoji}>🔊</Text>
        </Pressable>
        <Text style={styles.prompt} maxFontSizeMultiplier={1.3}>
          {isTr ? 'Hangi resmi duydun?' : 'Which picture did you hear?'}
        </Text>
        <Text style={styles.meaningHint} maxFontSizeMultiplier={1.2}>
          {isTr ? round.target.tr : round.target.en}
        </Text>
      </View>

      <View style={styles.optionsGrid}>
        {rows.map((pair, rowIdx) => (
          <View key={rowIdx} style={styles.optionRow}>
            {pair.map((opt) => {
              const isCorrect = correctPt === opt.pt;
              const isWrongFlash = lastWrongPt === opt.pt;
              return (
                <Pressable
                  key={opt.pt}
                  disabled={Boolean(correctPt)}
                  onPress={() => handleAnswer(opt)}
                  accessibilityRole="button"
                  accessibilityLabel={isTr ? opt.tr : opt.en}
                  accessibilityState={{ disabled: Boolean(correctPt) }}
                  style={({ pressed }) => [
                    styles.picBtn,
                    isCorrect && styles.picCorrect,
                    isWrongFlash && styles.picWrong,
                    pressed && !correctPt && styles.pressed,
                  ]}
                >
                  <WordImage en={opt.en} emoji={opt.emoji} size={80} />
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
    borderColor: colors.pink,
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
    color: colors.pink,
  },
  audioCenter: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  speakerBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fdf2f8',
    borderWidth: 2,
    borderColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  speakerEmoji: {
    fontSize: 34,
  },
  prompt: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
  },
  meaningHint: {
    fontSize: 14,
    fontWeight: '600',
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
  picBtn: {
    flex: 1,
    minHeight: touchTargets.min * 2,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.pinkLight,
    backgroundColor: '#fffbfc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    ...shadows.sm,
  },
  picCorrect: {
    backgroundColor: colors.greenLight,
    borderColor: colors.green,
  },
  picWrong: {
    backgroundColor: '#fee2e2',
    borderColor: colors.red,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});
