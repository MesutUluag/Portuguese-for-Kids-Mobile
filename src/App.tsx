import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { ErrorBoundary } from '@/commons/ErrorBoundary';
import { Game1 } from '@/components/Game1';
import { Game2 } from '@/components/Game2';
import { Game3 } from '@/components/Game3';
import { Game4 } from '@/components/Game4';
import { Game5 } from '@/components/Game5';
import { Game6 } from '@/components/Game6';
import { Game7 } from '@/components/Game7';
import { Game8 } from '@/components/Game8';
import { StoryMode, type AppStoryPrefetch } from '@/story/StoryMode';
import { buildStoryImagePrompt, fetchAndCacheStoryImage } from '@/api/image';
import { getNewStoryPage, loadStoredHistory } from '@/api/story';
import type { Mode } from '@/core/data/types';
import { colors, shadows, spacing } from '@/theme/tokens';
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
  const [errorResetNonce, setErrorResetNonce] = useState<number>(0);

  const effectiveMode: Mode = !user && currentMode !== 'cards' ? 'cards' : currentMode;
  const scrollLocked = scrollLockedMode === effectiveMode;
  const handleScrollLockChange = useCallback(
    (locked: boolean) => {
      setScrollLockedMode(locked ? effectiveMode : null);
    },
    [effectiveMode],
  );

  const { musicEnabled, toggleMusic } = useBackgroundMusic();
  const {
    notifyInteraction,
    recordStoryView,
    recordGameScore,
    recordSpeechListen,
    getScoreForMode,
    unsyncedTotalScore,
    getTodayTimeSeconds,
    subscribeTodayTimeSeconds,
    flushNow,
  } = useStatsTracker(effectiveMode);

  const appStoryPrefetchRef = useRef<AppStoryPrefetch | null>(null);
  useEffect(() => {
    if (!user) {
      appStoryPrefetchRef.current = null;
      return;
    }
    if (appStoryPrefetchRef.current !== null) {
      return;
    }

    const storyPromise = loadStoredHistory('school')
      .catch(() => [] as string[])
      .then((storedHistory) =>
        getNewStoryPage('school', undefined, storedHistory),
      )
      .then((res) => res.page);

    const imagePromise = storyPromise
      .then((page) =>
        fetchAndCacheStoryImage(buildStoryImagePrompt(page, 'school')),
      )
      .catch(() => '');

    const replyPromise = storyPromise
      .then((page) =>
        getNewStoryPage('school', page.pt, [page.pt]).then((res) => res.page),
      )
      .catch(() => undefined);

    const replyImagePromise = replyPromise
      .then((reply) => {
        if (!reply) return '';
        return fetchAndCacheStoryImage(buildStoryImagePrompt(reply, 'school'));
      })
      .catch(() => '');

    appStoryPrefetchRef.current = {
      storyPromise,
      imagePromise,
      replyPromise,
      replyImagePromise,
    };
  }, [user]);

  const getAppPrefetch = useCallback(() => appStoryPrefetchRef.current, []);

  const handleResetFromError = useCallback(() => {
    setScrollLockedMode(null);
    setRecentGain(null);
    setCurrentMode('cards');
    setErrorResetNonce((prev) => prev + 1);
  }, []);

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
              testID="header-lang-toggle"
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
              testID="header-music-toggle"
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
            testID="header-leaderboard-btn"
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
              testID="header-profile-btn"
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
              testID="header-sign-in-btn"
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
          const active = effectiveMode === item.mode;
          const locked = item.mode !== 'cards' && !user;
          const label = isTr ? item.labelTr : item.labelEn;
          const IconComponent = item.Icon;
          return (
            <Pressable
              key={item.mode}
              testID={`nav-mode-${item.mode}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              hitSlop={3}
              onPress={() => handleSelectMode(item.mode)}
              style={({ pressed }) => [
                styles.modeBtn,
                {
                  backgroundColor: item.bg,
                  borderColor: active ? colors.white : item.border,
                },
                active && styles.modeBtnActive,
                locked && styles.modeBtnLocked,
                pressed && styles.modeBtnPressed,
              ]}
            >
              {locked ? (
                <Lock size={12} strokeWidth={2.4} color={colors.white} />
              ) : null}
              <IconComponent size={14} strokeWidth={2.2} color={colors.white} />
              <Text maxFontSizeMultiplier={1.25} style={styles.modeBtnText}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  const errorResetKey = `${effectiveMode}-${errorResetNonce}`;

  return (
    <SafeAreaView style={styles.safeArea} onTouchStartCapture={notifyInteraction}>
      <StatusBar style="dark" />
      {effectiveMode === 'cards' ? (
        <ErrorBoundary
          resetKey={errorResetKey}
          language={language}
          uid={user?.uid}
          onResetToCards={handleResetFromError}
        >
          <CardsMode language={language} listHeader={headerContent} />
        </ErrorBoundary>
      ) : (
        <ScrollView
          scrollEnabled={!scrollLocked}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {headerContent}

          <ErrorBoundary
            resetKey={errorResetKey}
            language={language}
            uid={user?.uid}
            onResetToCards={handleResetFromError}
          >
            {effectiveMode === 'game1' ? (
              <Game1
                language={language}
                score={getScoreForMode('game1')}
                recentGain={recentGain}
                gainKey={gainKey}
                onScore={(pts) => handleGameScore('game1', pts)}
              />
            ) : effectiveMode === 'game2' ? (
              <Game2
                language={language}
                score={getScoreForMode('game2')}
                recentGain={recentGain}
                gainKey={gainKey}
                onScore={(pts) => handleGameScore('game2', pts)}
              />
            ) : effectiveMode === 'game3' ? (
              <Game3
                language={language}
                score={getScoreForMode('game3')}
                recentGain={recentGain}
                gainKey={gainKey}
                onScore={(pts) => handleGameScore('game3', pts)}
              />
            ) : effectiveMode === 'game4' ? (
              <Game4
                language={language}
                score={getScoreForMode('game4')}
                recentGain={recentGain}
                gainKey={gainKey}
                onScore={(pts) => handleGameScore('game4', pts)}
              />
            ) : effectiveMode === 'game5' ? (
              <Game5
                language={language}
                score={getScoreForMode('game5')}
                recentGain={recentGain}
                gainKey={gainKey}
                onScore={(pts) => handleGameScore('game5', pts)}
              />
            ) : effectiveMode === 'game6' ? (
              <Game6
                language={language}
                score={getScoreForMode('game6')}
                recentGain={recentGain}
                gainKey={gainKey}
                onScore={(pts) => handleGameScore('game6', pts)}
                onInteractionLockChange={handleScrollLockChange}
              />
            ) : effectiveMode === 'game7' ? (
              <Game7
                language={language}
                score={getScoreForMode('game7')}
                recentGain={recentGain}
                gainKey={gainKey}
                onScore={(pts) => handleGameScore('game7', pts)}
                onInteractionLockChange={handleScrollLockChange}
              />
            ) : effectiveMode === 'game8' ? (
              <Game8
                language={language}
                score={getScoreForMode('game8')}
                recentGain={recentGain}
                gainKey={gainKey}
                onScore={(pts) => handleGameScore('game8', pts)}
              />
            ) : (
              <StoryMode
                language={language}
                getAppPrefetch={getAppPrefetch}
                onStoryPracticed={recordStoryView}
                onSpeechListen={recordSpeechListen}
              />
            )}
          </ErrorBoundary>
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
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: 10,
  },
  topBar: {
    gap: 8,
  },
  appHeaderRow: {
    width: '100%',
    minHeight: 38,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#d97706',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 84,
    textShadowColor: colors.amberLight,
    textShadowOffset: { width: 1.5, height: 1.5 },
    textShadowRadius: 0,
  },
  headerControls: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerUtilityBtn: {
    minHeight: 30,
    paddingHorizontal: 8,
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
    minWidth: 30,
    paddingHorizontal: 7,
  },
  langToggleText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#92400e',
  },
  topStatsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
  },
  timeBadge: {
    minHeight: 34,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.amber,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    ...shadows.sm,
  },
  timeBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  rankPill: {
    minHeight: 34,
    paddingHorizontal: 11,
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
    fontSize: 13,
    fontWeight: '800',
    color: '#d97706',
  },
  rankDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#fde68a',
  },
  rankLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#78350f',
  },
  profilePill: {
    minHeight: 34,
    paddingHorizontal: 11,
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
    fontSize: 13,
    fontWeight: '800',
    color: '#ea580c',
  },
  profileDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#fed7aa',
  },
  profileNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#431407',
    flexShrink: 1,
  },
  authPromptPill: {
    minHeight: 34,
    paddingHorizontal: 12,
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
    fontSize: 13,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  modeNav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  modeBtn: {
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 2.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...shadows.sm,
  },
  modeBtnActive: {
    transform: [{ scale: 1.06 }],
    ...shadows.md,
  },
  modeBtnLocked: {
    opacity: 0.92,
  },
  modeBtnPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  modeBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
