import React, { useCallback, useEffect, useState } from 'react';
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
import {
  BookOpen,
  Flame,
  Globe,
  Grid3x3,
  Headphones,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Lock,
  LogIn,
  PencilLine,
  Puzzle,
  ShoppingCart,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useBackgroundMusic } from '@/audio/backgroundMusic';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { AuthModalsHost } from '@/auth/AuthModalsHost';
import { useStatsTracker } from '@/auth/useStatsTracker';
import { CardsMode } from '@/components/CardsMode';
import { Game1 } from '@/components/Game1';
import { Game2 } from '@/components/Game2';
import { Game3 } from '@/components/Game3';
import { Game4 } from '@/components/Game4';
import { Game5 } from '@/components/Game5';
import { Game6 } from '@/components/Game6';
import { Game7 } from '@/components/Game7';
import { Game8 } from '@/components/Game8';
import { IS_DEV } from '@/config';
import type { Mode } from '@/core/data/types';
import { colors, radii, shadows, spacing, touchTargets } from '@/theme/tokens';
import { getJSON, setJSON, STORAGE_KEYS } from '@/utils/storage';

type Language = 'en' | 'tr';

function formatStudyTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) {
    return `${s}s`;
  }
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const remSecs = s % 60;

  let result = '';
  if (hrs > 0) result += `${hrs}h `;
  if (mins > 0 || hrs > 0) result += `${mins}m `;
  result += `${remSecs}s`;
  return result;
}

interface StudyTimeBadgeProps {
  isTr: boolean;
  getTodayTimeSeconds: () => number;
  subscribeTodayTimeSeconds: (listener: (seconds: number) => void) => () => void;
}

const StudyTimeBadge = React.memo(function StudyTimeBadge({
  isTr,
  getTodayTimeSeconds,
  subscribeTodayTimeSeconds,
}: StudyTimeBadgeProps) {
  const [seconds, setSeconds] = useState<number>(() => getTodayTimeSeconds());

  useEffect(() => {
    return subscribeTodayTimeSeconds(setSeconds);
  }, [subscribeTodayTimeSeconds]);

  return (
    <View style={styles.timeBadge}>
      <Timer size={14} strokeWidth={2.2} color={colors.white} />
      <Text style={styles.timeBadgeText} maxFontSizeMultiplier={1.2}>
        {isTr ? 'Bugün' : 'Time Today'}: {formatStudyTime(seconds)}
      </Text>
    </View>
  );
});

type NavModeItem = {
  mode: Mode;
  labelEn: string;
  labelTr: string;
  bg: string;
  border: string;
  Icon: LucideIcon;
};

const NAV_MODES: readonly NavModeItem[] = [
  { mode: 'cards', labelEn: 'Cards', labelTr: 'Kartlar', bg: colors.amber, border: colors.amberPale, Icon: LayoutGrid },
  { mode: 'story', labelEn: 'Story', labelTr: 'Hikaye', bg: colors.cyan, border: colors.cyanLight, Icon: BookOpen },
  { mode: 'game8', labelEn: 'Crossword', labelTr: 'Çengel Bulmaca', bg: '#059669', border: colors.greenLight, Icon: Grid3x3 },
  { mode: 'game1', labelEn: 'Picture Game', labelTr: 'Resim Oyunu', bg: colors.green, border: colors.greenLight, Icon: ImageIcon },
  { mode: 'game2', labelEn: 'Listen & Find', labelTr: 'Dinle & Bul', bg: colors.pink, border: colors.pinkLight, Icon: Headphones },
  { mode: 'game3', labelEn: 'Memory Match', labelTr: 'Hafıza Oyunu', bg: colors.purple, border: colors.purpleLight, Icon: Layers },
  { mode: 'game4', labelEn: 'Fill Blank', labelTr: 'Boşluk Doldurma', bg: colors.blue, border: colors.blueLight, Icon: PencilLine },
  { mode: 'game5', labelEn: 'Scramble', labelTr: 'Kelime Bul', bg: colors.orange, border: colors.orangeLight, Icon: Puzzle },
  { mode: 'game6', labelEn: 'Puzzle', labelTr: 'Yapboz', bg: colors.rose, border: colors.pinkLight, Icon: Puzzle },
  { mode: 'game7', labelEn: 'Market', labelTr: 'Market Oyunu', bg: colors.sky, border: colors.skyDark, Icon: ShoppingCart },
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
  const [recentGain, setRecentGain] = useState<number | null>(null);
  const [gainKey, setGainKey] = useState<number>(0);
  const [scrollLockedMode, setScrollLockedMode] = useState<Mode | null>(null);

  const scrollLocked = scrollLockedMode === currentMode;
  const handleScrollLockChange = useCallback(
    (locked: boolean) => {
      setScrollLockedMode(locked ? currentMode : null);
    },
    [currentMode],
  );

  const { musicEnabled, toggleMusic } = useBackgroundMusic();
  const {
    notifyInteraction,
    recordGameScore,
    getScoreForMode,
    unsyncedTotalScore,
    getTodayTimeSeconds,
    subscribeTodayTimeSeconds,
    flushNow,
  } = useStatsTracker(currentMode);

  const handleGameScore = useCallback(
    (mode: Mode, points: number) => {
      if (points <= 0) return;
      setRecentGain(points);
      setGainKey((k) => k + 1);
      recordGameScore(mode, points);
    },
    [recordGameScore],
  );

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
        setRecentGain(null);
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
  const activeNavMode = NAV_MODES.find((item) => item.mode === currentMode);
  const activeModeTitle = activeNavMode
    ? isTr
      ? activeNavMode.labelTr
      : activeNavMode.labelEn
    : currentMode.toUpperCase();
  const totalScore = (profile?.stats?.totalScore ?? 0) + unsyncedTotalScore;
  const streakCount = profile?.stats?.currentStreakDays ?? 0;
  const profileFirstName = profile?.displayName
    ? profile.displayName.split(' ')[0] ?? (isTr ? 'Profil' : 'Profile')
    : isTr
      ? 'Profil'
      : 'Profile';

  const handleSelectMode = (mode: Mode) => {
    if (mode !== 'cards' && !user) {
      openAuthModal(
        isTr
          ? 'Oyunlar ve Hikaye Modu için bir ebeveyn girişi gereklidir.'
          : 'A parent sign-in is required to play games and save scores.',
      );
      return;
    }
    if (mode !== currentMode) {
      setRecentGain(null);
    }
    setCurrentMode(mode);
  };

  const headerContent = (
    <>
      <View style={styles.topBar}>
        <View style={styles.appHeaderRow}>
          <Text style={styles.brandTitle} maxFontSizeMultiplier={1.25}>
            {isTr ? 'Portekizce Çocuk Oyun Alanı' : 'Portuguese Kids Playground'}
          </Text>
          <View style={styles.headerControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isTr ? 'İngilizceye geç' : 'Switch to Turkish'
              }
              onPress={toggleLanguage}
              hitSlop={6}
              style={({ pressed }) => [styles.headerUtilityBtn, pressed && styles.pressed]}
            >
              <Globe size={14} strokeWidth={2} color="#92400e" />
              <Text style={styles.langToggleText} maxFontSizeMultiplier={1.2}>
                {isTr ? 'EN' : 'TR'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                musicEnabled
                  ? isTr
                    ? 'Müziği kapat'
                    : 'Stop music'
                  : isTr
                    ? 'Müziği aç'
                    : 'Play music'
              }
              onPress={toggleMusic}
              hitSlop={6}
              style={({ pressed }) => [
                styles.headerUtilityBtn,
                styles.soundToggleBtn,
                pressed && styles.pressed,
              ]}
            >
              {musicEnabled ? (
                <Volume2 size={15} strokeWidth={2.2} color="#92400e" />
              ) : (
                <VolumeX size={15} strokeWidth={2.2} color="#92400e" />
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.topStatsBar}>
          <StudyTimeBadge
            isTr={isTr}
            getTodayTimeSeconds={getTodayTimeSeconds}
            subscribeTodayTimeSeconds={subscribeTodayTimeSeconds}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isTr ? 'Liderlik Tablosu & Puanlar' : 'Leaderboard & Scores'
            }
            onPress={openLeaderboardModal}
            hitSlop={4}
            style={({ pressed }) => [styles.rankPill, pressed && styles.pressed]}
          >
            <Trophy size={14} strokeWidth={2.4} color="#d97706" />
            <Text style={styles.rankScoreText} maxFontSizeMultiplier={1.2}>
              {totalScore}
            </Text>
            <View style={styles.rankDivider} />
            <Text style={styles.rankLabelText} maxFontSizeMultiplier={1.2}>
              {isTr ? 'Sıralama' : 'Ranks'}
            </Text>
          </Pressable>

          {user ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isTr ? 'Profil ve İstatistikler' : 'Profile & Stats'
              }
              onPress={openStatsModal}
              hitSlop={4}
              style={({ pressed }) => [styles.profilePill, pressed && styles.pressed]}
            >
              <Flame size={14} strokeWidth={2.4} color="#ea580c" />
              <Text style={styles.streakText} maxFontSizeMultiplier={1.2}>
                {streakCount}
              </Text>
              <View style={styles.profileDivider} />
              <Text
                style={styles.profileNameText}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
              >
                {profileFirstName}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Giriş Yap' : 'Sign In'}
              onPress={() => openAuthModal()}
              hitSlop={4}
              style={({ pressed }) => [styles.authPromptPill, pressed && styles.pressed]}
            >
              <LogIn size={14} strokeWidth={2.2} color="#1d4ed8" />
              <Text style={styles.authPromptText} maxFontSizeMultiplier={1.2}>
                {isTr ? 'Giriş Yap' : 'Sign In'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.modeNav}>
        {NAV_MODES.map((item) => {
          const active = currentMode === item.mode;
          const locked = item.mode !== 'cards' && !user;
          const label = isTr ? item.labelTr : item.labelEn;
          const IconComponent = item.Icon;
          return (
            <View
              key={item.mode}
              style={[
                styles.modeBtnRing,
                active && {
                  borderColor: item.bg,
                  transform: [{ scale: 1.05 }],
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
                onPress={() => handleSelectMode(item.mode)}
                style={({ pressed }) => [
                  styles.modeBtn,
                  {
                    backgroundColor: item.bg,
                    borderColor: active ? colors.white : item.border,
                  },
                  locked && styles.modeBtnLocked,
                  pressed && styles.modeBtnPressed,
                ]}
              >
                {locked ? (
                  <Lock size={13} strokeWidth={2.4} color={colors.white} />
                ) : null}
                <IconComponent size={17} strokeWidth={2.2} color={colors.white} />
                <Text maxFontSizeMultiplier={1.25} style={styles.modeBtnText}>
                  {label}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} onTouchStartCapture={notifyInteraction}>
      <StatusBar style="dark" />
      {currentMode === 'cards' ? (
        <CardsMode language={language} listHeader={headerContent} />
      ) : (
        <ScrollView
          scrollEnabled={!scrollLocked}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {headerContent}

          {currentMode === 'game1' ? (
            <Game1
              language={language}
              score={getScoreForMode('game1')}
              recentGain={recentGain}
              gainKey={gainKey}
              onScore={(pts) => handleGameScore('game1', pts)}
            />
          ) : currentMode === 'game2' ? (
            <Game2
              language={language}
              score={getScoreForMode('game2')}
              recentGain={recentGain}
              gainKey={gainKey}
              onScore={(pts) => handleGameScore('game2', pts)}
            />
          ) : currentMode === 'game3' ? (
            <Game3
              language={language}
              score={getScoreForMode('game3')}
              recentGain={recentGain}
              gainKey={gainKey}
              onScore={(pts) => handleGameScore('game3', pts)}
            />
          ) : currentMode === 'game4' ? (
            <Game4
              language={language}
              score={getScoreForMode('game4')}
              recentGain={recentGain}
              gainKey={gainKey}
              onScore={(pts) => handleGameScore('game4', pts)}
            />
          ) : currentMode === 'game5' ? (
            <Game5
              language={language}
              score={getScoreForMode('game5')}
              recentGain={recentGain}
              gainKey={gainKey}
              onScore={(pts) => handleGameScore('game5', pts)}
            />
          ) : currentMode === 'game6' ? (
            <Game6
              language={language}
              score={getScoreForMode('game6')}
              recentGain={recentGain}
              gainKey={gainKey}
              onScore={(pts) => handleGameScore('game6', pts)}
              onInteractionLockChange={handleScrollLockChange}
            />
          ) : currentMode === 'game7' ? (
            <Game7
              language={language}
              score={getScoreForMode('game7')}
              recentGain={recentGain}
              gainKey={gainKey}
              onScore={(pts) => handleGameScore('game7', pts)}
              onInteractionLockChange={handleScrollLockChange}
            />
          ) : currentMode === 'game8' ? (
            <Game8
              language={language}
              score={getScoreForMode('game8')}
              recentGain={recentGain}
              gainKey={gainKey}
              onScore={(pts) => handleGameScore('game8', pts)}
            />
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {`${activeModeTitle} — ${isTr ? 'Oturum Açık' : 'Signed In'}`}
              </Text>
              <Text style={styles.cardDesc}>
                {isTr
                  ? 'Bu oyun/hikaye ekranı sıradaki fazda eklenecek. Bu oturum aktif telemetri senkronizasyonunu doğrulayabilir.'
                  : 'This Game/Story UI arrives in its dedicated phase. Your active session and telemetry sync are live here.'}
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
          )}
        </ScrollView>
      )}

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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  topBar: {
    gap: 10,
  },
  appHeaderRow: {
    width: '100%',
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  brandTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    color: '#d97706',
    textAlign: 'center',
    lineHeight: 24,
    paddingLeft: 44,
    textShadowColor: colors.amberLight,
    textShadowOffset: { width: 1.5, height: 1.5 },
    textShadowRadius: 0,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  headerUtilityBtn: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#d97706',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...shadows.sm,
  },
  soundToggleBtn: {
    minWidth: 34,
    paddingHorizontal: 8,
  },
  langToggleText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#92400e',
  },
  topStatsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  timeBadge: {
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.amber,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    ...shadows.sm,
  },
  timeBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  rankPill: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: '#fde68a',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...shadows.sm,
  },
  rankScoreText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#d97706',
  },
  rankDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#fde68a',
  },
  rankLabelText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#78350f',
  },
  profilePill: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 185,
    ...shadows.sm,
  },
  streakText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ea580c',
  },
  profileDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#fed7aa',
  },
  profileNameText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#431407',
    flexShrink: 1,
  },
  authPromptPill: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    ...shadows.sm,
  },
  authPromptText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  modeNav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
  },
  modeBtnRing: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeBtn: {
    minHeight: 44,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...shadows.sm,
  },
  modeBtnLocked: {
    opacity: 0.92,
  },
  modeBtnPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  modeBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
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
