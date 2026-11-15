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
import { colors, shadows, touchTargets } from '@/theme/tokens';
import { scoreGame1 } from '@/utils/gameScoring';

export interface GameProps {
  language: 'en' | 'tr';
  onScore?: (points: number) => void;
  score?: number;
  recentGain?: number | null;
  gainKey?: number;
}

interface RoundState {
  roundId: number;
  target: Word;
  options: string[];
}

function shuffleStrings(list: readonly string[]): string[] {
  const copy = [...list];
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

function buildRound(roundId: number): RoundState {
  const target = kidsWords[Math.floor(Math.random() * kidsWords.length)] ?? kidsWords[0]!;
  const opts = [target.pt];
  while (opts.length < 4 && opts.length < kidsWords.length) {
    const rand = kidsWords[Math.floor(Math.random() * kidsWords.length)];
    if (rand && !opts.includes(rand.pt)) {
      opts.push(rand.pt);
    }
  }
  return {
    roundId,
    target,
    options: shuffleStrings(opts),
  };
}

export function Game1({
  language,
  onScore,
  score = 0,
  recentGain = null,
  gainKey = 0,
}: GameProps) {
  const isTr = language === 'tr';
  const reduceMotion = useReducedMotion();

  const [round, setRound] = useState<RoundState>(() => buildRound(1));
  const [answered, setAnswered] = useState(false);
  const [lastWrongOpt, setLastWrongOpt] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  const mistakesRef = useRef(0);
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

  const handleAnswer = (opt: string) => {
    if (lockedRef.current || answered) return;

    if (opt === round.target.pt) {
      lockedRef.current = true;
      setAnswered(true);
      setLastWrongOpt(null);

      const points = scoreGame1(mistakesRef.current);
      onScore?.(points);

      cancelAdvanceRef.current?.();
      cancelAdvanceRef.current = speakAndSchedule(round.target.pt, {
        language,
        onAdvance: () => {
          mistakesRef.current = 0;
          lockedRef.current = false;
          setAnswered(false);
          setLastWrongOpt(null);
          setRound((prev) => buildRound(prev.roundId + 1));
        },
      });
    } else {
      mistakesRef.current += 1;
      setLastWrongOpt(opt);
      setShakeKey((k) => k + 1);
      speakText(round.target.pt, { language });

      if (wrongFlashTimerRef.current) clearTimeout(wrongFlashTimerRef.current);
      wrongFlashTimerRef.current = setTimeout(() => {
        setLastWrongOpt(null);
      }, 600);
    }
  };

  const rows: [string[], string[]] = [round.options.slice(0, 2), round.options.slice(2, 4)];

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
        {isTr ? 'Bu hangi kelime? 🔊' : 'Which word is this? 🔊'}
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
        <Text style={styles.targetLabel} maxFontSizeMultiplier={1.3}>
          {isTr ? round.target.tr : round.target.en}
        </Text>
      </View>

      <View style={styles.optionsGrid}>
        {rows.map((pair, rowIdx) => (
          <View key={rowIdx} style={styles.optionRow}>
            {pair.map((opt) => {
              const isCorrect = answered && opt === round.target.pt;
              const isWrongFlash = lastWrongOpt === opt;
              return (
                <Pressable
                  key={opt}
                  disabled={answered}
                  onPress={() => handleAnswer(opt)}
                  accessibilityRole="button"
                  accessibilityLabel={opt}
                  accessibilityState={{ disabled: answered }}
                  style={({ pressed }) => [
                    styles.optionBtn,
                    isCorrect && styles.optionCorrect,
                    isWrongFlash && styles.optionWrong,
                    pressed && !answered && styles.optionPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      (isCorrect || isWrongFlash) && styles.optionTextLight,
                    ]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    maxFontSizeMultiplier={1.3}
                  >
                    {opt}
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
    borderRadius: 24,
    borderWidth: 3.5,
    borderColor: colors.green,
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
    color: colors.green,
    textAlign: 'center',
    paddingHorizontal: 58,
    minHeight: 34,
  },
  imageStage: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  targetLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  optionsGrid: {
    gap: 10,
    marginTop: 4,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionBtn: {
    flex: 1,
    minHeight: Math.max(touchTargets.min, 50),
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  optionCorrect: {
    backgroundColor: colors.green,
    borderColor: '#059669',
  },
  optionWrong: {
    backgroundColor: colors.red,
    borderColor: '#dc2626',
  },
  optionPressed: {
    backgroundColor: '#d1fae5',
    borderColor: colors.green,
    transform: [{ scale: 0.97 }],
  },
  optionText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
  },
  optionTextLight: {
    color: colors.white,
  },
});
