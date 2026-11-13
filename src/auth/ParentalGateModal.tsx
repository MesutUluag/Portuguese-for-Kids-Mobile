import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AlertCircle, ShieldCheck, X } from 'lucide-react-native';
import { colors, radii, shadows, spacing, touchTargets } from '@/theme/tokens';

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 30;

export interface ParentalGateProps {
  visible: boolean;
  language: 'en' | 'tr';
  reason?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface Challenge {
  left: number;
  right: number;
  answer: number;
}

function generateChallenge(): Challenge {
  const left = 11 + Math.floor(Math.random() * 6); // 11..16
  const right = 3 + Math.floor(Math.random() * 3); // 3..5
  return { left, right, answer: left * right };
}

function ParentalGateBody({
  language,
  reason,
  onSuccess,
  onCancel,
}: Omit<ParentalGateProps, 'visible'>) {
  const [challenge, setChallenge] = useState<Challenge>(() => generateChallenge());
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const isTr = language === 'tr';
  const isLocked = secondsRemaining > 0;

  useEffect(() => {
    if (secondsRemaining <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  const handleVerify = () => {
    if (isLocked) {
      return;
    }
    const parsed = Number.parseInt(input.trim(), 10);
    if (!Number.isFinite(parsed) || parsed !== challenge.answer) {
      const nextAttempts = failedAttempts + 1;
      setChallenge(generateChallenge());
      setInput('');
      if (nextAttempts >= MAX_ATTEMPTS) {
        setFailedAttempts(0);
        setSecondsRemaining(LOCKOUT_SECONDS);
        setError(null);
      } else {
        setFailedAttempts(nextAttempts);
        setError(
          isTr
            ? 'Yanlış cevap. Lütfen yeni soruyu bir ebeveynle çözün.'
            : 'Incorrect answer. Please ask a parent to solve the new problem.',
        );
      }
      return;
    }
    setFailedAttempts(0);
    setError(null);
    onSuccess();
  };

  const displayError = isLocked
    ? isTr
      ? `Çok fazla hatalı deneme. Lütfen ${secondsRemaining} saniye bekleyin.`
      : `Too many incorrect attempts. Please wait ${secondsRemaining}s before trying again.`
    : error;

  return (
    <View style={styles.backdrop}>
      <View style={styles.card} accessibilityViewIsModal>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isTr ? 'Ebeveyn kilidini kapat' : 'Close parental gate'}
          hitSlop={10}
          onPress={onCancel}
          style={styles.closeBtn}
        >
          <X size={20} color={colors.textDark} />
        </Pressable>

        <View style={styles.headerRow}>
          <View style={styles.badge}>
            <ShieldCheck size={24} color={colors.navy} />
          </View>
          <Text style={styles.title}>
            {isTr ? 'Ebeveyn Kontrolü' : 'Parents Only'}
          </Text>
        </View>

        <Text style={styles.subtitle}>
          {reason ||
            (isTr
              ? 'Devam etmek için lütfen bir ebeveynden bu işlemi çözmesini isteyin:'
              : 'Please ask a parent or guardian to solve this quick math check to continue:')}
        </Text>

        <View style={styles.challengeBox}>
          <Text
            style={styles.challengeText}
            accessibilityLabel={`${challenge.left} times ${challenge.right}`}
          >
            {challenge.left} × {challenge.right} = ?
          </Text>
        </View>

        <TextInput
          accessibilityLabel={isTr ? 'Matematik cevabı' : 'Parental gate answer'}
          editable={!isLocked}
          keyboardType="number-pad"
          onChangeText={(text) => {
            setInput(text);
            if (error) setError(null);
          }}
          onSubmitEditing={handleVerify}
          placeholder={isTr ? 'Cevabı yazın' : 'Enter answer'}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          style={[styles.input, isLocked && styles.inputDisabled]}
          value={input}
        />

        {displayError ? (
          <View
            accessible
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={styles.errorRow}
          >
            <AlertCircle size={16} color={colors.red} />
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'İptal' : 'Cancel'}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.btn,
              styles.btnCancel,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.btnCancelText}>{isTr ? 'İptal' : 'Cancel'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Doğrula ve devam et' : 'Verify and continue'}
            disabled={isLocked}
            onPress={handleVerify}
            style={({ pressed }) => [
              styles.btn,
              styles.btnConfirm,
              isLocked && styles.btnDisabled,
              pressed && !isLocked && styles.btnPressed,
            ]}
          >
            <Text style={styles.btnConfirmText}>
              {isLocked
                ? isTr
                  ? `Bekleyin (${secondsRemaining}s)`
                  : `Wait (${secondsRemaining}s)`
                : isTr
                  ? 'Doğrula'
                  : 'Verify'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function ParentalGateModal({
  visible,
  language,
  reason,
  onSuccess,
  onCancel,
}: ParentalGateProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      {visible ? (
        <ParentalGateBody
          language={language}
          reason={reason}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 3,
    borderColor: colors.blueLight,
    ...shadows.lg,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.xxl,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.amberPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textDark,
    lineHeight: 20,
  },
  challengeBox: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.amber,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  challengeText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.navy,
  },
  input: {
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.blueLight,
    paddingHorizontal: spacing.md,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
    textAlign: 'center',
  },
  inputDisabled: {
    opacity: 0.5,
    backgroundColor: '#f8fafc',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#fef2f2',
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.red,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btn: {
    flex: 1,
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  btnCancel: {
    backgroundColor: '#f1f5f9',
  },
  btnConfirm: {
    backgroundColor: colors.blue,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnCancelText: {
    color: colors.textDark,
    fontSize: 15,
    fontWeight: '700',
  },
  btnConfirmText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
