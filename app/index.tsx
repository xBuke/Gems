import { requireAuth } from '@/lib/authGuard';
import { getDistance } from '@/lib/distance';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  bg: '#0D0D0D',
  card: '#141414',
  accent: '#1D9E75',
  accentSubtle: '#0F3D25',
  text: '#F5F5F5',
  textMuted: '#888888',
  textDim: '#555555',
  border: '#222222',
  star: '#FFD700',
  imagePlaceholder: '#1A5C3A',
  danger: '#FF4444',
};

type Gem = {
  id: string;
  title: string;
  category: string;
  image_url: string | null;
  verified: boolean;
  latitude: number;
  longitude: number;
  created_at: string;
};

type FollowingGem = Gem & {
  profiles: { username: string } | null;
};

type FeedTab = 'forYou' | 'following';

const TABS = [
  { key: 'discover', label: 'Discover', icon: 'compass-outline' as const, activeIcon: 'compass' as const },
  { key: 'map', label: 'Map', icon: 'map-outline' as const, activeIcon: 'map' as const },
  {
    key: 'add',
    label: 'Add',
    icon: 'add-circle-outline' as const,
    activeIcon: 'add-circle' as const,
    addButton: true,
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: 'notifications-outline' as const,
    activeIcon: 'notifications' as const,
  },
  { key: 'profile', label: 'Profile', icon: 'person-outline' as const, activeIcon: 'person' as const },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('discover');
  const [feedTab, setFeedTab] = useState<FeedTab>('forYou');
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [gemOfTheDay, setGemOfTheDay] = useState<Gem | null>(null);
  const [trendingGems, setTrendingGems] = useState<Gem[]>([]);
  const [recentGems, setRecentGems] = useState<Gem[]>([]);
  const [nearbyGems, setNearbyGems] = useState<Gem[]>([]);
  const [followingGems, setFollowingGems] = useState<FollowingGem[]>([]);
  const [locationAvailable, setLocationAvailable] = useState(false);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  const fetchLikeCounts = useCallback(async (gems: Gem[]) => {
    if (gems.length === 0) return;

    const gemIds = gems.map((gem) => gem.id);
    const { data } = await supabase.from('gem_likes').select('gem_id').in('gem_id', gemIds);

    const counts: Record<string, number> = {};
    for (const gemId of gemIds) counts[gemId] = 0;
    if (data) {
      for (const row of data) {
        counts[row.gem_id] = (counts[row.gem_id] ?? 0) + 1;
      }
    }
    setLikeCounts((prev) => ({ ...prev, ...counts }));
  }, []);

  const checkUnreadMessages = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setHasUnreadMessages(false);
      return;
    }

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('read', false);

    setHasUnreadMessages(!error && (count ?? 0) > 0);
  }, []);

  const checkUnreadNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUnreadNotificationCount(0);
      return;
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    setUnreadNotificationCount(!error ? (count ?? 0) : 0);
  }, []);

  const fetchFollowingGems = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setFollowingGems([]);
      return;
    }

    const { data: followingIds } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    if (!followingIds || followingIds.length === 0) {
      setFollowingGems([]);
      return;
    }

    const ids = followingIds.map((f) => f.following_id);

    const { data: gems } = await supabase
      .from('gems')
      .select('*, profiles!gems_user_id_fkey(username)')
      .in('user_id', ids)
      .order('created_at', { ascending: false });

    if (gems) {
      setFollowingGems(gems as FollowingGem[]);
      fetchLikeCounts(gems as Gem[]);
    }
  }, [fetchLikeCounts]);

  useEffect(() => {
    const fetchGemOfTheDay = async () => {
      const { data } = await supabase
        .from('gems')
        .select('*')
        .eq('is_private', false)
        .limit(10);

      if (data && data.length > 0) {
        const random = data[Math.floor(Math.random() * data.length)];
        setGemOfTheDay(random);
        fetchLikeCounts([random]);
      }
    };

    const fetchTrending = async () => {
      const { data } = await supabase
        .from('gems')
        .select('*')
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        setTrendingGems(data);
        fetchLikeCounts(data);
      }
    };

    const fetchRecent = async () => {
      const { data } = await supabase
        .from('gems')
        .select('*')
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setRecentGems(data);
        fetchLikeCounts(data);
      }
    };

    const fetchNearby = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationAvailable(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocationAvailable(true);

      const { data } = await supabase
        .from('gems')
        .select('*')
        .eq('is_private', false);

      if (data) {
        const nearby = data.filter(
          (gem) =>
            getDistance(
              location.coords.latitude,
              location.coords.longitude,
              gem.latitude,
              gem.longitude,
            ) < 50000,
        );
        setNearbyGems(nearby);
        fetchLikeCounts(nearby);
      }
    };

    fetchGemOfTheDay();
    fetchTrending();
    fetchRecent();
    fetchNearby();
    checkUnreadMessages();
    checkUnreadNotifications();
  }, [checkUnreadMessages, checkUnreadNotifications, fetchLikeCounts]);

  useEffect(() => {
    let channel: any = null;
    let cancelled = false;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (cancelled) return;

      setUnreadNotificationCount(count || 0);

      channel = supabase
        .channel('notifications-badge-' + user.id)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            setUnreadNotificationCount((prev) => prev + 1);
          },
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (feedTab === 'following') {
      fetchFollowingGems();
    }
  }, [feedTab, fetchFollowingGems]);

  const handleMessagesPress = async () => {
    const proceed = await requireAuth();
    if (!proceed) return;
    router.push('/messages');
  };

  const renderGemCard = (gem: Gem, username?: string) => (
    <TouchableOpacity
      key={gem.id}
      style={styles.gemCard}
      onPress={() => router.push('/gem/' + gem.id)}
      activeOpacity={0.7}>
      <View style={styles.photoPlaceholder}>
        {gem.image_url ? (
          <Image source={{ uri: gem.image_url }} style={styles.gemImage} />
        ) : null}
        <View style={styles.badgeRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{gem.category}</Text>
          </View>
          {gem.verified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>✓ Verified</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.gemInfo}>
        {username ? <Text style={styles.posterName}>@{username}</Text> : null}
        <Text style={styles.gemName}>{gem.title}</Text>
        <View style={styles.gemMeta}>
          <View style={styles.likeRow}>
            <Ionicons name="heart-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.likeText}>{likeCounts[gem.id] ?? 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderForYouContent = () => (
    <>
      <Text style={styles.sectionTitle}>Gem of the Day</Text>
      {gemOfTheDay && (
        <TouchableOpacity
          style={styles.gemOfTheDayCard}
          onPress={() => router.push('/gem/' + gemOfTheDay.id)}
          activeOpacity={0.7}>
          <Ionicons name="location" size={24} color={COLORS.accent} />
          <View style={styles.gemOfTheDayContent}>
            <Text style={styles.gemOfTheDayLabel}>GEM OF THE DAY</Text>
            <Text style={styles.gemOfTheDayName}>{gemOfTheDay.title}</Text>
            <Text style={styles.gemOfTheDayMeta}>
              {gemOfTheDay.category} · Tap to explore
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Trending</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.trendingRow}>
        {trendingGems.map((gem) => (
          <TouchableOpacity
            key={gem.id}
            style={styles.trendingCard}
            onPress={() => router.push('/gem/' + gem.id)}
            activeOpacity={0.7}>
            <View style={styles.trendingImage}>
              {gem.image_url ? (
                <Image source={{ uri: gem.image_url }} style={styles.trendingImageFill} />
              ) : null}
              <View style={styles.trendingBadge}>
                <Text style={styles.trendingBadgeText}>{gem.category}</Text>
              </View>
            </View>
            <Text style={styles.trendingTitle} numberOfLines={2}>
              {gem.title}
            </Text>
            <View style={styles.trendingLikeRow}>
              <Ionicons name="heart-outline" size={12} color={COLORS.textMuted} />
              <Text style={styles.likeText}>{likeCounts[gem.id] ?? 0}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Recently Added</Text>
      {recentGems.map((gem) => renderGemCard(gem))}

      {locationAvailable && (
        <>
          <Text style={styles.sectionTitle}>Near You</Text>
          {nearbyGems.length === 0 ? (
            <Text style={styles.emptyText}>No gems near you yet — be the first!</Text>
          ) : (
            nearbyGems.map((gem) => renderGemCard(gem))
          )}
        </>
      )}
    </>
  );

  const renderFollowingContent = () => {
    if (followingGems.length === 0) {
      return (
        <View style={styles.followingEmpty}>
          <Ionicons name="people-outline" size={48} color={COLORS.accent} />
          <Text style={styles.followingEmptyText}>Follow people to see their gems</Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => setFeedTab('forYou')}
            activeOpacity={0.8}>
            <Text style={styles.exploreButtonText}>Explore gems</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return followingGems.map((gem) =>
      renderGemCard(gem, gem.profiles?.username ?? 'unknown'),
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Discover</Text>
        <TouchableOpacity
          style={styles.messagesButton}
          onPress={handleMessagesPress}
          activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={24} color={COLORS.text} />
          {hasUnreadMessages && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      </View>

      <View style={styles.feedTabContainer}>
        <TouchableOpacity
          style={[styles.feedTab, feedTab === 'forYou' && styles.feedTabActive]}
          onPress={() => setFeedTab('forYou')}
          activeOpacity={0.8}>
          <Text style={[styles.feedTabText, feedTab === 'forYou' && styles.feedTabTextActive]}>
            For You
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.feedTab, feedTab === 'following' && styles.feedTabActive]}
          onPress={() => setFeedTab('following')}
          activeOpacity={0.8}>
          <Text style={[styles.feedTabText, feedTab === 'following' && styles.feedTabTextActive]}>
            Following
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {feedTab === 'forYou' ? renderForYouContent() : renderFollowingContent()}
      </ScrollView>

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const isAddButton = 'addButton' in tab && tab.addButton;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={async () => {
                if (tab.key === 'discover') {
                  setActiveTab('discover');
                } else if (tab.key === 'map') {
                  router.push('/map');
                  setActiveTab(tab.key);
                } else if (tab.key === 'add') {
                  const proceed = await requireAuth();
                  if (!proceed) return;
                  router.push('/add-gem');
                  setActiveTab(tab.key);
                } else if (tab.key === 'notifications') {
                  router.push('/notifications');
                  setActiveTab(tab.key);
                } else if (tab.key === 'profile') {
                  const proceed = await requireAuth();
                  if (!proceed) return;
                  router.push('/profile');
                  setActiveTab(tab.key);
                }
              }}
              activeOpacity={0.7}>
              <View style={styles.tabIconWrap}>
                <Ionicons
                  name={isActive ? tab.activeIcon : tab.icon}
                  size={isAddButton ? 34 : 24}
                  color={isAddButton ? COLORS.accent : isActive ? COLORS.accent : COLORS.textDim}
                />
                {tab.key === 'notifications' && unreadNotificationCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
  },
  messagesButton: {
    position: 'relative',
    padding: 4,
  },
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
  },
  feedTabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  feedTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  feedTabActive: {
    backgroundColor: COLORS.accent,
  },
  feedTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  feedTabTextActive: {
    color: COLORS.bg,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  gemOfTheDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    gap: 12,
  },
  gemOfTheDayContent: {
    flex: 1,
  },
  gemOfTheDayLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  gemOfTheDayName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  gemOfTheDayMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  trendingRow: {
    gap: 12,
    paddingBottom: 4,
    marginBottom: 24,
  },
  trendingCard: {
    width: 160,
    height: 200,
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  trendingImage: {
    height: 120,
    backgroundColor: COLORS.imagePlaceholder,
    position: 'relative',
  },
  trendingImageFill: {
    width: '100%',
    height: '100%',
  },
  trendingBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: COLORS.accentSubtle,
    borderWidth: 0.5,
    borderColor: COLORS.accent,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  trendingBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.accent,
  },
  trendingTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  trendingLikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  gemCard: {
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  photoPlaceholder: {
    height: 130,
    width: '100%',
    backgroundColor: '#1A1A1A',
  },
  gemImage: {
    height: 130,
    width: '100%',
  },
  badgeRow: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: COLORS.accentSubtle,
    borderWidth: 0.5,
    borderColor: COLORS.accent,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.accent,
  },
  verifiedBadge: {
    backgroundColor: COLORS.accentSubtle,
    borderWidth: 0.5,
    borderColor: COLORS.accent,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.accent,
  },
  gemInfo: {
    padding: 12,
  },
  posterName: {
    fontSize: 12,
    color: COLORS.accent,
    marginBottom: 4,
    fontWeight: '500',
  },
  gemName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  gemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    paddingVertical: 16,
  },
  followingEmpty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  followingEmptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  exploreButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  exploreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.bg,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
    paddingBottom: 8,
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tabIconWrap: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabLabel: {
    fontSize: 11,
    color: COLORS.textDim,
  },
  tabLabelActive: {
    color: COLORS.accent,
    fontWeight: '600',
  },
});
