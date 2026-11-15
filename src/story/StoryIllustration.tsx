import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { getSceneTheme } from '@/core/story/sceneTheme';
import type { StoryPage } from '@/core/data/types';
import { SceneProp } from '@/story/SceneProp';
import { colors, radii } from '@/theme/tokens';

export interface StoryIllustrationProps {
  page: StoryPage;
  pageKey: number;
  language: 'en' | 'tr';
  prefetchedImageUrl?: string;
}

/**
 * Displays the disk-cached AI story illustration when available, or a themed
 * storybook backdrop derived from `getSceneTheme(page)` with finite entry motion.
 */
export function StoryIllustration({
  page,
  pageKey,
  language,
  prefetchedImageUrl,
}: StoryIllustrationProps): React.ReactElement {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const theme = getSceneTheme(page);
  const isTr = language === 'tr';

  const heroOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const heroTranslateY = useSharedValue(reduceMotion ? 0 : 18);
  const heroScale = useSharedValue(reduceMotion ? 1 : 0.85);

  useEffect(() => {
    if (reduceMotion) {
      heroOpacity.value = 1;
      heroTranslateY.value = 0;
      heroScale.value = 1;
      return;
    }
    heroOpacity.value = 0;
    heroTranslateY.value = 18;
    heroScale.value = 0.85;
    heroOpacity.value = withTiming(1, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
    heroTranslateY.value = withSpring(0, { damping: 14, stiffness: 180 });
    heroScale.value = withSpring(1, { damping: 12, stiffness: 200 });
  }, [heroOpacity, heroScale, heroTranslateY, pageKey, reduceMotion]);

  const heroAnimStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [
      { translateY: heroTranslateY.value },
      { scale: heroScale.value },
    ],
  }));

  const showPhoto = Boolean(prefetchedImageUrl) && failedUri !== prefetchedImageUrl;

  const skyAccentEmoji =
    theme.sunDisplay === 'sun'
      ? '☀️'
      : theme.sunDisplay === 'moon'
        ? '🌙'
        : theme.sunDisplay === 'rain'
          ? '🌧️'
          : theme.sunDisplay === 'snow'
            ? '❄️'
            : null;

  return (
    <View
      testID="story-illustration"
      accessibilityLabel={
        isTr
          ? `Hikaye resmi: ${page.en}`
          : `Story illustration: ${page.en}`
      }
      style={[styles.frame, { backgroundColor: theme.skyTop }]}
    >
      {showPhoto && prefetchedImageUrl ? (
        <>
          <Image
            testID="story-illustration-photo"
            source={{ uri: prefetchedImageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={reduceMotion ? 0 : 240}
            onError={() => setFailedUri(prefetchedImageUrl)}
          />
          <View pointerEvents="none" style={styles.photoScrim} />
        </>
      ) : (
        <>
          {/* Sky bottom horizon tint */}
          <View
            pointerEvents="none"
            style={[styles.skyBottomBand, { backgroundColor: theme.skyBottom }]}
          />

          {/* Soft clouds when daytime / overcast */}
          {theme.cloudOpacity > 0.35 ? (
            <>
              <View
                pointerEvents="none"
                style={[styles.cloud, styles.cloudLeft, { opacity: theme.cloudOpacity * 0.85 }]}
              />
              <View
                pointerEvents="none"
                style={[styles.cloud, styles.cloudRight, { opacity: theme.cloudOpacity * 0.75 }]}
              />
            </>
          ) : null}

          {/* Sun / Moon / Weather badge */}
          {skyAccentEmoji ? (
            <Text pointerEvents="none" style={styles.skyAccent} maxFontSizeMultiplier={1.1}>
              {skyAccentEmoji}
            </Text>
          ) : null}

          {/* Rolling hill + ground strip */}
          <View
            pointerEvents="none"
            style={[
              styles.hill,
              {
                backgroundColor: theme.hillColor,
                borderTopColor: theme.hillDark,
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[styles.ground, { backgroundColor: theme.groundColor }]}
          />
          <Text pointerEvents="none" style={styles.grassRow} maxFontSizeMultiplier={1.1}>
            🌿 🌱 🌿 🌱 🌿 🌱 🌿
          </Text>

          {/* Supporting side props */}
          <View pointerEvents="none" style={styles.propLeft}>
            <SceneProp emoji={page.bgLeft} size={46} />
          </View>
          <View pointerEvents="none" style={styles.propRight}>
            <SceneProp emoji={page.bgRight} size={46} />
          </View>

          {/* Center character */}
          <Animated.View
            pointerEvents="none"
            style={[styles.mainEmojiWrap, heroAnimStyle]}
          >
            <Text style={styles.mainEmoji} maxFontSizeMultiplier={1.15}>
              {page.mainEmoji}
            </Text>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 768 / 460,
    borderRadius: radii.lg,
    borderWidth: 3,
    borderColor: '#38bdf8',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '25%',
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
  },
  skyBottomBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '34%',
    bottom: '38%',
    opacity: 0.7,
  },
  cloud: {
    position: 'absolute',
    backgroundColor: colors.white,
    borderRadius: 999,
  },
  cloudLeft: {
    top: 16,
    left: 22,
    width: 64,
    height: 22,
  },
  cloudRight: {
    top: 34,
    left: 108,
    width: 48,
    height: 16,
  },
  skyAccent: {
    position: 'absolute',
    top: 10,
    right: 16,
    fontSize: 30,
  },
  hill: {
    position: 'absolute',
    left: '-12%',
    right: '-12%',
    bottom: 0,
    height: '46%',
    borderTopLeftRadius: 240,
    borderTopRightRadius: 240,
    borderTopWidth: 3,
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '16%',
  },
  grassRow: {
    position: 'absolute',
    bottom: '34%',
    fontSize: 15,
    letterSpacing: 1,
    opacity: 0.9,
  },
  propLeft: {
    position: 'absolute',
    bottom: '16%',
    left: 16,
  },
  propRight: {
    position: 'absolute',
    bottom: '16%',
    right: 16,
  },
  mainEmojiWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  mainEmoji: {
    fontSize: 64,
    lineHeight: 74,
  },
});
