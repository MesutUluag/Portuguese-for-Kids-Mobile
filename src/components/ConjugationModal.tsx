import React, { useEffect, useState } from 'react';
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
import { verbConjugations } from '@/core/data/verbConjugations';
import type { ConjugationRow, SpecialUse } from '@/core/data/verbConjugations';
import { colors, radii, shadows } from '@/theme/tokens';

export interface ConjugationModalProps {
  verb: string | null;
  initialLevel?: 'a1' | 'a2';
  language: 'en' | 'tr';
  onClose: () => void;
}

const FP_PREFIXES = ['vou', 'vais', 'vai', 'vamos', 'vão'] as const;
const AC_PREFIXES = ['estou a', 'estás a', 'está a', 'estamos a', 'estão a'] as const;

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

interface A1TableProps {
  rows: ConjugationRow[];
  infinitive: string;
  exPresente: string;
  exFuturo: string;
  exContinua: string;
  exPresenteEn: string;
  exFuturoEn: string;
  exContinuaEn: string;
  exPresenteTr: string;
  exFuturoTr: string;
  exContinuaTr: string;
  specialUse?: SpecialUse;
  language: 'en' | 'tr';
}

function A1Table({
  rows,
  infinitive,
  exPresente,
  exFuturo,
  exContinua,
  exPresenteEn,
  exFuturoEn,
  exContinuaEn,
  exPresenteTr,
  exFuturoTr,
  exContinuaTr,
  specialUse,
  language,
}: A1TableProps) {
  const isTr = language === 'tr';
  const presenteHint = isTr ? '🟢 Şu an / Her zaman' : '🟢 Right now / Always';
  const futuroHint = isTr ? '🔜 Yakın gelecek' : '🔜 Near future';
  const continuaHint = isTr ? '🔁 Devam eden eylem' : '🔁 Ongoing action';

  return (
    <>
      <View style={styles.tableWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={styles.a1TableMinWidth}>
            <View style={styles.tableHeaderRow}>
              <View style={[styles.colPronoun, styles.thCell]}>
                <Text style={styles.thText} maxFontSizeMultiplier={1.2}>
                  PRONOME
                </Text>
              </View>
              <View style={[styles.colForm, styles.thCell]}>
                <Text style={styles.thText} maxFontSizeMultiplier={1.2}>
                  PRESENTE
                </Text>
                <Text style={styles.thHint} maxFontSizeMultiplier={1.2}>
                  {presenteHint}
                </Text>
              </View>
              <View style={[styles.colFormWide, styles.thCell]}>
                <Text style={styles.thText} maxFontSizeMultiplier={1.2}>
                  FUTURO PRÓXIMO
                </Text>
                <Text style={styles.thHint} maxFontSizeMultiplier={1.2}>
                  {futuroHint}
                </Text>
              </View>
              <View style={[styles.colFormWide, styles.thCell]}>
                <Text style={styles.thText} maxFontSizeMultiplier={1.2}>
                  AÇÃO CONTÍNUA
                </Text>
                <Text style={styles.thHint} maxFontSizeMultiplier={1.2}>
                  {continuaHint}
                </Text>
              </View>
            </View>

            {rows.map((row, i) => {
              const fp = `${FP_PREFIXES[i] ?? ''} ${infinitive}`.trim();
              const ac = `${AC_PREFIXES[i] ?? ''} ${infinitive}`.trim();
              const isEven = i % 2 === 1;
              return (
                <View
                  key={row.pronoun}
                  style={[
                    styles.tableBodyRow,
                    isEven && styles.tableBodyRowAlt,
                    i === rows.length - 1 && styles.tableBodyRowLast,
                  ]}
                >
                  <View style={[styles.colPronoun, styles.tdCell]}>
                    <Text style={styles.pronounText} maxFontSizeMultiplier={1.2}>
                      {row.pronoun}
                    </Text>
                  </View>
                  <View style={[styles.colForm, styles.tdCell, styles.formCellRow]}>
                    <Text style={styles.formText} maxFontSizeMultiplier={1.2}>
                      {row.form}
                    </Text>
                    <AudioBtn form={row.form} language={language} />
                  </View>
                  <View style={[styles.colFormWide, styles.tdCell, styles.formCellRow]}>
                    <Text style={styles.formText} maxFontSizeMultiplier={1.2}>
                      {fp}
                    </Text>
                    <AudioBtn form={fp} language={language} />
                  </View>
                  <View style={[styles.colFormWide, styles.tdCell, styles.formCellRow]}>
                    <Text style={styles.formText} maxFontSizeMultiplier={1.2}>
                      {ac}
                    </Text>
                    <AudioBtn form={ac} language={language} />
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={styles.examplesRow}>
        {[
          { pt: exPresente, tr: exPresenteTr, en: exPresenteEn },
          { pt: exFuturo, tr: exFuturoTr, en: exFuturoEn },
          { pt: exContinua, tr: exContinuaTr, en: exContinuaEn },
        ].map((item) => (
          <View key={item.pt} style={styles.exampleBox}>
            <View style={styles.examplePtRow}>
              <Text style={styles.examplePtText} maxFontSizeMultiplier={1.25}>
                💬 {item.pt}
              </Text>
              <AudioBtn form={item.pt} language={language} />
            </View>
            <Text style={styles.exampleTransText} maxFontSizeMultiplier={1.25}>
              {isTr ? item.tr : item.en}
            </Text>
          </View>
        ))}
      </View>

      {specialUse ? (
        <View style={styles.specialUseBox}>
          <View style={styles.specialUseHeader}>
            <View style={styles.specialUseFormulaPill}>
              <Text style={styles.specialUseFormulaText} maxFontSizeMultiplier={1.2}>
                {specialUse.formula}
              </Text>
            </View>
            <Text style={styles.specialUseDesc} maxFontSizeMultiplier={1.25}>
              {isTr ? specialUse.descTr : specialUse.descEn}
            </Text>
          </View>
          <View style={styles.specialUseExamples}>
            {specialUse.examples.map((ex) => (
              <View key={ex.pt} style={styles.exampleBox}>
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
      ) : null}
    </>
  );
}

interface A2TableProps {
  perfeito: ConjugationRow[];
  imperfeito: ConjugationRow[];
  language: 'en' | 'tr';
}

function A2Table({ perfeito, imperfeito, language }: A2TableProps) {
  const isTr = language === 'tr';
  const perfeitoHint = isTr ? '🎯 Bitmiş / Dün' : '🎯 Completed / Yesterday';
  const imperfeitoHint = isTr ? '🔄 Alışkanlık / Geçmiş' : '🔄 Habit / Past';

  const perfeitoFirst = perfeito[0]?.form ?? '';
  const imperfeitoFirst = imperfeito[0]?.form ?? '';
  const perfeitoExampleText = `Ontem ${perfeitoFirst} muito.`;
  const imperfeitoExampleText = `Antigamente ${imperfeitoFirst} muito.`;

  return (
    <>
      <View style={styles.tableWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={styles.a2TableMinWidth}>
            <View style={styles.tableHeaderRow}>
              <View style={[styles.colPronoun, styles.thCell]}>
                <Text style={styles.thText} maxFontSizeMultiplier={1.2}>
                  PRONOME
                </Text>
              </View>
              <View style={[styles.colA2Form, styles.thCell]}>
                <Text style={styles.thText} maxFontSizeMultiplier={1.2}>
                  PRETÉRITO PERFEITO
                </Text>
                <Text style={styles.thHint} maxFontSizeMultiplier={1.2}>
                  {perfeitoHint}
                </Text>
              </View>
              <View style={[styles.colA2Form, styles.thCell]}>
                <Text style={styles.thText} maxFontSizeMultiplier={1.2}>
                  PRETÉRITO IMPERFEITO
                </Text>
                <Text style={styles.thHint} maxFontSizeMultiplier={1.2}>
                  {imperfeitoHint}
                </Text>
              </View>
            </View>

            {perfeito.map((row, i) => {
              const impForm = imperfeito[i]?.form ?? '';
              const isEven = i % 2 === 1;
              return (
                <View
                  key={row.pronoun}
                  style={[
                    styles.tableBodyRow,
                    isEven && styles.tableBodyRowAlt,
                    i === perfeito.length - 1 && styles.tableBodyRowLast,
                  ]}
                >
                  <View style={[styles.colPronoun, styles.tdCell]}>
                    <Text style={styles.pronounText} maxFontSizeMultiplier={1.2}>
                      {row.pronoun}
                    </Text>
                  </View>
                  <View style={[styles.colA2Form, styles.tdCell, styles.formCellRow]}>
                    <Text style={styles.formText} maxFontSizeMultiplier={1.2}>
                      {row.form}
                    </Text>
                    <AudioBtn form={row.form} language={language} />
                  </View>
                  <View style={[styles.colA2Form, styles.tdCell, styles.formCellRow]}>
                    <Text style={styles.formText} maxFontSizeMultiplier={1.2}>
                      {impForm}
                    </Text>
                    <AudioBtn form={impForm} language={language} />
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={styles.examplesRow}>
        {[perfeitoExampleText, imperfeitoExampleText].map((text) => (
          <View key={text} style={styles.exampleBox}>
            <View style={styles.examplePtRow}>
              <Text style={styles.examplePtText} maxFontSizeMultiplier={1.25}>
                💬 {text}
              </Text>
              <AudioBtn form={text} language={language} />
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

export function ConjugationModal({
  verb,
  initialLevel = 'a1',
  language,
  onClose,
}: ConjugationModalProps): React.ReactElement | null {
  const propKey = `${verb ?? ''}:${initialLevel}`;
  const [levelState, setLevelState] = useState<{
    key: string;
    level: 'a1' | 'a2';
  }>({ key: propKey, level: initialLevel });

  const activeLevel =
    levelState.key === propKey ? levelState.level : initialLevel;

  useEffect(() => {
    return () => cancelSpeech();
  }, []);

  const data = verb ? verbConjugations[verb] : undefined;
  if (!verb || !data) return null;

  const isTr = language === 'tr';
  const verbDisplay = verb.toUpperCase();
  const ppSentence = `Tenho ${data.a2.participioPassado} muito.`;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={isTr ? 'Pencereyi kapat' : 'Close dialog'}
        />

        <View style={styles.modalCard} accessibilityViewIsModal>
          <View style={styles.headerRow}>
            <View style={styles.verbPill}>
              <Text style={styles.verbPillText} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {verbDisplay}: Conjugações ({activeLevel.toUpperCase()}{' '}
                {isTr ? 'Seviyesi' : 'Level'})
              </Text>
            </View>

            <View style={styles.levelSwitch}>
              <Pressable
                onPress={() => setLevelState({ key: propKey, level: 'a1' })}
                accessibilityRole="button"
                accessibilityState={{ selected: activeLevel === 'a1' }}
                accessibilityLabel="A1"
                hitSlop={4}
                style={[styles.levelBtn, activeLevel === 'a1' && styles.levelBtnActive]}
              >
                <Text
                  style={[styles.levelBtnText, activeLevel === 'a1' && styles.levelBtnTextActive]}
                  maxFontSizeMultiplier={1.2}
                >
                  A1
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setLevelState({ key: propKey, level: 'a2' })}
                accessibilityRole="button"
                accessibilityState={{ selected: activeLevel === 'a2' }}
                accessibilityLabel="A2"
                hitSlop={4}
                style={[styles.levelBtn, activeLevel === 'a2' && styles.levelBtnActive]}
              >
                <Text
                  style={[styles.levelBtnText, activeLevel === 'a2' && styles.levelBtnTextActive]}
                  maxFontSizeMultiplier={1.2}
                >
                  A2
                </Text>
              </Pressable>
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
            {activeLevel === 'a1' ? (
              <A1Table
                rows={data.a1.presente}
                infinitive={verb}
                exPresente={data.a1.exPresente}
                exFuturo={data.a1.exFuturo}
                exContinua={data.a1.exContinua}
                exPresenteEn={data.a1.exPresenteEn}
                exFuturoEn={data.a1.exFuturoEn}
                exContinuaEn={data.a1.exContinuaEn}
                exPresenteTr={data.a1.exPresenteTr}
                exFuturoTr={data.a1.exFuturoTr}
                exContinuaTr={data.a1.exContinuaTr}
                specialUse={data.a1.specialUse}
                language={language}
              />
            ) : (
              <>
                <A2Table
                  perfeito={data.a2.preteritoPerfeito}
                  imperfeito={data.a2.preteritoImperfeito}
                  language={language}
                />

                <View style={[styles.tableWrapper, styles.ppWrapper]}>
                  <View style={styles.tableHeaderRow}>
                    <View style={[styles.colPpHalf, styles.thCell]}>
                      <Text style={styles.thText} maxFontSizeMultiplier={1.2}>
                        FÓRMULA DE USO
                      </Text>
                    </View>
                    <View style={[styles.colPpHalf, styles.thCell]}>
                      <Text style={styles.thText} maxFontSizeMultiplier={1.2}>
                        PARTICÍPIO PASSADO
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.tableBodyRow, styles.tableBodyRowLast]}>
                    <View style={[styles.colPpHalf, styles.tdCell]}>
                      <Text style={styles.pronounText} maxFontSizeMultiplier={1.2}>
                        Ter / Estar +{' '}
                        <Text style={styles.ppBold}>{data.a2.participioPassado}</Text>
                      </Text>
                    </View>
                    <View style={[styles.colPpHalf, styles.tdCell]}>
                      <View style={styles.formCellRow}>
                        <Text style={styles.formText} maxFontSizeMultiplier={1.2}>
                          {data.a2.participioPassado}
                        </Text>
                        <AudioBtn form={data.a2.participioPassado} language={language} />
                      </View>
                      <Text style={styles.ppHint} maxFontSizeMultiplier={1.2}>
                        {isTr ? '(geçmiş ortaç)' : '(past participle)'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.examplesRow}>
                  <View style={styles.exampleBox}>
                    <View style={styles.examplePtRow}>
                      <Text style={styles.examplePtText} maxFontSizeMultiplier={1.25}>
                        💬 {ppSentence}
                      </Text>
                      <AudioBtn form={ppSentence} language={language} />
                    </View>
                    <Text style={styles.exampleTransText} maxFontSizeMultiplier={1.25}>
                      {isTr ? data.a2.exParticipioTr : data.a2.exParticipioEn}
                    </Text>
                  </View>
                </View>
              </>
            )}
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
    maxWidth: 520,
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
  verbPill: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  verbPillText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 12,
  },
  levelSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    padding: 3,
    gap: 2,
    flexShrink: 0,
  },
  levelBtn: {
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelBtnActive: {
    backgroundColor: colors.white,
  },
  levelBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.72)',
  },
  levelBtnTextActive: {
    color: colors.navy,
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
    backgroundColor: colors.blueLight,
  },
  bodyContent: {
    gap: 8,
    paddingBottom: 6,
  },
  tableWrapper: {
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  ppWrapper: {
    marginTop: 2,
  },
  a1TableMinWidth: {
    minWidth: 465,
  },
  a2TableMinWidth: {
    minWidth: 355,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f7f8fa',
    borderBottomWidth: 1.5,
    borderBottomColor: '#e5e7eb',
  },
  tableBodyRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  tableBodyRowAlt: {
    backgroundColor: '#fafafa',
  },
  tableBodyRowLast: {
    borderBottomWidth: 0,
  },
  thCell: {
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  tdCell: {
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  colPronoun: {
    width: 105,
  },
  colForm: {
    width: 100,
  },
  colFormWide: {
    width: 130,
  },
  colA2Form: {
    width: 125,
  },
  colPpHalf: {
    flex: 1,
  },
  thText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  thHint: {
    fontSize: 9.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  pronounText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  ppBold: {
    fontWeight: '800',
    color: colors.navy,
  },
  ppHint: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  formCellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  formText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.navy,
  },
  audioBtn: {
    padding: 2,
  },
  examplesRow: {
    gap: 6,
  },
  exampleBox: {
    backgroundColor: '#f7f8fa',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 3,
  },
  examplePtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  examplePtText: {
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '700',
    color: colors.textMuted,
    flexShrink: 1,
  },
  exampleTransText: {
    fontSize: 11,
    color: '#3b82d4',
  },
  specialUseBox: {
    borderWidth: 1.5,
    borderColor: '#d1fae5',
    borderRadius: radii.sm,
    backgroundColor: '#f0fdf4',
    padding: 10,
    gap: 8,
  },
  specialUseHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  specialUseFormulaPill: {
    backgroundColor: '#dcfce7',
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  specialUseFormulaText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#166534',
  },
  specialUseDesc: {
    fontSize: 11.5,
    color: '#166534',
    fontStyle: 'italic',
    flexShrink: 1,
  },
  specialUseExamples: {
    gap: 6,
  },
  pressed: {
    opacity: 0.7,
  },
});
