import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { touchTargets } from '@/theme/tokens';
import { useWikiImage, WIKI_USER_AGENT } from '@/utils/useWikiImage';

export interface WordImageProps {
  en: string;
  emoji: string;
  size?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Displays a cached Wikipedia thumbnail (`expo-image`) for a vocabulary item,
 * falling back cleanly to a large crisp emoji when offline or unavailable.
 */
export function WordImage({
  en,
  emoji,
  size = 100,
  onPress,
  accessibilityLabel,
  style,
}: WordImageProps): React.ReactElement {
  const imgUrl = useWikiImage(en);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const frameDimension = Math.max(size, touchTargets.min);
  const showPhoto = Boolean(imgUrl) && failedUrl !== imgUrl;

  const content =
    showPhoto && imgUrl ? (
      <Image
        source={{
          uri: imgUrl,
          headers: { 'User-Agent': WIKI_USER_AGENT ?? 'PortugueseForKidsMobile/1.0' },
        }}
        accessibilityLabel={accessibilityLabel ?? en}
        cachePolicy="memory-disk"
        contentFit="cover"
        onError={() => setFailedUrl(imgUrl)}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: 12,
          },
        ]}
      />
    ) : (
    <Text
      accessibilityLabel={accessibilityLabel ?? en}
      style={[
        styles.emoji,
        {
          fontSize: Math.round(size * 0.62),
          lineHeight: Math.round(size * 0.78),
        },
      ]}
    >
      {emoji}
    </Text>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? en}
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [
          styles.wrapper,
          { minWidth: frameDimension, minHeight: frameDimension },
          pressed && styles.pressed,
          style,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.wrapper,
        { minWidth: size, minHeight: size },
        style,
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    backgroundColor: '#f8fafc',
  },
  emoji: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
