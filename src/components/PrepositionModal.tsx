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
import type { PrepGroup } from '@/core/data/types';
import { colors, radii, shadows } from '@/theme/tokens';

export interface PrepositionModalProps {
  group: PrepGroup | null;
  language: 'en' | 'tr';
  onClose: () => void;
}

const DEF_ARTICLES = [
  { pt: 'o', en: 'the', tr: 'the' },
  { pt: 'a', en: 'the', tr: 'the' },
  { pt: 'os', en: 'the', tr: 'the' },
  { pt: 'as', en: 'the', tr: 'the' },
] as const;

const INDEF_ARTICLES = [
  { pt: 'um', en: 'a, an', tr: 'bir' },
  { pt: 'uma', en: 'a, an', tr: 'bir' },
  { pt: 'uns', en: 'some', tr: 'bazı' },
  { pt: 'umas', en: 'some', tr: 'bazı' },
] as const;

const SPOKEN_EXAMPLES: Record<string, { pt: string; en: string; tr: string }> = {
  pro: { pt: 'Eu vou pro mercado.', en: 'I go to the market.', tr: 'Pazara gidiyorum.' },
  pra: { pt: 'Comprei flores pra mãe.', en: 'I bought flowers for mum.', tr: 'Annem için çiçek aldım.' },
  pros: { pt: 'Vou falar pros meninos.', en: "I'll talk to the boys.", tr: 'Çocuklarla konuşacağım.' },
  pras: { pt: 'Isto é pras meninas.', en: 'This is for the girls.', tr: 'Bu kızlar için.' },
};

const PREP_GREEN = '#c8e6c9';
const PREP_GREEN_DARK = '#388e3c';
const PREP_GREEN_BORDER = '#a5d6a7';

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
      <Volume2 size={14} strokeWidth={2.2} color={colors.navy} />
    </Pressable>
  );
}

interface GridTableProps {
  group: PrepGroup;
  articles: readonly { pt: string; en: string; tr: string }[];
  kind: 'definite' | 'indefinite';
  language: 'en' | 'tr';
}

function GridTable({ group, articles, kind, language }: GridTableProps) {
  const isTr = language === 'tr';
  const contractions = kind === 'definite' ? group.definite : (group.indefinite ?? []);

  return (
    <View style={styles.gridWrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={styles.gridMinWidth}>
          <View style={styles.gridHeaderRow}>
            <View style={styles.gridCorner} />
            {articles.map((art) => (
              <View key={art.pt} style={styles.gridArtHeader}>
                <Text style={styles.gridArtWord} maxFontSizeMultiplier={1.2}>
                  {art.pt}
                </Text>
                <Text style={styles.gridArtHint} maxFontSizeMultiplier={1.2}>
                  {isTr ? art.tr : art.en}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.gridBodyRow}>
            <View style={styles.gridBaseCell}>
              <View style={styles.gridBaseTop}>
                <Text style={styles.gridBaseWord} maxFontSizeMultiplier={1.2}>
                  {group.base}
                </Text>
                <AudioBtn form={group.base} language={language} />
              </View>
              <Text style={styles.gridBaseHint} maxFontSizeMultiplier={1.2}>
                {isTr ? group.baseTr : group.baseEn}
              </Text>
            </View>

            {contractions.map((c) => (
              <View key={c.pt} style={styles.gridContrCell}>
                <View style={styles.gridContrPill}>
                  <Text style={styles.gridContrWord} maxFontSizeMultiplier={1.2}>
                    {c.pt}
                  </Text>
                  <AudioBtn form={c.pt} language={language} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export function PrepositionModal({
  group,
  language,
  onClose,
}: PrepositionModalProps): React.ReactElement | null {
  useEffect(() => {
    return () => cancelSpeech();
  }, []);

  if (!group) return null;

  const isTr = language === 'tr';
  const hasDefiniteSection = group.definite.length > 0;
  const hasIndefiniteSection = (group.indefinite?.length ?? 0) > 0;
  const hasSpokenSection = (group.spoken?.length ?? 0) > 0;
  const hasTip = Boolean(group.tip);

  const titleLabel = isTr
    ? `${group.base.toUpperCase()} — Edatı ve Birleşimleri`
    : `${group.base.toUpperCase()} — Preposition & Contractions`;

  const defLabel = isTr
    ? 'Belirli Artikel + Edat Birleşimleri'
    : 'Preposition + Definite Article Contractions';
  const indefLabel = isTr
    ? 'Belirsiz Artikel + Edat Birleşimleri'
    : 'Preposition + Indefinite Article Contractions';
  const spokenLabel = isTr
    ? 'Konuşma Dili Birleşimleri (Gayri Resmi)'
    : 'Spoken / Informal Contractions';
  const formalNote = isTr
    ? '📝 Resmi yazımda "para" herhangi bir artikel ile birleşmez (para o, para a … olarak ayrı yazılır).'
    : '📝 In formal written Portuguese, "para" does not contract with articles (written separately: para o, para a …).';
  const exLabel = isTr ? 'Örnek Cümleler' : 'Example Sentences';
  const tipLabel = isTr ? 'İpucu' : 'Quick Tip';

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
                {titleLabel}
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
            {hasDefiniteSection ? (
              <>
                <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.2}>
                  {defLabel}
                </Text>
                <GridTable
                  group={group}
                  articles={DEF_ARTICLES}
                  kind="definite"
                  language={language}
                />
              </>
            ) : null}

            {hasIndefiniteSection ? (
              <>
                <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.2}>
                  {indefLabel}
                </Text>
                <GridTable
                  group={group}
                  articles={INDEF_ARTICLES}
                  kind="indefinite"
                  language={language}
                />
              </>
            ) : null}

            {hasSpokenSection && group.spoken ? (
              <>
                <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.2}>
                  {spokenLabel}
                </Text>
                <Text style={styles.formalNote} maxFontSizeMultiplier={1.25}>
                  {formalNote}
                </Text>
                <View style={styles.spokenTable}>
                  <View style={styles.spokenHeaderRow}>
                    <Text style={[styles.spokenColHead, styles.colFormal]} maxFontSizeMultiplier={1.2}>
                      Formal
                    </Text>
                    <Text style={[styles.spokenColHead, styles.colSpoken]} maxFontSizeMultiplier={1.2}>
                      Spoken
                    </Text>
                    <Text style={[styles.spokenColHead, styles.colExample]} maxFontSizeMultiplier={1.2}>
                      Example
                    </Text>
                  </View>

                  {group.spoken.map((c) => {
                    const rawHint = isTr ? c.trHint : c.enHint;
                    const formalPart = (rawHint.split('→')[0] ?? rawHint).trim();
                    const ex = SPOKEN_EXAMPLES[c.pt];
                    return (
                      <View key={c.pt} style={styles.spokenRow}>
                        <Text style={[styles.spokenFormalText, styles.colFormal]} maxFontSizeMultiplier={1.2}>
                          {formalPart}
                        </Text>
                        <View style={[styles.spokenFormCell, styles.colSpoken]}>
                          <Text style={styles.spokenWord} maxFontSizeMultiplier={1.2}>
                            {c.pt}
                          </Text>
                          <AudioBtn form={c.pt} language={language} />
                        </View>
                        <View style={[styles.spokenExCell, styles.colExample]}>
                          {ex ? (
                            <>
                              <View style={styles.spokenExPtRow}>
                                <Text style={styles.spokenExPt} maxFontSizeMultiplier={1.2}>
                                  {ex.pt}
                                </Text>
                                <AudioBtn form={ex.pt} language={language} />
                              </View>
                              <Text style={styles.spokenExTrans} maxFontSizeMultiplier={1.2}>
                                {isTr ? ex.tr : ex.en}
                              </Text>
                            </>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.2}>
              {exLabel}
            </Text>
            <View style={styles.examplesList}>
              {group.examples.map((ex) => {
                const label = isTr ? ex.labelTr : ex.label;
                return (
                  <View key={ex.pt} style={styles.exampleBox}>
                    {label ? (
                      <View style={styles.exampleBadge}>
                        <Text style={styles.exampleBadgeText} maxFontSizeMultiplier={1.2}>
                          {label}
                        </Text>
                      </View>
                    ) : null}
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
                );
              })}
            </View>

            {hasTip && group.tip ? (
              <>
                <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.2}>
                  {tipLabel}
                </Text>
                <View style={styles.tipBox}>
                  <Text style={styles.tipText} maxFontSizeMultiplier={1.25}>
                    {isTr ? group.tip.tr : group.tip.en}
                  </Text>
                </View>
              </>
            ) : null}
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
    maxHeight: '90%',
    padding: 12,
    ...shadows.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  titlePill: {
    flex: 1,
    minWidth: 0,
    backgroundColor: PREP_GREEN_DARK,
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
    backgroundColor: PREP_GREEN,
  },
  bodyContent: {
    gap: 6,
    paddingBottom: 6,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.textMuted,
    marginTop: 6,
  },
  gridWrapper: {
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: PREP_GREEN_BORDER,
    overflow: 'hidden',
  },
  gridMinWidth: {
    minWidth: 420,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    backgroundColor: PREP_GREEN,
    borderBottomWidth: 1.5,
    borderBottomColor: PREP_GREEN_BORDER,
  },
  gridCorner: {
    width: 112,
  },
  gridArtHeader: {
    flex: 1,
    minWidth: 76,
    borderLeftWidth: 1.5,
    borderLeftColor: PREP_GREEN_BORDER,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  gridArtWord: {
    fontSize: 14,
    fontWeight: '900',
    color: PREP_GREEN_DARK,
  },
  gridArtHint: {
    fontSize: 9.5,
    color: PREP_GREEN_DARK,
    marginTop: 1,
  },
  gridBodyRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  gridBaseCell: {
    width: 112,
    padding: 8,
  },
  gridBaseTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridBaseWord: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.navy,
  },
  gridBaseHint: {
    fontSize: 9.5,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  gridContrCell: {
    flex: 1,
    minWidth: 76,
    borderLeftWidth: 1.5,
    borderLeftColor: PREP_GREEN_BORDER,
    paddingHorizontal: 6,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    ...shadows.sm,
  },
  gridContrWord: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.navy,
  },
  audioBtn: {
    padding: 2,
  },
  formalNote: {
    fontSize: 11.5,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  spokenTable: {
    borderWidth: 1.5,
    borderColor: PREP_GREEN_BORDER,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  spokenHeaderRow: {
    flexDirection: 'row',
    backgroundColor: PREP_GREEN,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  spokenColHead: {
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: PREP_GREEN_DARK,
  },
  spokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: PREP_GREEN_BORDER,
    backgroundColor: colors.white,
  },
  colFormal: {
    width: 72,
  },
  colSpoken: {
    width: 72,
  },
  colExample: {
    flex: 1,
  },
  spokenFormalText: {
    fontSize: 11.5,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  spokenFormCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  spokenWord: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.navy,
  },
  spokenExCell: {
    gap: 2,
  },
  spokenExPtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  spokenExPt: {
    fontSize: 11.5,
    fontStyle: 'italic',
    fontWeight: '700',
    color: PREP_GREEN_DARK,
  },
  spokenExTrans: {
    fontSize: 10.5,
    color: colors.textMuted,
  },
  examplesList: {
    gap: 6,
  },
  exampleBox: {
    backgroundColor: '#f1f8e9',
    borderWidth: 1.5,
    borderColor: PREP_GREEN_BORDER,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  exampleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: PREP_GREEN,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 2,
  },
  exampleBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: PREP_GREEN_DARK,
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
    color: PREP_GREEN_DARK,
    flexShrink: 1,
  },
  exampleTransText: {
    fontSize: 11.5,
    color: colors.textMuted,
  },
  tipBox: {
    backgroundColor: '#fff8e1',
    borderWidth: 1.5,
    borderColor: '#ffe082',
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tipText: {
    fontSize: 12,
    color: '#5d4037',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.7,
  },
});
