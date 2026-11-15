import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { cancelSpeech, speakText } from '@/audio/speech';
import { GameScoreBadge } from '@/commons/GameScoreBadge';
import { WordImage } from '@/commons/WordImage';
import { kidsWords } from '@/core/data/index';
import type { Word } from '@/core/data/types';
import { colors, radii, shadows, spacing, touchTargets } from '@/theme/tokens';
import { GAME3_PAIR_POINTS, scoreGame3BoardBonus } from '@/utils/gameScoring';
import type { GameProps } from './Game1';

function shuffleArray<T>(list: readonly T[]): T[] {
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

function createDeck(): Word[] {
  const selected: Word[] = [];
  while (selected.length < 3 && selected.length < kidsWords.length) {
    const rand = kidsWords[Math.floor(Math.random() * kidsWords.length)];
    if (rand && !selected.some((s) => s.pt === rand.pt)) {
      selected.push(rand);
    }
  }
  return shuffleArray([...selected, ...selected]);
}

interface MemoryTileProps {
  item: Word;
  isFlipped: boolean;
  isMatched: boolean;
  language: 'en' | 'tr';
  reduceMotion: boolean;
  onPress: () => void;
}

function MemoryTile({
  item,
  isFlipped,
  isMatched,
  language,
  reduceMotion,
  onPress,
}: MemoryTileProps) {
  const revealed = isFlipped || isMatched;
  const flipProgress = useSharedValue(revealed ? 1 : 0);

  useEffect(() => {
    const target = revealed ? 1 : 0;
    flipProgress.value = reduceMotion
      ? target
      : withTiming(target, { duration: 260 });
  }, [revealed, reduceMotion, flipProgress]);

  const frontStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: flipProgress.value === 1 ? 0 : 1 };
    }
    const rotateY = `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg`;
    return {
      transform: [{ perspective: 800 }, { rotateY }],
      backfaceVisibility: 'hidden',
    };
  });

  const backStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: flipProgress.value === 1 ? 1 : 0 };
    }
    const rotateY = `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg`;
    return {
      transform: [{ perspective: 800 }, { rotateY }],
      backfaceVisibility: 'hidden',
    };
  });

  const label = revealed
    ? language === 'tr'
      ? item.tr
      : item.en
    : language === 'tr'
      ? 'Kapalı hafıza kartı'
      : 'Hidden memory card';

  return (
    <Pressable
      onPress={onPress}
      disabled={revealed}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: revealed }}
      style={({ pressed }) => [styles.tileSlot, pressed && !revealed && styles.tilePressed]}
    >
      <Animated.View style={[styles.tileFace, styles.tileCover, frontStyle]}>
        <Text style={styles.tileQuestion}>❓</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.tileFace,
          styles.tileRevealed,
          isMatched && styles.tileMatched,
          backStyle,
        ]}
      >
        <WordImage en={item.en} emoji={item.emoji} size={64} />
      </Animated.View>
    </Pressable>
  );
}

export function Game3({
  language,
  onScore,
  score = 0,
  recentGain = null,
  gainKey = 0,
}: GameProps) {
  const isTr = language === 'tr';
  const reduceMotion = useReducedMotion();

  const [deck, setDeck] = useState<Word[]>(() => createDeck());
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [blocked, setBlocked] = useState(false);

  const turnsRef = useRef(0);
  const mismatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (mismatchTimerRef.current) clearTimeout(mismatchTimerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      cancelSpeech();
    };
  }, []);

  const load = useCallback(() => {
    if (mismatchTimerRef.current) clearTimeout(mismatchTimerRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    turnsRef.current = 0;
    setDeck(createDeck());
    setFlipped([]);
    setMatched([]);
    setBlocked(false);
  }, []);

  const handleFlip = (idx: number, item: Word) => {
    if (blocked || flipped.includes(idx) || matched.includes(idx)) return;

    const newFlipped = [...flipped, idx];
    setFlipped(newFlipped);
    speakText(item.pt, { language });

    if (newFlipped.length === 2) {
      turnsRef.current += 1;
      const a = newFlipped[0];
      const b = newFlipped[1];
      if (a === undefined || b === undefined) return;
      const item1 = deck[a];
      const item2 = deck[b];
      if (!item1 || !item2) return;

      if (item1.pt === item2.pt) {
        const newMatched = [...matched, a, b];
        setMatched(newMatched);
        setFlipped([]);
        onScore?.(GAME3_PAIR_POINTS);

        if (newMatched.length === 6) {
          const boardBonus = scoreGame3BoardBonus(turnsRef.current);
          onScore?.(boardBonus);
          if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
          resetTimerRef.current = setTimeout(() => {
            load();
          }, 1000);
        }
      } else {
        setBlocked(true);
        if (mismatchTimerRef.current) clearTimeout(mismatchTimerRef.current);
        mismatchTimerRef.current = setTimeout(() => {
          setFlipped([]);
          setBlocked(false);
        }, 1000);
      }
    }
  };

  const rows: Word[][] = [deck.slice(0, 3), deck.slice(3, 6)];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>
          🃏 {isTr ? 'Hafıza Oyunu' : 'Memory Match'}
        </Text>
        <GameScoreBadge
          score={score}
          recentGain={recentGain}
          gainKey={gainKey}
          language={language}
        />
      </View>

      <Text style={styles.prompt} maxFontSizeMultiplier={1.2}>
        {isTr ? 'Eşleşen emoji çiftlerini bul!' : 'Find matching emoji pairs!'}
      </Text>

      <View style={styles.grid}>
        {rows.map((row, rIdx) => (
          <View key={rIdx} style={styles.gridRow}>
            {row.map((item, cIdx) => {
              const globalIdx = rIdx * 3 + cIdx;
              const isFlipped = flipped.includes(globalIdx);
              const isMatched = matched.includes(globalIdx);
              return (
                <MemoryTile
                  key={`${globalIdx}-${item.pt}`}
                  item={item}
                  isFlipped={isFlipped}
                  isMatched={isMatched}
                  language={language}
                  reduceMotion={Boolean(reduceMotion)}
                  onPress={() => handleFlip(globalIdx, item)}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 3,
    borderColor: colors.purple,
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
    color: colors.purple,
  },
  prompt: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
  },
  grid: {
    gap: spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tileSlot: {
    flex: 1,
    minHeight: touchTargets.min * 2,
    position: 'relative',
  },
  tilePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  tileFace: {
    position: 'absolute',
    inset: 0,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    borderWidth: 2,
    ...shadows.sm,
  },
  tileCover: {
    backgroundColor: colors.purple,
    borderColor: colors.purpleDark,
  },
  tileQuestion: {
    fontSize: 32,
  },
  tileRevealed: {
    backgroundColor: '#faf5ff',
    borderColor: colors.purpleLight,
  },
  tileMatched: {
    backgroundColor: colors.greenLight,
    borderColor: colors.green,
  },
});
