import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, RotateCcw } from 'lucide-react-native';
import { cancelSpeech } from '@/audio/speech';
import { reportCaughtError } from '@/observability/crashReporter';
import { colors, radii, shadows, spacing, touchTargets } from '@/theme/tokens';

export interface ErrorBoundaryProps {
  resetKey: string | number;
  language: 'en' | 'tr';
  uid?: string | null;
  onResetToCards: () => void;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Mode-level safety boundary so a transient render crash inside any game or
 * Story Mode recovers cleanly back to Flashcards instead of crashing the app.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    cancelSpeech();
    void reportCaughtError(error, {
      mode: String(this.props.resetKey),
      uid: this.props.uid,
      componentStack: info.componentStack,
    });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  private handleReset = (): void => {
    this.setState({ hasError: false });
    this.props.onResetToCards();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isTr = this.props.language === 'tr';
    const title = isTr ? 'Hay aksi! Bir sorun oluştu.' : 'Oops! Something went wrong.';
    const subtitle = isTr
      ? 'Merak etme, Kartlar ekranına geri dönüp öğrenmeye devam edebilirsin.'
      : "No worries! Let's head back to Flashcards and keep learning.";
    const btnLabel = isTr ? 'Kartlara Dön' : 'Back to Flashcards';

    return (
      <View
        testID="error-boundary-fallback"
        accessibilityRole="alert"
        style={styles.card}
      >
        <View style={styles.iconWrap}>
          <AlertTriangle size={34} strokeWidth={2.2} color={colors.amber} />
        </View>
        <Text style={styles.title} maxFontSizeMultiplier={1.25}>
          {title}
        </Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.25}>
          {subtitle}
        </Text>
        <Pressable
          testID="error-boundary-reset-btn"
          accessibilityRole="button"
          accessibilityLabel={btnLabel}
          onPress={this.handleReset}
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        >
          <RotateCcw size={18} strokeWidth={2.4} color={colors.white} />
          <Text style={styles.btnText} maxFontSizeMultiplier={1.2}>
            {btnLabel}
          </Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 3,
    borderColor: colors.amberLight,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.lg,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.amberPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14.5,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.sm,
  },
  btnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
});
