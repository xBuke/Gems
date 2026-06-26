import { EmptyState } from '@/components/EmptyState';
import { SegmentedPill } from '@/components/SegmentedPill';
import { useTheme } from '@/lib/ThemeContext';
import { semantic, type Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type LeaderboardPeriod = 'friends' | 'weekly' | 'monthly' | 'all_time';

type LeaderboardRow = {
  rank: number;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  points: number;
};

type MyRankRow = {
  rank: number | null;
  points: number;
};

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  friends: 'among friends',
  weekly: 'this week',
  monthly: 'this month',
  all_time: 'all time',
};

const EMPTY_MESSAGES: Record<LeaderboardPeriod, { title: string; subtitle: string }> = {
  friends: {
    title: 'No friends on the board yet',
    subtitle: 'Follow people back to see them here',
  },
  weekly: {
    title: 'No activity yet this week',
    subtitle: 'Be the first explorer on the board!',
  },
  monthly: {
    title: 'No activity yet this month',
    subtitle: 'Be the first explorer on the board!',
  },
  all_time: {
    title: 'No explorers on the board yet',
    subtitle: 'Drop a gem or check in to get started!',
  },
};

function formatPoints(points: number) {
  return `${points.toLocaleString()} XP`;
}

function getRankDisplay(rank: number) {
  if (rank === 1) return { label: '🥇', color: semantic.gold };
  if (rank === 2) return { label: '🥈', color: semantic.silver };
  if (rank === 3) return { label: '🥉', color: semantic.bronze };
  return { label: String(rank), color: null };
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [activePeriod, setActivePeriod] = useState<LeaderboardPeriod>('friends');
  const [entries, setEntries] = useState<LeaderboardRow[]>([]);
  const [myRank, setMyRank] = useState<MyRankRow | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = useCallback(async (period: LeaderboardPeriod, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const leaderboardParams =
      period === 'friends'
        ? { p_period: period, p_limit: 50, p_user_id: user?.id ?? null }
        : { p_period: period, p_limit: 50 };

    const [leaderboardResult, myRankResult] = await Promise.all([
      supabase.rpc('get_leaderboard', leaderboardParams),
      user
        ? supabase.rpc('get_my_rank', { p_user_id: user.id, p_period: period })
        : Promise.resolve({ data: null, error: null }),
    ]);

    setEntries((leaderboardResult.data as LeaderboardRow[] | null) ?? []);

    const myRankData = myRankResult.data;
    if (Array.isArray(myRankData) && myRankData.length > 0) {
      setMyRank(myRankData[0] as MyRankRow);
    } else if (myRankData && !Array.isArray(myRankData)) {
      setMyRank(myRankData as MyRankRow);
    } else {
      setMyRank(null);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void fetchLeaderboard(activePeriod);
  }, [activePeriod, fetchLeaderboard]);

  const onRefresh = useCallback(() => {
    void fetchLeaderboard(activePeriod, true);
  }, [activePeriod, fetchLeaderboard]);

  const periodLabel = PERIOD_LABELS[activePeriod];
  const emptyCopy = EMPTY_MESSAGES[activePeriod];

  const renderRow = ({ item }: { item: LeaderboardRow }) => {
    const initials = (item.username ?? 'U').charAt(0).toUpperCase();
    const isMe = item.user_id === currentUserId;
    const rankDisplay = getRankDisplay(item.rank);

    return (
      <TouchableOpacity
        style={[styles.row, isMe && styles.rowHighlight]}
        activeOpacity={0.7}
        onPress={() =>
          router.push({ pathname: '/profile', params: { userId: item.user_id } })
        }>
        <View style={styles.rankCell}>
          {rankDisplay.color ? (
            <Text style={styles.rankMedal}>{rankDisplay.label}</Text>
          ) : (
            <Text style={styles.rankNumber}>{rankDisplay.label}</Text>
          )}
        </View>
        {item.avatar_url ? (
          <Image
            source={{ uri: item.avatar_url }}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.username} numberOfLines={1}>
            @{item.username ?? 'explorer'}
          </Text>
          {isMe ? (
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>YOU</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.points}>{formatPoints(item.points)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <View style={styles.headerSide} />
      </View>

      <View style={styles.pillWrapper}>
        <SegmentedPill
          tabs={[
            { key: 'friends', label: 'Friends' },
            { key: 'weekly', label: 'Weekly' },
            { key: 'monthly', label: 'Monthly' },
            { key: 'all_time', label: 'All-Time' },
          ]}
          activeKey={activePeriod}
          onChange={(key) => setActivePeriod(key as LeaderboardPeriod)}
          theme={theme}
          width={windowWidth - 32}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => `${item.user_id}-${item.rank}`}
          renderItem={renderRow}
          contentContainerStyle={[
            styles.listContent,
            entries.length === 0 && styles.listContentEmpty,
            currentUserId ? styles.listContentWithSticky : null,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="trophy-outline"
              title={emptyCopy.title}
              subtitle={emptyCopy.subtitle}
            />
          }
        />
      )}

      {currentUserId && myRank && !loading ? (
        <View style={styles.stickyCard}>
          <View style={styles.stickyCardInner}>
            <View style={styles.stickyLeft}>
              <Text style={styles.stickyLabel}>YOUR RANK</Text>
              <Text style={styles.stickyRank}>
                {myRank.rank != null ? `#${myRank.rank.toLocaleString()}` : 'Unranked'}
              </Text>
            </View>
            <Text style={styles.stickyPoints}>
              {formatPoints(myRank.points)} {periodLabel}
            </Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerSide: {
      width: 40,
      alignItems: 'flex-start',
    },
    headerTitle: {
      flex: 1,
      fontSize: 17,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.text,
      textAlign: 'center',
    },
    pillWrapper: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    listContentEmpty: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    listContentWithSticky: {
      paddingBottom: 88,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
      gap: 10,
    },
    rowHighlight: {
      backgroundColor: theme.accentSub,
      borderColor: theme.accent,
    },
    rankCell: {
      width: 32,
      alignItems: 'center',
    },
    rankMedal: {
      fontSize: 18,
    },
    rankNumber: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 13,
      color: theme.textTertiary,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    avatarPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.bgTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 16,
      color: theme.textSecondary,
    },
    userInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
    },
    username: {
      flexShrink: 1,
      fontFamily: 'SpaceGrotesk-SemiBold',
      fontSize: 14,
      color: theme.text,
    },
    youBadge: {
      backgroundColor: theme.accent,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    youBadgeText: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 8,
      color: theme.accentText,
      letterSpacing: 0.5,
    },
    points: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 12,
      color: theme.textSecondary,
    },
    stickyCard: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingBottom: 8,
      paddingTop: 8,
      backgroundColor: theme.background,
      borderTopWidth: 0.5,
      borderTopColor: theme.border,
    },
    stickyCardInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.accentSub,
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: theme.accent,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    stickyLeft: {
      gap: 2,
    },
    stickyLabel: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 9,
      color: theme.textSecondary,
      letterSpacing: 1,
    },
    stickyRank: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 16,
      color: theme.text,
    },
    stickyPoints: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'right',
      flexShrink: 1,
      marginLeft: 12,
    },
  });
