import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  Clock,
  Edit3,
  Flame,
  LogOut,
  ShieldCheck,
  Trash2,
  Trophy,
  X,
} from 'lucide-react-native';
import { useAuth } from '@/auth/AuthContext';
import { PrivacyPolicyContent } from '@/auth/PrivacyPolicyModal';
import { getLocalDateString } from '@/auth/telemetryHelpers';
import { PRIVACY_POLICY_URL } from '@/config';
import { colors, radii, shadows, spacing, touchTargets } from '@/theme/tokens';

export interface StatsModalProps {
  language: 'en' | 'tr';
}

const CONTEXT_META: Record<
  string,
  { label: string; labelTr: string; emoji: string }
> = {
  school: { label: 'School', labelTr: 'Okul', emoji: '🏫' },
  restaurant: { label: 'Restaurant', labelTr: 'Restoran', emoji: '🍽️' },
  bank: { label: 'Bank', labelTr: 'Banka', emoji: '🏦' },
  hospital: { label: 'Hospital', labelTr: 'Hastane', emoji: '🏥' },
  cafe: { label: 'Café', labelTr: 'Kafe', emoji: '☕' },
  airport: { label: 'Airport', labelTr: 'Havalimanı', emoji: '✈️' },
  market: { label: 'Market', labelTr: 'Market', emoji: '🛒' },
  aima: { label: 'AIMA', labelTr: 'AIMA', emoji: '🏛️' },
  bus: { label: 'Bus', labelTr: 'Otobüs', emoji: '🚌' },
  pharmacy: { label: 'Pharmacy', labelTr: 'Eczane', emoji: '💊' },
  gas_station: { label: 'Gas Station', labelTr: 'Benzinlik', emoji: '⛽' },
  traffic: { label: 'Traffic & Cars', labelTr: 'Trafik', emoji: '🚗' },
};

const MODE_META: Record<
  string,
  { label: string; labelTr: string; emoji: string }
> = {
  cards: { label: 'Flashcards', labelTr: 'Kartlar', emoji: '📇' },
  story: { label: 'Story Mode', labelTr: 'Hikaye', emoji: '📖' },
  game8: { label: 'Crossword', labelTr: 'Bulmaca', emoji: '🧩' },
  game1: { label: 'Picture Match', labelTr: 'Resim Oyunu', emoji: '🖼️' },
  game2: { label: 'Listen & Find', labelTr: 'Dinle & Bul', emoji: '🎧' },
  game3: { label: 'Memory Match', labelTr: 'Hafıza', emoji: '🃏' },
  game4: { label: 'Fill Blank', labelTr: 'Boşluk', emoji: '✍️' },
  game5: { label: 'Scramble', labelTr: 'Karıştır', emoji: '🔤' },
  game6: { label: 'Puzzle', labelTr: 'Yapboz', emoji: '🎯' },
  game7: { label: 'Market', labelTr: 'Market', emoji: '🛒' },
};

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'] as const;

function formatDuration(seconds: number, language: 'en' | 'tr'): string {
  if (seconds < 60) {
    return `${seconds} ${language === 'tr' ? 'sn' : 's'}`;
  }
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}${language === 'tr' ? ' sa ' : 'h '}${mins}${language === 'tr' ? ' dk' : 'm'}`;
  }
  return `${mins} ${language === 'tr' ? 'dk' : 'm'}`;
}

function formatCompactDuration(seconds: number): string {
  if (seconds <= 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hrs > 0) {
    return mins > 0 ? `${hrs}h${mins}m` : `${hrs}h`;
  }
  return `${Math.max(1, Math.floor(seconds / 60))}m`;
}

function StatsModalBody({
  language,
  privacyOpen,
  onOpenPrivacy,
  onClosePrivacy,
}: StatsModalProps & {
  privacyOpen: boolean;
  onOpenPrivacy: () => void;
  onClosePrivacy: () => void;
}) {
  const {
    profile,
    closeStatsModal,
    signOutUser,
    deleteAccount,
    openNicknamePicker,
    requestParentApproval,
  } = useAuth();

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [requiresPasswordReauth, setRequiresPasswordReauth] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');

  const isTr = language === 'tr';
  const stats = profile?.stats;
  const todayKey = getLocalDateString();
  const todayTime = stats?.dailyTimeSeconds?.[todayKey] ?? 0;
  const totalTime = stats?.totalTimeSeconds ?? 0;
  const currentStreak = stats?.currentStreakDays ?? 0;
  const longestStreak = stats?.longestStreakDays ?? 0;
  const totalStories = stats?.totalStoriesPracticed ?? 0;
  const totalScore = stats?.totalScore ?? 0;

  const last7Days = Array.from({ length: 7 }, (_, idx) => {
    const offset = 6 - idx;
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const key = getLocalDateString(d);
    const seconds = stats?.dailyTimeSeconds?.[key] ?? 0;
    const dayIndex = d.getDay();
    return {
      key,
      seconds,
      isToday: offset === 0,
      dayLabel: isTr ? WEEKDAYS_TR[dayIndex] : WEEKDAYS_EN[dayIndex],
    };
  });
  const maxDailySeconds = Math.max(...last7Days.map((d) => d.seconds), 60);

  const modeStats = Object.keys(MODE_META)
    .map((key) => ({
      key,
      meta: MODE_META[key]!,
      time: stats?.timeByModeSeconds?.[key] ?? 0,
      completed: stats?.gamesCompletedByMode?.[key] ?? 0,
    }))
    .filter((m) => m.time > 0 || m.completed > 0)
    .sort((a, b) => b.time - a.time);

  const maxModeTime =
    modeStats.length > 0 ? Math.max(...modeStats.map((m) => m.time), 1) : 1;

  const contextStats = Object.keys(CONTEXT_META)
    .map((key) => ({
      key,
      meta: CONTEXT_META[key]!,
      count: stats?.storiesByContext?.[key] ?? 0,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const handleSignOutPress = () => {
    requestParentApproval(
      () => {
        void signOutUser();
      },
      isTr
        ? 'Çıkış yapmak için ebeveyn doğrulaması gereklidir.'
        : 'Ask a parent to approve signing out.',
    );
  };

  const handleDeleteRequest = () => {
    setDeleteError(null);
    setRequiresPasswordReauth(false);
    setReauthPassword('');
    requestParentApproval(
      () => {
        setConfirmDeleteOpen(true);
      },
      isTr
        ? 'Hesap silme işlemini onaylamak için ebeveyn doğrulaması gereklidir.'
        : 'Parent approval is required before deleting this account.',
    );
  };

  const handleOpenPrivacyPolicy = () => {
    onOpenPrivacy();
  };

  const handleOpenExternalPrivacy = () => {
    requestParentApproval(
      () => {
        void Linking.openURL(PRIVACY_POLICY_URL);
      },
      isTr
        ? 'Gizlilik politikasını tarayıcıda açmak için ebeveyn doğrulaması gereklidir.'
        : 'Ask a parent to open the Privacy Policy.',
    );
  };

  const handleConfirmDelete = async () => {
    if (requiresPasswordReauth && !reauthPassword) {
      setDeleteError(
        isTr
          ? 'Hesap silmeyi onaylamak için lütfen şifrenizi girin.'
          : 'Please enter your password to confirm account deletion.',
      );
      return;
    }

    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(requiresPasswordReauth ? reauthPassword : undefined);
      setConfirmDeleteOpen(false);
      setRequiresPasswordReauth(false);
      setReauthPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (msg.includes('requires-password-reauth')) {
        setRequiresPasswordReauth(true);
        setDeleteError(
          isTr
            ? 'Güvenlik için hesabınızı silmeden önce şifrenizi girin.'
            : 'For security, enter your account password below to confirm deletion.',
        );
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setDeleteError(
          isTr ? 'Şifre hatalı. Lütfen tekrar deneyin.' : 'Incorrect password. Please try again.',
        );
      } else if (msg.includes('requires-recent-login')) {
        setDeleteError(
          isTr
            ? 'Güvenlik için önce çıkış yapıp yeniden giriş yaptıktan sonra hesabınızı silin.'
            : 'For security, please sign out and sign back in right before deleting your account.',
        );
      } else {
        setDeleteError(
          isTr
            ? 'Hesap silinemedi. Lütfen tekrar deneyin.'
            : 'Unable to delete account. Please try again.',
        );
      }
    } finally {
      setDeleting(false);
    }
  };

  const displayName =
    profile?.displayName || (isTr ? 'Minik Kaşif' : 'Kid Explorer');

  if (privacyOpen) {
    return (
      <View style={styles.backdrop}>
        <PrivacyPolicyContent
          language={language}
          backMode
          onClose={onClosePrivacy}
          onOpenExternal={handleOpenExternalPrivacy}
        />
      </View>
    );
  }

  return (
    <View style={styles.backdrop}>
      <View style={styles.card} accessibilityViewIsModal>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isTr ? 'İstatistikleri kapat' : 'Close stats'}
          hitSlop={10}
          onPress={closeStatsModal}
          style={styles.closeBtn}
        >
          <X size={20} color={colors.textDark} />
        </Pressable>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerMeta}>
              <Text style={styles.userName}>{displayName}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isTr ? 'Takma adı değiştir' : 'Change nickname'}
                onPress={openNicknamePicker}
                style={styles.editNickBtn}
              >
                <Edit3 size={14} color={colors.skyDark} />
                <Text style={styles.editNickText}>
                  {isTr ? 'Takma Adı Değiştir' : 'Change Nickname'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, styles.streakCard]}>
              <Flame size={20} color={colors.orange} />
              <Text style={styles.metricTitle}>
                {isTr ? 'Günlük Seri' : 'Day Streak'}
              </Text>
              <Text style={styles.metricValue}>
                {currentStreak} {isTr ? 'gün' : 'days'}
              </Text>
              <Text style={styles.metricSub}>
                {isTr ? `En iyi: ${longestStreak} gün` : `Best: ${longestStreak} days`}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Clock size={20} color={colors.blue} />
              <Text style={styles.metricTitle}>
                {isTr ? 'Bugün' : 'Time Today'}
              </Text>
              <Text style={styles.metricValue}>
                {formatDuration(todayTime, language)}
              </Text>
              <Text style={styles.metricSub}>
                {isTr
                  ? `Toplam: ${formatDuration(totalTime, language)}`
                  : `Lifetime: ${formatDuration(totalTime, language)}`}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <BookOpen size={20} color={colors.green} />
              <Text style={styles.metricTitle}>
                {isTr ? 'Hikayeler' : 'Stories Read'}
              </Text>
              <Text style={styles.metricValue}>{totalStories}</Text>
              <Text style={styles.metricSub}>
                {isTr
                  ? `${contextStats.length} senaryo`
                  : `${contextStats.length} scenarios`}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Trophy size={20} color={colors.amber} />
              <Text style={styles.metricTitle}>
                {isTr ? 'Toplam Puan' : 'Total Score'}
              </Text>
              <Text style={styles.metricValue}>{totalScore} pts</Text>
              <Text style={styles.metricSub}>
                {isTr ? 'Oyun başarıları' : 'Game achievements'}
              </Text>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <CalendarDays size={16} color={colors.navy} />
              <Text style={styles.sectionTitle}>
                {isTr ? 'Son 7 Gün Aktivite' : 'Last 7 Days Activity'}
              </Text>
            </View>
            <View style={styles.chartCard}>
              {last7Days.map((day) => {
                const heightPct =
                  day.seconds > 0
                    ? Math.max(
                        12,
                        Math.min(100, Math.round((day.seconds / maxDailySeconds) * 100)),
                      )
                    : 0;
                return (
                  <View key={day.key} style={styles.chartCol}>
                    <Text style={styles.chartValue}>
                      {formatCompactDuration(day.seconds)}
                    </Text>
                    <View style={styles.chartTrack}>
                      <View
                        style={[
                          styles.chartFill,
                          day.isToday && styles.chartFillToday,
                          { height: `${heightPct}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.chartLabel}>
                      {day.isToday ? (isTr ? 'Bugün' : 'Today') : day.dayLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {contextStats.length > 0 ? (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <Award size={16} color={colors.navy} />
                <Text style={styles.sectionTitle}>
                  {isTr ? 'Hikaye Senaryoları' : 'Story Scenarios'}
                </Text>
              </View>
              <View style={styles.chipsWrap}>
                {contextStats.map((c) => (
                  <View key={c.key} style={styles.contextChip}>
                    <Text>
                      {c.meta.emoji} {isTr ? c.meta.labelTr : c.meta.label} ({c.count})
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {modeStats.length > 0 ? (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <BarChart3 size={16} color={colors.navy} />
                <Text style={styles.sectionTitle}>
                  {isTr ? 'Oyunlara Göre Süre' : 'Time by Activity'}
                </Text>
              </View>
              <View style={styles.modeList}>
                {modeStats.map((m) => {
                  const pct = Math.min(100, Math.round((m.time / maxModeTime) * 100));
                  return (
                    <View key={m.key} style={styles.modeRow}>
                      <Text style={styles.modeLabel}>
                        {m.meta.emoji} {isTr ? m.meta.labelTr : m.meta.label}
                      </Text>
                      <View style={styles.modeTrack}>
                        <View style={[styles.modeFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.modeValue}>
                        {formatDuration(m.time, language)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {confirmDeleteOpen ? (
            <View style={styles.confirmBox}>
              <View style={styles.confirmHeader}>
                <AlertTriangle size={18} color={colors.red} />
                <Text style={styles.confirmTitle}>
                  {isTr ? 'Hesabı Kalıcı Olarak Sil' : 'Permanently Delete Account'}
                </Text>
              </View>
              <Text style={styles.confirmBody}>
                {isTr
                  ? 'Bu işlem girişinizi, puanlarınızı ve liderlik tablosu kaydınızı kalıcı olarak siler. Geri alınamaz.'
                  : 'This permanently removes your login, stats, and leaderboard profile. This cannot be undone.'}
              </Text>
              {requiresPasswordReauth ? (
                <TextInput
                  accessibilityLabel={isTr ? 'Yeniden doğrulama şifresi' : 'Account password for confirmation'}
                  autoComplete="current-password"
                  editable={!deleting}
                  onChangeText={setReauthPassword}
                  onSubmitEditing={() => void handleConfirmDelete()}
                  placeholder={isTr ? 'Şifreniz' : 'Your account password'}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  style={styles.reauthInput}
                  value={reauthPassword}
                />
              ) : null}
              {deleteError ? (
                <Text style={styles.deleteError}>{deleteError}</Text>
              ) : null}
              <View style={styles.confirmActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isTr ? 'Silmeyi iptal et' : 'Cancel account deletion'}
                  disabled={deleting}
                  onPress={() => {
                    setConfirmDeleteOpen(false);
                    setRequiresPasswordReauth(false);
                    setReauthPassword('');
                    setDeleteError(null);
                  }}
                  style={styles.cancelDeleteBtn}
                >
                  <Text style={styles.cancelDeleteText}>
                    {isTr ? 'Vazgeç' : 'Keep Account'}
                  </Text>
                </Pressable>

                <Pressable
                  testID="stats-confirm-delete-btn"
                  accessibilityRole="button"
                  accessibilityLabel={isTr ? 'Hesabı silmeyi onayla' : 'Confirm Delete'}
                  disabled={deleting}
                  onPress={() => void handleConfirmDelete()}
                  style={styles.confirmDeleteBtn}
                >
                  {deleting ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.confirmDeleteText}>
                      {isTr ? 'Kalıcı Sil' : 'Confirm Delete'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.footerActions}>
            <Pressable
              testID="stats-sign-out-btn"
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Çıkış Yap' : 'Sign Out'}
              onPress={handleSignOutPress}
              style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
            >
              <LogOut size={18} color={colors.textDark} />
              <Text style={styles.signOutText}>
                {isTr ? 'Çıkış Yap' : 'Sign Out'}
              </Text>
            </Pressable>

            <Pressable
              testID="stats-delete-account-btn"
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Hesabı Sil' : 'Delete Account'}
              onPress={handleDeleteRequest}
              style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
            >
              <Trash2 size={18} color={colors.red} />
              <Text style={styles.deleteBtnText}>
                {isTr ? 'Hesabı Sil' : 'Delete Account'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Gizlilik Politikası' : 'Privacy Policy'}
              onPress={handleOpenPrivacyPolicy}
              style={({ pressed }) => [styles.privacyBtn, pressed && styles.pressed]}
            >
              <ShieldCheck size={16} color={colors.skyDark} />
              <Text style={styles.privacyBtnText}>
                {isTr ? 'Gizlilik Politikası' : 'Privacy Policy'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

export function StatsModal({ language }: StatsModalProps) {
  const { isStatsModalOpen, closeStatsModal } = useAuth();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [wasOpen, setWasOpen] = useState(isStatsModalOpen);

  if (wasOpen !== isStatsModalOpen) {
    setWasOpen(isStatsModalOpen);
    if (!isStatsModalOpen && privacyOpen) {
      setPrivacyOpen(false);
    }
  }

  const handleRequestClose = () => {
    if (privacyOpen) {
      setPrivacyOpen(false);
      return;
    }
    closeStatsModal();
  };

  return (
    <Modal
      visible={isStatsModalOpen}
      transparent
      animationType="slide"
      onRequestClose={handleRequestClose}
      statusBarTranslucent
    >
      {isStatsModalOpen ? (
        <StatsModalBody
          language={language}
          privacyOpen={privacyOpen}
          onOpenPrivacy={() => setPrivacyOpen(true)}
          onClosePrivacy={() => setPrivacyOpen(false)}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  card: {
    maxHeight: '88%',
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
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
    zIndex: 5,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.xxl,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
  },
  headerMeta: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.navy,
  },
  editNickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  editNickText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.skyDark,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  streakCard: {
    backgroundColor: '#fffbeb',
    borderColor: colors.amberLight,
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.navy,
  },
  metricSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.navy,
  },
  chartCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: '#f8fafc',
    borderRadius: radii.md,
    padding: spacing.md,
    height: 124,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartValue: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  chartTrack: {
    width: 14,
    height: 54,
    borderRadius: 7,
    backgroundColor: '#e2e8f0',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartFill: {
    width: '100%',
    backgroundColor: colors.blue,
    borderRadius: 7,
  },
  chartFillToday: {
    backgroundColor: colors.amber,
  },
  chartLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textDark,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  contextChip: {
    backgroundColor: colors.amberPale,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  modeList: {
    gap: spacing.xs,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modeLabel: {
    width: 112,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textDark,
  },
  modeTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  modeFill: {
    height: '100%',
    backgroundColor: colors.green,
    borderRadius: 4,
  },
  modeValue: {
    width: 52,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'right',
  },
  confirmBox: {
    backgroundColor: '#fef2f2',
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: '#fecaca',
    padding: spacing.md,
    gap: spacing.sm,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.red,
  },
  confirmBody: {
    fontSize: 13,
    color: colors.textDark,
    lineHeight: 18,
  },
  deleteError: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.red,
  },
  reauthInput: {
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: '#fca5a5',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelDeleteBtn: {
    flex: 1,
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelDeleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
  },
  confirmDeleteBtn: {
    flex: 1,
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
  },
  footerActions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  signOutBtn: {
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    backgroundColor: colors.amberPale,
    borderWidth: 2,
    borderColor: colors.amber,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textDark,
  },
  deleteBtn: {
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.red,
  },
  privacyBtn: {
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  privacyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.skyDark,
  },
  pressed: {
    opacity: 0.85,
  },
});
