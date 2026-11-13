import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Award, Gamepad2, RefreshCw, Sparkles, Trophy, X } from 'lucide-react-native';
import { fetchWithAuth } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import {
  isLeaderboardResponse,
  type LeaderboardEntry,
  type LeaderboardResponse,
} from '@/auth/types';
import type { Mode } from '@/core/data/types';
import { colors, radii, shadows, spacing, touchTargets } from '@/theme/tokens';

export interface LeaderboardModalProps {
  language: 'en' | 'tr';
}

interface GameMeta {
  mode: Mode;
  nameEn: string;
  nameTr: string;
  emoji: string;
  level: 1 | 2 | 3;
  ptsEn: string;
  ptsTr: string;
}

const ALL_GAMES: GameMeta[] = [
  { mode: 'game1', nameEn: 'Picture Match', nameTr: 'Resim Oyunu', emoji: '🖼️', level: 1, ptsEn: '4–6 pts', ptsTr: '4–6 puan' },
  { mode: 'game2', nameEn: 'Listen & Find', nameTr: 'Dinle & Bul', emoji: '🎧', level: 1, ptsEn: '5–7 pts', ptsTr: '5–7 puan' },
  { mode: 'game4', nameEn: 'Fill in the Blank', nameTr: 'Boşluk Doldur', emoji: '✍️', level: 1, ptsEn: '5–7 pts', ptsTr: '5–7 puan' },
  { mode: 'game7', nameEn: 'Market Game', nameTr: 'Market Oyunu', emoji: '🛒', level: 1, ptsEn: '5–7 pts', ptsTr: '5–7 puan' },
  { mode: 'game3', nameEn: 'Memory Match', nameTr: 'Hafıza Oyunu', emoji: '🃏', level: 2, ptsEn: '20–25 pts', ptsTr: '20–25 puan' },
  { mode: 'game5', nameEn: 'Word Scramble', nameTr: 'Kelime Karıştır', emoji: '🔤', level: 2, ptsEn: '13–17 pts', ptsTr: '13–17 puan' },
  { mode: 'game6', nameEn: 'Word Puzzle', nameTr: 'Kelime Yapbozu', emoji: '🧩', level: 3, ptsEn: '30 pts', ptsTr: '30 puan' },
  { mode: 'game8', nameEn: 'Crossword Puzzle', nameTr: 'Çengel Bulmaca', emoji: '✏️', level: 3, ptsEn: '10/word + 25', ptsTr: '10/kelime + 25' },
];

const AVATAR_COLORS = [
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#06b6d4',
] as const;

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? '#3b82f6';
}

function LeaderboardModalBody({ language }: LeaderboardModalProps) {
  const { user, profile, closeLeaderboardModal } = useAuth();
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'my-scores'>(
    'leaderboard',
  );
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [offlineFallback, setOfflineFallback] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const isTr = language === 'tr';

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setOfflineFallback(false);
    setRefreshTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetchWithAuth<LeaderboardResponse>('/user/leaderboard', {
          validate: isLeaderboardResponse,
        });
        if (!cancelled) {
          setData(response);
          setOfflineFallback(false);
        }
      } catch (err) {
        console.warn('[leaderboard] Failed to load remote leaderboard:', err);
        if (!cancelled) {
          setOfflineFallback(true);
          setData({
            topUsers: [],
            currentUser: null,
            totalUsersCount: 0,
            lastUpdated: Date.now(),
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const currentScoreByMode =
    profile?.stats?.scoreByMode ?? data?.currentUser?.scoreByMode ?? {};
  const currentTotalScore =
    profile?.stats?.totalScore ?? data?.currentUser?.totalScore ?? 0;

  const currentDisplayName =
    profile?.displayName ||
    data?.currentUser?.displayName ||
    (isTr ? 'Ben' : 'Explorer');

  const currentEntry: LeaderboardEntry = data?.currentUser ?? {
    rank: 1,
    displayName: currentDisplayName,
    avatarInitial: (currentDisplayName[0] || 'E').toUpperCase(),
    totalScore: currentTotalScore,
    scoreByMode: currentScoreByMode,
    gamesCompleted: Object.values(
      profile?.stats?.gamesCompletedByMode ?? {},
    ).reduce((a, b) => a + b, 0),
    isCurrentUser: true,
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.card} accessibilityViewIsModal>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isTr ? 'Liderlik tablosunu kapat' : 'Close leaderboard'}
          hitSlop={10}
          onPress={closeLeaderboardModal}
          style={styles.closeBtn}
        >
          <X size={20} color={colors.textDark} />
        </Pressable>

        <View style={styles.headerRow}>
          <View style={styles.trophyWrap}>
            <Trophy size={26} color={colors.amber} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              {isTr ? 'Liderlik Tablosu' : 'Leaderboard'}
            </Text>
            <Text style={styles.subtitle}>
              {isTr
                ? 'Tüm oyun puanları ve en iyi kaşifler'
                : 'All game scores & top explorers'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Yenile' : 'Refresh leaderboard'}
            disabled={loading}
            onPress={handleRefresh}
            style={styles.refreshBtn}
          >
            <RefreshCw size={18} color={colors.navy} />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: getAvatarColor(currentEntry.displayName) },
              ]}
            >
              <Text style={styles.avatarText}>{currentEntry.avatarInitial}</Text>
            </View>
            <View style={styles.heroMeta}>
              <Text style={styles.heroName}>{currentEntry.displayName}</Text>
              <Text style={styles.heroGames}>
                <Gamepad2 size={12} color={colors.textMuted} />{' '}
                {currentEntry.gamesCompleted}{' '}
                {isTr ? 'oyun tamamlandı' : 'games completed'}
              </Text>
            </View>
            <View style={styles.heroScoreBadge}>
              <Text style={styles.heroScoreLabel}>
                {user ? `#${currentEntry.rank}` : isTr ? 'Misafir' : 'Guest'}
              </Text>
              <Text style={styles.heroScoreVal}>⭐ {currentTotalScore}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabsRow}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'leaderboard' }}
            accessibilityLabel={isTr ? 'Genel Sıralama' : 'Global Ranking'}
            onPress={() => setActiveTab('leaderboard')}
            style={[
              styles.tabBtn,
              activeTab === 'leaderboard' && styles.tabBtnActive,
            ]}
          >
            <Trophy
              size={16}
              color={activeTab === 'leaderboard' ? colors.white : colors.navy}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'leaderboard' && styles.tabTextActive,
              ]}
            >
              {isTr ? 'Genel Sıralama' : 'Global Ranking'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'my-scores' }}
            accessibilityLabel={isTr ? 'Oyun Puanlarım' : 'My Game Scores'}
            onPress={() => setActiveTab('my-scores')}
            style={[
              styles.tabBtn,
              activeTab === 'my-scores' && styles.tabBtnActive,
            ]}
          >
            <Award
              size={16}
              color={activeTab === 'my-scores' ? colors.white : colors.navy}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'my-scores' && styles.tabTextActive,
              ]}
            >
              {isTr ? 'Oyun Puanlarım' : 'My Game Scores'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'leaderboard' ? (
            loading && !data ? (
              <View style={styles.emptyBox}>
                <ActivityIndicator size="large" color={colors.amber} />
                <Text style={styles.emptyDesc}>
                  {isTr ? 'Sıralama yükleniyor...' : 'Loading rankings...'}
                </Text>
              </View>
            ) : data && data.topUsers.length > 0 ? (
              <View style={styles.rankingList}>
                {data.topUsers.map((player) => {
                  const medal =
                    player.rank === 1
                      ? '🥇'
                      : player.rank === 2
                        ? '🥈'
                        : player.rank === 3
                          ? '🥉'
                          : `#${player.rank}`;
                  return (
                    <View
                      key={`${player.rank}-${player.displayName}`}
                      style={[
                        styles.rankingRow,
                        player.isCurrentUser && styles.rankingRowUser,
                      ]}
                    >
                      <Text style={styles.rankText}>{medal}</Text>
                      <View
                        style={[
                          styles.playerAvatar,
                          { backgroundColor: getAvatarColor(player.displayName) },
                        ]}
                      >
                        <Text style={styles.playerAvatarText}>
                          {player.avatarInitial}
                        </Text>
                      </View>
                      <View style={styles.playerInfo}>
                        <Text style={styles.playerName}>
                          {player.displayName}{' '}
                          {player.isCurrentUser
                            ? isTr
                              ? '(Sen)'
                              : '(You)'
                            : ''}
                        </Text>
                        <Text style={styles.playerGames}>
                          {player.gamesCompleted} {isTr ? 'oyun' : 'games'}
                        </Text>
                      </View>
                      <Text style={styles.playerScore}>⭐ {player.totalScore}</Text>
                    </View>
                  );
                })}
                {data.totalUsersCount > 0 ? (
                  <View style={styles.footerNote}>
                    <Sparkles size={14} color={colors.amber} />
                    <Text style={styles.footerText}>
                      {isTr
                        ? `Toplam ${data.totalUsersCount} kaşif!`
                        : `${data.totalUsersCount} explorers worldwide!`}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Trophy size={36} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>
                  {offlineFallback
                    ? isTr
                      ? 'Sıralama şu an yüklenemedi'
                      : 'Could not reach leaderboard'
                    : isTr
                      ? 'Henüz sıralamada kimse yok!'
                      : 'No scores on the leaderboard yet!'}
                </Text>
                <Text style={styles.emptyDesc}>
                  {offlineFallback
                    ? isTr
                      ? 'İnternet bağlantınızı kontrol edip Yenile tuşuna dokunun.'
                      : 'Check your connection and tap Refresh.'
                    : isTr
                      ? 'Oyunları oyna ve ilk puanları toplayan kaşif ol!'
                      : 'Play games to be the first explorer on the board!'}
                </Text>
              </View>
            )
          ) : (
            <View style={styles.gamesGrid}>
              {ALL_GAMES.map((game) => {
                const score = currentScoreByMode[game.mode] ?? 0;
                const completed =
                  profile?.stats?.gamesCompletedByMode?.[game.mode] ?? 0;
                return (
                  <View key={game.mode} style={styles.gameCard}>
                    <View style={styles.gameTop}>
                      <Text style={styles.gameEmoji}>{game.emoji}</Text>
                      <Text style={styles.gameLevel}>L{game.level}</Text>
                    </View>
                    <Text style={styles.gameName}>
                      {isTr ? game.nameTr : game.nameEn}
                    </Text>
                    <Text style={styles.gamePts}>
                      {isTr ? game.ptsTr : game.ptsEn}
                    </Text>
                    <View style={styles.gameBottom}>
                      <Text style={styles.gameRounds}>
                        {completed} {isTr ? 'tur' : 'rnds'}
                      </Text>
                      <Text style={styles.gameScore}>⭐ {score}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

export function LeaderboardModal({ language }: LeaderboardModalProps) {
  const { isLeaderboardModalOpen, closeLeaderboardModal } = useAuth();

  return (
    <Modal
      visible={isLeaderboardModalOpen}
      transparent
      animationType="slide"
      onRequestClose={closeLeaderboardModal}
      statusBarTranslucent
    >
      {isLeaderboardModalOpen ? (
        <LeaderboardModalBody language={language} />
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
    gap: spacing.md,
    borderWidth: 3,
    borderColor: colors.amberLight,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: 44,
  },
  trophyWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.amberPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.amberLight,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
  },
  heroMeta: {
    flex: 1,
  },
  heroName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
  },
  heroGames: {
    fontSize: 12,
    color: colors.textMuted,
  },
  heroScoreBadge: {
    alignItems: 'flex-end',
  },
  heroScoreLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.skyDark,
  },
  heroScoreVal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: '#f1f5f9',
    padding: 4,
    borderRadius: radii.md,
  },
  tabBtn: {
    flex: 1,
    minHeight: touchTargets.nav,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: colors.amber,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.navy,
  },
  tabTextActive: {
    color: colors.white,
  },
  scrollContent: {
    paddingBottom: spacing.sm,
  },
  rankingList: {
    gap: spacing.xs,
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#f8fafc',
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rankingRowUser: {
    backgroundColor: '#eff6ff',
    borderColor: colors.blue,
  },
  rankText: {
    width: 32,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
  },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textDark,
  },
  playerGames: {
    fontSize: 11,
    color: colors.textMuted,
  },
  playerScore: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.navy,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: spacing.sm,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gameCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  gameTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameEmoji: {
    fontSize: 22,
  },
  gameLevel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.skyDark,
    backgroundColor: colors.blueLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  gameName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.navy,
  },
  gamePts: {
    fontSize: 11,
    color: colors.textMuted,
  },
  gameBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  gameRounds: {
    fontSize: 12,
    color: colors.textMuted,
  },
  gameScore: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.navy,
  },
});
