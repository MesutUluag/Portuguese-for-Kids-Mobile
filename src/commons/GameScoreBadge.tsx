import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii, spacing } from '@/theme/tokens';

export interface GameScoreBadgeProps {
  score?: number;
  recentGain?: number | null;
  gainKey?: number;
  language?: 'en' | 'tr';
  compact?: boolean;
}

/**
 * Top-right live session score badge rendered inside every game card,
 * with a Reanimated floating `+N` popup triggered by `gainKey`.
 */
export function GameScoreBadge({
  score = 0,
  recentGain = null,
  gainKey = 0,
  language = 'en',
  compact = false,
}: GameScoreBadgeProps): React.ReactElement {
  const reducedMotion = useReducedMotion();
  const popupOpacity = useSharedValue(0);
  const popupTranslateY = useSharedValue(0);
  const popupScale = useSharedValue(0.8);

  useEffect(() => {
    if (recentGain === null || recentGain <= 0 || gainKey <= 0) {
      return undefined;
    }

    if (reducedMotion) {
      popupOpacity.value = 1;
      popupTranslateY.value = -14;
      popupScale.value = 1;
      popupOpacity.value = withDelay(750, withTiming(0, { duration: 150 }));
    } else {
      popupOpacity.value = 1;
      popupTranslateY.value = 0;
      popupScale.value = 0.7;

      popupScale.value = withSequence(
        withSpring(1.18, { damping: 10, stiffness: 260 }),
        withSpring(1, { damping: 14, stiffness: 220 }),
      );
      popupTranslateY.value = withTiming(-24, { duration: 850 });
      popupOpacity.value = withDelay(550, withTiming(0, { duration: 300 }));
    }

    return () => {
      cancelAnimation(popupOpacity);
      cancelAnimation(popupTranslateY);
      cancelAnimation(popupScale);
    };
  }, [gainKey, popupOpacity, popupScale, popupTranslateY, recentGain, reducedMotion]);

  const popupStyle = useAnimatedStyle(() => ({
    opacity: popupOpacity.value,
    transform: [
      { translateY: popupTranslateY.value },
      { scale: popupScale.value },
    ],
  }));

  const isTr = language === 'tr';

  return (
    <View
      accessible
      accessibilityLabel={isTr ? `Oyun puanı: ${score}` : `Game score: ${score}`}
      style={styles.container}
    >
      <View style={[styles.pill, compact && styles.pillCompact]}>
        <Text style={[styles.star, compact && styles.starCompact]}>⭐</Text>
        <Text style={[styles.value, compact && styles.valueCompact]}>{score}</Text>
      </View>

      {recentGain !== null && recentGain > 0 && gainKey > 0 ? (
        <Animated.View pointerEvents="none" style={[styles.floatBadge, popupStyle]}>
          <Text style={styles.floatText}>+{recentGain}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignSelf: 'flex-end',
    zIndex: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.amberPale,
    borderWidth: 2,
    borderColor: colors.amber,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 6,
  },
  pillCompact: {
    minHeight: 30,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  star: {
    fontSize: 15,
  },
  starCompact: {
    fontSize: 13,
  },
  value: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
  },
  valueCompact: {
    fontSize: 13,
    color: '#92400e',
  },
  floatBadge: {
    position: 'absolute',
    right: 4,
    top: -4,
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  floatText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
});
