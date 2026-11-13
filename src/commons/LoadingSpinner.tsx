import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme/tokens';

export interface LoadingSpinnerProps {
  language?: 'en' | 'tr';
  label?: string;
}

export function LoadingSpinner({
  language = 'en',
  label,
}: LoadingSpinnerProps): React.ReactElement {
  const displayText = label ?? (language === 'tr' ? 'Yükleniyor…' : 'Loading…');

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityLabel={displayText}
      style={styles.container}
    >
      <ActivityIndicator size="large" color={colors.blue} />
      <Text style={styles.text}>{displayText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
