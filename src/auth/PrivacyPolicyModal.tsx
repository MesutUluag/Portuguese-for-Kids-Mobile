import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, ExternalLink, ShieldCheck, X } from 'lucide-react-native';
import { colors, radii, shadows, spacing, touchTargets } from '@/theme/tokens';

export interface PrivacyPolicyContentProps {
  language: 'en' | 'tr';
  onClose: () => void;
  onOpenExternal?: () => void;
  backMode?: boolean;
}

export function PrivacyPolicyContent({
  language,
  onClose,
  onOpenExternal,
  backMode = false,
}: PrivacyPolicyContentProps) {
  const isTr = language === 'tr';

  return (
    <View style={styles.card} accessibilityViewIsModal>
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <ShieldCheck size={14} color="#15803d" />
          <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>
            {isTr
              ? 'Çocuk Dostu • Sıfır Reklam • Sıfır Takip'
              : 'Kid-Safe • Zero Ads • Zero Tracking'}
          </Text>
        </View>
        <Pressable
          testID="privacy-policy-close-btn"
          accessibilityRole="button"
          accessibilityLabel={
            backMode
              ? isTr
                ? 'Geri dön'
                : 'Go back'
              : isTr
                ? 'Gizlilik politikasını kapat'
                : 'Close privacy policy'
          }
          hitSlop={10}
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
        >
          {backMode ? (
            <ArrowLeft size={20} color={colors.textMuted} />
          ) : (
            <X size={20} color={colors.textMuted} />
          )}
        </Pressable>
      </View>

      <Text style={styles.title} maxFontSizeMultiplier={1.25}>
        {isTr
          ? 'Gizlilik Politikası — Portuguese for Kids'
          : 'Privacy Policy — Portuguese for Kids'}
      </Text>
      <Text style={styles.meta} maxFontSizeMultiplier={1.2}>
        {isTr ? 'Son güncelleme: Kasım 2026' : 'Last updated: November 2026'}
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <View style={styles.callout}>
          <Text style={styles.calloutText} maxFontSizeMultiplier={1.25}>
            {isTr
              ? 'Ebeveynler için Özet: Kelime kartları ve sesli telaffuz hesap olmadan çalışır. İsteğe bağlı oyun ve hikaye ilerlemesi kaydı, çarpma tabanlı bir Ebeveyn Kilidi arkasındaki ebeveyn hesabını kullanır. Sıfır reklam gösteririz ve reklam kimliği (AD_ID) toplamayız.'
              : 'Summary for Parents: Flashcards and audio pronunciation work without any account. Optional game and story progress saving uses a parent-owned account protected behind a math-based Parental Gate. We show zero advertisements and collect zero advertising identifiers (AD_ID is blocked).'}
          </Text>
        </View>

        <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.25}>
          {isTr ? '1. Topladığımız Veriler ve Nedeni' : '1. Data We Collect & Why'}
        </Text>
        <Text style={styles.paragraph} maxFontSizeMultiplier={1.25}>
          {isTr
            ? '• Misafir Kullanımı (Hesapsız): Çocuklar giriş yapmadan kelime kartlarını gezebilir, sesli telaffuzları ve paket içi müziği dinleyebilir. Yalnızca dil ve müzik tercihleri cihazınızda yerel olarak saklanır.'
            : '• Guest Usage (No Account): Children can browse Flashcards, hear speech synthesis, and listen to bundled music without signing in. Only language and music toggle preferences are stored locally on your device.'}
        </Text>
        <Text style={styles.paragraph} maxFontSizeMultiplier={1.25}>
          {isTr
            ? '• Ebeveyn Hesabı (İsteğe Bağlı): E-posta/Şifre, Google veya Apple ile giriş yapan ebeveynler Firebase Authentication hesabı oluşturur. İlerlemeyi cihazlar arasında eşitlemek için yalnızca kimlik (UID), seçilen takma ad ve öğrenme istatistikleri (puanlar, günlük çalışma süresi, seriler ve tamamlanan oyun/hikaye sayıları) saklanır.'
            : '• Parent Account (Optional): Parents who sign in via Email/Password, Google, or Apple create a Firebase Authentication account. We store only the authentication UID, parent-selected app nickname, and learning telemetry (scores, daily study timer, streaks, and completed game/story counts) to sync progress across devices.'}
        </Text>
        <Text style={styles.paragraph} maxFontSizeMultiplier={1.25}>
          {isTr
            ? '• Çocuk Dostu Liderlik Tablosu: Sıralamada yalnızca önceden onaylı veya rastgele eğlenceli takma adlar (ör. Brave Owl) görünür. Gerçek adlar ve e-posta adresleri asla herkese açık gösterilmez.'
            : '• Kid-Safe Leaderboard: Only pre-approved or randomized playful nicknames (for example, Brave Owl or Sunny Fox) appear on the leaderboard. Real names and email addresses are never displayed publicly.'}
        </Text>
        <Text style={styles.paragraph} maxFontSizeMultiplier={1.25}>
          {isTr
            ? '• Hikaye Modu ve Çeviriler: Hikaye Modu kullanılırken yalnızca seçilen konu (ör. school veya market) ve kişisel olmayan hikaye cümleleri hikaye sunucumuza veya MyMemory çeviri servisine gönderilir. Kişisel çocuk verisi gönderilmez.'
            : '• AI Stories & Translations: When using Story Mode, only the selected scenario topic (e.g. school or market) and non-personal story sentences are sent to our backend story generator or the MyMemory translation API. No personal child data is sent.'}
        </Text>
        <Text style={styles.paragraph} maxFontSizeMultiplier={1.25}>
          {isTr
            ? '• Yerel Hata Tanılama: Beklenmeyen bir ekran hatasında e-postalar, jetonlar ve sorgu parametreleri yerel olarak temizlenir; üçüncü taraf reklam veya profilleme SDK’ları olmadan tek yönlü karma kimlik ile özetlenir.'
            : '• Local Diagnostics: If a screen encounters an unexpected error, emails, tokens, and query parameters are stripped locally and summarized using a one-way hashed identifier without third-party ad or profiling SDKs.'}
        </Text>

        <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.25}>
          {isTr
            ? '2. Üçüncü Taraf Servisler ve Paylaşım'
            : '2. Third-Party Services & Data Sharing'}
        </Text>
        <Text style={styles.paragraph} maxFontSizeMultiplier={1.25}>
          {isTr
            ? '• Kişisel verileri asla satmayız veya kiralamayız.'
            : '• We do not sell or rent personal data.'}
        </Text>
        <Text style={styles.paragraph} maxFontSizeMultiplier={1.25}>
          {isTr
            ? '• Üçüncü taraf reklam ağları veya davranışsal analiz SDK’ları içermez.'
            : '• We do not include third-party ad networks or behavioral analytics SDKs.'}
        </Text>
        <Text style={styles.paragraph} maxFontSizeMultiplier={1.25}>
          {isTr
            ? '• Bulut depolama ve kimlik doğrulama yalnızca temel uygulama işlevleri için Google Firebase Authentication, Cloud Firestore ve arka uç API’miz tarafından sağlanır.'
            : '• Cloud storage and authentication are powered by Google Firebase Authentication, Cloud Firestore, and our backend API solely to provide core app functionality.'}
        </Text>

        <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.25}>
          {isTr
            ? '3. Ebeveyn Kontrolleri ve Hesap Silme'
            : '3. Parental Controls & Account Deletion'}
        </Text>
        <Text style={styles.paragraph} maxFontSizeMultiplier={1.25}>
          {isTr
            ? 'Hesap oluşturma, giriş, harici bağlantılar ve hesap silme işlemleri Ebeveyn Kilidi gerektirir. Ebeveynler hesaplarını ve tüm kayıtlı ilerlemeyi istedikleri zaman Profil & İstatistikler içindeki Hesabı Sil düğmesinden kalıcı olarak silebilir.'
            : 'Account creation, sign-in, external links, and deletion actions require passing a multiplication Parental Gate. Parents can permanently delete their account and all stored progress at any time via Delete Account inside Profile & Stats.'}
        </Text>

        <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.25}>
          {isTr ? '4. İletişim' : '4. Contact Us'}
        </Text>
        <Text style={styles.paragraph} maxFontSizeMultiplier={1.25}>
          {isTr
            ? 'Gizlilik soruları, veri dışa aktarma veya silme desteği için github.com/mesutuluag/Portugese-for-Kids/issues adresinden destek talebi açabilirsiniz.'
            : 'For privacy questions, parental data export requests, or deletion assistance, please open a support request at github.com/mesutuluag/Portugese-for-Kids/issues.'}
        </Text>
      </ScrollView>

      <View style={styles.actionsRow}>
        {onOpenExternal ? (
          <Pressable
            testID="privacy-policy-external-btn"
            accessibilityRole="link"
            accessibilityLabel={
              isTr ? 'Web sürümünü aç' : 'Open web version'
            }
            onPress={onOpenExternal}
            style={({ pressed }) => [styles.externalBtn, pressed && styles.pressed]}
          >
            <ExternalLink size={16} color={colors.skyDark} />
            <Text style={styles.externalBtnText} maxFontSizeMultiplier={1.2}>
              {isTr ? 'Web Sürümünü Aç' : 'Open Web Version'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          testID="privacy-policy-done-btn"
          accessibilityRole="button"
          accessibilityLabel={
            backMode ? (isTr ? 'Geri' : 'Back') : isTr ? 'Tamam' : 'Done'
          }
          onPress={onClose}
          style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}
        >
          <Text style={styles.doneBtnText} maxFontSizeMultiplier={1.2}>
            {backMode ? (isTr ? 'Geri' : 'Back') : isTr ? 'Tamam' : 'Done'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export interface PrivacyPolicyModalProps {
  visible: boolean;
  language: 'en' | 'tr';
  onClose: () => void;
  onOpenExternal?: () => void;
}

export function PrivacyPolicyModal({
  visible,
  language,
  onClose,
  onOpenExternal,
}: PrivacyPolicyModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <PrivacyPolicyContent
          language={language}
          onClose={onClose}
          onOpenExternal={onOpenExternal}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 3,
    borderColor: colors.amberLight,
    gap: spacing.sm,
    maxHeight: '88%',
    ...shadows.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 1,
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#15803d',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.navy,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  callout: {
    backgroundColor: '#f0f9ff',
    borderWidth: 2,
    borderColor: '#bae6fd',
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  calloutText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textDark,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.navy,
    marginTop: spacing.xs,
  },
  paragraph: {
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textDark,
  },
  actionsRow: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  externalBtn: {
    minHeight: touchTargets.nav,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  externalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.skyDark,
  },
  doneBtn: {
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
