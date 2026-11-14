import React, { useEffect } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Volume2, X } from 'lucide-react-native';
import { cancelSpeech, speakText } from '@/audio/speech';
import { adverbByWord, type AdverbEntry } from '@/core/data/adverbData';
import { colors, radii, shadows } from '@/theme/tokens';

export interface AdverbModalProps {
  word: string | null;
  language: 'en' | 'tr';
  onClose: () => void;
}

const ADV_PURPLE = '#7c3aed';
const ADV_PURPLE_LIGHT = '#ede9fe';
const ADV_PURPLE_BORDER = '#c4b5fd';
const ADV_PURPLE_PALE = '#f5f3ff';
const ADV_BADGE_BG = '#ddd6fe';
const ADV_BADGE_TEXT = '#5b21b6';

function AudioBtn({ form, language }: { form: string; language: 'en' | 'tr' }) {
  const isTr = language === 'tr';
  return (
    <Pressable
      onPress={() => speakText(form, { language, rate: 0.65 })}
      accessibilityRole="button"
      accessibilityLabel={isTr ? `${form} telaffuzunu dinle` : `Speak ${form}`}
      hitSlop={8}
      style={({ pressed }) => [styles.audioBtn, pressed && styles.pressed]}
    >
      <Volume2 size={14} strokeWidth={2.2} color={ADV_PURPLE} />
    </Pressable>
  );
}

function ExampleCard({ entry, language }: { entry: AdverbEntry; language: 'en' | 'tr' }) {
  const isTr = language === 'tr';

  return (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryEmoji}>{entry.emoji}</Text>
        <Text style={styles.entryWord} maxFontSizeMultiplier={1.2}>
          {entry.word}
        </Text>
        <AudioBtn form={entry.word} language={language} />
        <Text style={styles.entryMeaning} maxFontSizeMultiplier={1.2}>
          {isTr ? entry.meaningTr : entry.meaningEn}
        </Text>
        <View style={styles.useBadge}>
          <Text style={styles.useBadgeText} maxFontSizeMultiplier={1.2}>
            {isTr ? entry.useCaseTr : entry.useCaseEn}
          </Text>
        </View>
      </View>

      <View style={styles.examplesList}>
        {entry.examples.map((ex) => (
          <View key={ex.pt} style={styles.exampleRow}>
            <View style={styles.examplePtRow}>
              <Text style={styles.examplePtText} maxFontSizeMultiplier={1.25}>
                💬 {ex.pt}
              </Text>
              <AudioBtn form={ex.pt} language={language} />
            </View>
            <Text style={styles.exampleTransText} maxFontSizeMultiplier={1.25}>
              {isTr ? ex.tr : ex.en}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function AdverbModal({
  word,
  language,
  onClose,
}: AdverbModalProps): React.ReactElement | null {
  useEffect(() => {
    return () => cancelSpeech();
  }, []);

  const entry = word ? adverbByWord[word] : undefined;
  if (!word || !entry) return null;

  const isTr = language === 'tr';
  const titleLabel = isTr
    ? `${word.toUpperCase()} — Kullanım Örnekleri`
    : `${word.toUpperCase()} — Use Cases`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={isTr ? 'Pencereyi kapat' : 'Close dialog'}
        />

        <View style={styles.modalCard} accessibilityViewIsModal>
          <View style={styles.headerRow}>
            <View style={styles.titlePill}>
              <Text style={styles.titlePillText} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                ⚡ {titleLabel}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Kapat' : 'Close'}
              hitSlop={6}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            >
              <X size={20} strokeWidth={2.5} color={colors.navy} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.bodyContent}>
            <ExampleCard entry={entry} language={language} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 16,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    padding: 12,
    ...shadows.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  titlePill: {
    flex: 1,
    minWidth: 0,
    backgroundColor: ADV_PURPLE,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  titlePillText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 12.5,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  closeBtnPressed: {
    backgroundColor: ADV_PURPLE_LIGHT,
  },
  bodyContent: {
    paddingBottom: 4,
  },
  entryCard: {
    backgroundColor: ADV_PURPLE_PALE,
    borderWidth: 1.5,
    borderColor: ADV_PURPLE_BORDER,
    borderRadius: radii.sm,
    padding: 11,
    gap: 10,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  entryEmoji: {
    fontSize: 20,
  },
  entryWord: {
    fontSize: 17,
    fontWeight: '900',
    color: ADV_PURPLE,
  },
  entryMeaning: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    flexGrow: 1,
  },
  useBadge: {
    backgroundColor: ADV_BADGE_BG,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  useBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: ADV_BADGE_TEXT,
  },
  examplesList: {
    gap: 6,
  },
  exampleRow: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: ADV_PURPLE_BORDER,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 2,
  },
  examplePtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  examplePtText: {
    fontSize: 12.5,
    fontWeight: '800',
    fontStyle: 'italic',
    color: ADV_PURPLE,
    flexShrink: 1,
  },
  exampleTransText: {
    fontSize: 11.5,
    color: colors.textMuted,
  },
  audioBtn: {
    padding: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
