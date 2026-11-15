import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { emojiToSearchTerm } from '@/core/story/sceneTheme';
import { useWikiImage, WIKI_USER_AGENT } from '@/utils/useWikiImage';

export interface ScenePropProps {
  emoji: string;
  size?: number;
}

/**
 * Renders a supporting story scene prop using a cached Wikimedia thumbnail
 * when available, falling back cleanly to a crisp emoji offline.
 */
export function SceneProp({ emoji, size = 48 }: ScenePropProps): React.ReactElement {
  const term = emojiToSearchTerm[emoji] ?? '';
  const imgUrl = useWikiImage(term);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (imgUrl && failedUrl !== imgUrl) {
    return (
      <Image
        source={{
          uri: imgUrl,
          headers: { 'User-Agent': WIKI_USER_AGENT },
        }}
        accessibilityLabel={term || emoji}
        cachePolicy="memory-disk"
        contentFit="cover"
        onError={() => setFailedUrl(imgUrl)}
        style={[
          styles.image,
          {
            width: size,
            height: size,
          },
        ]}
      />
    );
  }

  return (
    <Text
      maxFontSizeMultiplier={1.15}
      style={{ fontSize: Math.round(size * 0.82), lineHeight: Math.round(size * 0.98) }}
    >
      {emoji}
    </Text>
  );
}

const styles = StyleSheet.create({
  image: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
});
