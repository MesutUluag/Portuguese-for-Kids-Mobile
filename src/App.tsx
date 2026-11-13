import React, { useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Globe, Lock, LogIn, Trophy, UserCheck } from 'lucide-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { AuthModalsHost } from '@/auth/AuthModalsHost';
import { useStatsTracker } from '@/auth/useStatsTracker';
import { IS_DEV } from '@/config';
import { kidsWords } from '@/core/data/index';
import type { Mode } from '@/core/data/types';
import { colors, radii, shadows, spacing, touchTargets } from '@/theme/tokens';
import { getJSON, setJSON, STORAGE_KEYS } from '@/utils/storage';

type Language = 'en' | 'tr';

const GATED_MODES: readonly { mode: Mode; labelEn: string; labelTr: string; emoji: string }[] = [
  { mode: 'story', labelEn: 'Story', labelTr: 'Hikaye', emoji: '📖' },
  { mode: 'game1', labelEn: 'Picture', labelTr: 'Resim', emoji: '🖼️' },
  { mode: 'game6', labelEn: 'Jigsaw', labelTr: 'Yapboz', emoji: '🧩' },
  { mode: 'game7', labelEn: 'Market', labelTr: 'Market', emoji: '🛒' },
];

function AppShell() {
  const {
    user,
    profile,
    isAuthModalOpen,
    isStatsModalOpen,
    isLeaderboardModalOpen,
    isNicknamePickerOpen,
    needsNickname,
    parentalGateRequest,
    closeParentalGate,
    closeNicknamePicker,
    closeAuthModal,
    closeStatsModal,
    closeLeaderboardModal,
    openAuthModal,
    openStatsModal,
    openLeaderboardModal,
  } = useAuth();

  const [language, setLanguage] = useState<Language>('en');
  const [currentMode, setCurrentMode] = useState<Mode>('cards');

  const { notifyInteraction, recordGameScore, flushNow } =
    useStatsTracker(currentMode);

  useEffect(() => {
    void getJSON<Language>(
      STORAGE_KEYS.LANGUAGE,
      (v): v is Language => v === 'en' || v === 'tr',
    ).then((saved) => {
      if (saved) setLanguage(saved);
    });
  }, []);

  const toggleLanguage = () => {
    const next: Language = language === 'en' ? 'tr' : 'en';
    setLanguage(next);
    void setJSON(STORAGE_KEYS.LANGUAGE, next);
  };

  // Android hardware back handler: modals -> return to 'cards' -> confirm exit
  useEffect(() => {
    const onBackPress = () => {
      if (parentalGateRequest) {
        closeParentalGate();
        return true;
      }
      if (isNicknamePickerOpen) {
        if (!needsNickname) {
          closeNicknamePicker();
        }
        return true;
      }
      if (isAuthModalOpen) {
        closeAuthModal();
        return true;
      }
      if (isStatsModalOpen) {
        closeStatsModal();
        return true;
      }
      if (isLeaderboardModalOpen) {
        closeLeaderboardModal();
        return true;
      }
      if (currentMode !== 'cards') {
        setCurrentMode('cards');
        return true;
      }

      const isTr = language === 'tr';
      Alert.alert(
        isTr ? 'Uygulamadan Çık' : 'Exit App',
        isTr
          ? 'Portuguese for Kids uygulamasından çıkmak istiyor musunuz?'
          : 'Do you want to exit Portuguese for Kids?',
        [
          { text: isTr ? 'Hayır' : 'Stay', style: 'cancel' },
          {
            text: isTr ? 'Çık' : 'Exit',
            onPress: () => {
              void flushNow();
              BackHandler.exitApp();
            },
          },
        ],
      );
      return true;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    );
    return () => subscription.remove();
  }, [
    closeAuthModal,
    closeLeaderboardModal,
    closeNicknamePicker,
    closeParentalGate,
    closeStatsModal,
    currentMode,
    flushNow,
    isAuthModalOpen,
    isLeaderboardModalOpen,
    isNicknamePickerOpen,
    isStatsModalOpen,
    language,
    needsNickname,
    parentalGateRequest,
  ]);

  const isTr = language === 'tr';
  const activeGatedMode = GATED_MODES.find((item) => item.mode === currentMode);
  const activeModeTitle = activeGatedMode
    ? isTr
      ? activeGatedMode.labelTr
      : activeGatedMode.labelEn
    : currentMode.toUpperCase();
  const totalScore = profile?.stats?.totalScore ?? 0;
  const profileLabel = user
    ? profile?.displayName || (isTr ? 'Profil' : 'Profile')
    : isTr
      ? 'Giriş Yap'
      : 'Sign In';

  const handleSelectMode = (mode: Mode) => {
    if (mode !== 'cards' && !user) {
      openAuthModal(
        isTr
          ? 'Oyunlar ve Hikaye Modu için bir ebeveyn girişi gereklidir.'
          : 'A parent sign-in is required to play games and save scores.',
      );
      return;
    }
    setCurrentMode(mode);
  };

  return (
    <SafeAreaView style={styles.safeArea} onTouchStartCapture={notifyInteraction}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.brandBlock}>
            <Text style={styles.brandTitle}>🇵🇹 Portuguese for Kids</Text>
            <Text style={styles.brandSub}>
              {isTr
                ? `${kidsWords.length} kelime hazır`
                : `${kidsWords.length} vocabulary words ready`}
            </Text>
          </View>

          <View style={styles.topActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isTr ? 'Dili İngilizceye çevir' : 'Switch language to Turkish'
              }
              onPress={toggleLanguage}
              style={({ pressed }) => [styles.pillBtn, pressed && styles.pressed]}
            >
              <Globe size={16} color={colors.navy} />
              <Text style={styles.pillText}>{language.toUpperCase()}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Liderlik tablosunu aç' : 'Open leaderboard'}
              onPress={openLeaderboardModal}
              style={({ pressed }) => [styles.rankPill, pressed && styles.pressed]}
            >
              <Trophy size={16} color={colors.navy} />
              <Text style={styles.pillText}>{totalScore}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                user
                  ? isTr
                    ? 'Profil ve istatistikleri aç'
                    : 'Open profile and stats'
                  : isTr
                    ? 'Ebeveyn girişi aç'
                    : 'Open parent sign in'
              }
              onPress={() => {
                if (user) {
                  openStatsModal();
                } else {
                  openAuthModal();
                }
              }}
              style={({ pressed }) => [
                styles.authPill,
                user && styles.authPillSignedIn,
                pressed && styles.pressed,
              ]}
            >
              {user ? (
                <UserCheck size={16} color={colors.white} />
              ) : (
                <LogIn size={16} color={colors.white} />
              )}
              <Text style={styles.authPillText} numberOfLines={1}>
                {profileLabel}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.modeNav}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: currentMode === 'cards' }}
            accessibilityLabel={isTr ? 'Kartlar' : 'Flashcards'}
            onPress={() => handleSelectMode('cards')}
            style={[
              styles.modeBtn,
              currentMode === 'cards' && styles.modeBtnActive,
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              style={[
                styles.modeBtnText,
                currentMode === 'cards' && styles.modeBtnTextActive,
              ]}
            >
              📇 {isTr ? 'Kartlar' : 'Cards'}
            </Text>
          </Pressable>

          {GATED_MODES.map((item) => {
            const active = currentMode === item.mode;
            return (
              <Pressable
                key={item.mode}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={isTr ? item.labelTr : item.labelEn}
                onPress={() => handleSelectMode(item.mode)}
                style={[styles.modeBtn, active && styles.modeBtnActive]}
              >
                {!user ? <Lock size={13} color={colors.textMuted} /> : null}
                <Text
                  maxFontSizeMultiplier={1.3}
                  style={[
                    styles.modeBtnText,
                    active && styles.modeBtnTextActive,
                  ]}
                >
                  {item.emoji} {isTr ? item.labelTr : item.labelEn}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {currentMode === 'cards'
              ? isTr
                ? 'Kartlar Modu (Misafirlere Açık)'
                : 'Flashcards Mode (Guest Open)'
              : `${activeModeTitle} — ${isTr ? 'Oturum Açık' : 'Signed In'}`}
          </Text>
          <Text style={styles.cardDesc}>
            {currentMode === 'cards'
              ? isTr
                ? `${kidsWords.length} Avrupa Portekizcesi kelimesi senkronize edildi. Kartlar, hikayeler ve oyun ekranları Sonraki Fazlarda (Faz 2–4) eklenecek.`
                : `${kidsWords.length} European Portuguese words are synced locally. Full Cards, Story, and Game screens roll out in Phases 2–4.`
              : isTr
                ? 'Oyun ve Hikaye ekranları Faz 2–4 aşamasında eklenecek. Bu oturum aktif telemetri senkronizasyonunu doğrulayabilir.'
                : 'Full Game & Story UI arrives in Phases 2–4. Your active session and telemetry sync are live here.'}
          </Text>

          {user ? (
            <View style={styles.telemetryPreview}>
              <Text style={styles.telemetryLabel}>
                {isTr
                  ? `Aktif Kaşif: ${profile?.displayName ?? 'Yükleniyor...'} • Seri: ${profile?.stats.currentStreakDays ?? 1} gün`
                  : `Explorer: ${profile?.displayName ?? 'Loading...'} • Streak: ${profile?.stats.currentStreakDays ?? 1}d`}
              </Text>
              {IS_DEV ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isTr ? 'Örnek oyun puanı ekle ve senkronize et' : 'Test telemetry score sync'
                  }
                  onPress={() => {
                    recordGameScore('game1', 5);
                  }}
                  style={({ pressed }) => [
                    styles.syncTestBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.syncTestText}>
                    {isTr ? '+5 Test Puanı Senkronize Et' : '+5 Test Telemetry Sync'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <AuthModalsHost language={language} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  topBar: {
    gap: spacing.sm,
  },
  brandBlock: {
    gap: 2,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.navy,
  },
  brandSub: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  topActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pillBtn: {
    minHeight: touchTargets.nav,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.blueLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rankPill: {
    minHeight: touchTargets.nav,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.amberPale,
    borderWidth: 2,
    borderColor: colors.amber,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authPill: {
    minHeight: touchTargets.nav,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 180,
  },
  authPillSignedIn: {
    backgroundColor: colors.green,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.navy,
  },
  authPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
  },
  modeNav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modeBtn: {
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.blueLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeBtnActive: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.navy,
  },
  modeBtnTextActive: {
    color: colors.white,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.amberLight,
    ...shadows.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.navy,
  },
  cardDesc: {
    fontSize: 14,
    color: colors.textDark,
    lineHeight: 20,
  },
  telemetryPreview: {
    backgroundColor: '#f8fafc',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  telemetryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.skyDark,
  },
  syncTestBtn: {
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  syncTestText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
