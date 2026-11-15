import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CheckCircle2, Shuffle, Sparkles } from 'lucide-react-native';
import { generateNicknameOptions } from '@/auth/nicknameGenerator';
import { colors, radii, shadows, spacing, touchTargets } from '@/theme/tokens';

export interface NicknamePickerModalProps {
  visible: boolean;
  language: 'en' | 'tr';
  currentName?: string | null;
  onConfirm: (nickname: string) => Promise<void>;
  onCancel?: () => void;
}

function NicknamePickerBody({
  language,
  onConfirm,
  onCancel,
}: Omit<NicknamePickerModalProps, 'visible'>) {
  const [options, setOptions] = useState<string[]>(() =>
    generateNicknameOptions(language, 6),
  );
  const [selected, setSelected] = useState<string>(() => options[0] ?? 'BraveOwl');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTr = language === 'tr';

  const handleShuffle = () => {
    const next = generateNicknameOptions(language, 6);
    setOptions(next);
    setSelected(next[0] ?? 'BraveOwl');
    setError(null);
  };

  const handleConfirm = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(selected);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isTr
            ? 'Takma ad kaydedilemedi.'
            : 'Failed to save nickname.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.card} accessibilityViewIsModal>
        <View style={styles.headerRow}>
          <View style={styles.badge}>
            <Sparkles size={24} color={colors.amber} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              {isTr ? 'Kaşif Takma Adını Seç' : 'Choose Your Explorer Nickname'}
            </Text>
            <Text style={styles.subtitle}>
              {isTr
                ? 'Liderlik tablosunda güvenli görünmek için eğlenceli bir takma ad seç!'
                : 'Pick a fun animal nickname to stay safe on the leaderboard!'}
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          {options.map((name) => {
            const isSelected = name === selected;
            return (
              <Pressable
                key={name}
                testID={`nickname-chip-${name}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={name}
                onPress={() => setSelected(name)}
                style={({ pressed }) => [
                  styles.chip,
                  isSelected && styles.chipSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  maxFontSizeMultiplier={1.3}
                  style={[styles.chipText, isSelected && styles.chipTextSelected]}
                >
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.actions}>
          <Pressable
            testID="nickname-shuffle-btn"
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Yeni isimler üret' : 'Shuffle nickname choices'}
            disabled={saving}
            onPress={handleShuffle}
            style={({ pressed }) => [
              styles.btn,
              styles.btnShuffle,
              pressed && styles.pressed,
            ]}
          >
            <Shuffle size={18} color={colors.navy} />
            <Text style={styles.btnShuffleText}>
              {isTr ? 'Karıştır' : 'Shuffle'}
            </Text>
          </Pressable>

          <Pressable
            testID="nickname-confirm-btn"
            accessibilityRole="button"
            accessibilityLabel={
              isTr ? `Takma adı kaydet: ${selected}` : `Save nickname: ${selected}`
            }
            disabled={saving}
            onPress={() => void handleConfirm()}
            style={({ pressed }) => [
              styles.btn,
              styles.btnSave,
              saving && styles.btnDisabled,
              pressed && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <CheckCircle2 size={18} color={colors.white} />
                <Text style={styles.btnSaveText}>
                  {isTr ? 'Seç ve Devam Et' : 'Use Nickname'}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {onCancel ? (
          <Pressable
            testID="nickname-later-btn"
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Daha sonra' : 'Later'}
            disabled={saving}
            onPress={onCancel}
            style={styles.cancelLink}
          >
            <Text style={styles.cancelLinkText}>
              {isTr ? 'Şimdilik atla' : 'Skip for now'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Child-safe nickname picker with zero free-text input.
 */
export function NicknamePickerModal({
  visible,
  language,
  currentName,
  onConfirm,
  onCancel,
}: NicknamePickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      {visible ? (
        <NicknamePickerBody
          key={language}
          language={language}
          currentName={currentName}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 3,
    borderColor: colors.amberLight,
    ...shadows.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.amberPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minWidth: '47%',
    flexGrow: 1,
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.blueLight,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  chipSelected: {
    borderColor: colors.amber,
    backgroundColor: colors.amberPale,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  chipTextSelected: {
    color: colors.navy,
    fontWeight: '800',
  },
  errorText: {
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
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  btnShuffle: {
    backgroundColor: '#f1f5f9',
  },
  btnSave: {
    flex: 1,
    backgroundColor: colors.green,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
  btnShuffleText: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '700',
  },
  btnSaveText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  cancelLink: {
    minHeight: touchTargets.nav,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLinkText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
