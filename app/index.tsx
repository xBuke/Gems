import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { SkeletonCard } from '@/components/SkeletonCard';
import { requireAuth } from '@/lib/authGuard';
import { CATEGORIES } from '@/lib/categories';
import { fetchVisibleCustomCategories, type CustomCategory } from '@/lib/customCategories';
import {
  applyCommunityGemFilter,
  fetchMyCommunityIds,
  type CommunityGemInfo,
} from '@/lib/gemVisibility';
import { PENDING_PREFS_KEY } from '@/lib/onboarding';
import { checkIsPremium } from '@/lib/paywall';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { formatCoordinates } from '@/lib/coordinates';
import { getDistance } from '@/lib/distance';
import { hapticSelection } from '@/lib/haptics';
import { getMysteryGemOfTheWeek } from '@/lib/mysteryGem';
import { getMyBlockedUsers } from '@/lib/safety';
import { consumeLastStreakResult } from '@/lib/streak';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Reanimated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const LOCAL_PICK_COLOR = '#7F77DD';
const PIONEER_COLOR = '#FFD700';

const DISCOVER_GEM_SELECT =
  '*, profiles!gems_user_id_fkey(username, avatar_url), communities(name, icon, color)';

const PAGE_SIZE = 20;

type Gem = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  subcategory?: string | null;
  custom_category_id?: string | null;
  image_url: string | null;
  verified: boolean;
  is_local_pick?: boolean;
  is_first_in_area?: boolean;
  best_time?: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
};

type Category = (typeof CATEGORIES)[number];

type GemWithProfile = Gem & {
  user_id: string;
  profiles: { username: string; avatar_url?: string | null } | null;
  community_id?: string | null;
  communities?: CommunityGemInfo | null;
};

type FeedTab = 'forYou' | 'following';

type UserCoords = {
  latitude: number;
  longitude: number;
};

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

const formatDistanceKm = (meters: number) => {
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
};

type TabBarIconProps = {
  isActive: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  size: number;
  color: string;
};

function TabBarIcon({ isActive, icon, activeIcon, size, color }: TabBarIconProps) {
  const tabScale = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      tabScale.value = withSequence(
        withTiming(1.15, { duration: 150 }),
        withTiming(1, { duration: 150 }),
      );
    }
  }, [isActive, tabScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: tabScale.value }],
  }));

  return (
    <Reanimated.View style={animatedStyle}>
      <Ionicons name={isActive ? activeIcon : icon} size={size} color={color} />
    </Reanimated.View>
  );
}

const matchesSearch = (gem: GemWithProfile, query: string) => {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  return (
    gem.title.toLowerCase().includes(q) ||
    gem.category.toLowerCase().includes(q) ||
    (gem.profiles?.username?.toLowerCase().includes(q) ?? false)
  );
};

export default function DiscoverScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('discover');
  const [feedTab, setFeedTab] = useState<FeedTab>('forYou');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [mysteryGem, setMysteryGem] = useState<GemWithProfile | null>(null);
  const [gemOfTheDay, setGemOfTheDay] = useState<GemWithProfile | null>(null);
  const [trendingGems, setTrendingGems] = useState<GemWithProfile[]>([]);
  const [recentGems, setRecentGems] = useState<GemWithProfile[]>([]);
  const [recentlyAddedPage, setRecentlyAddedPage] = useState(0);
  const [hasMoreRecent, setHasMoreRecent] = useState(true);
  const [loadingMoreRecent, setLoadingMoreRecent] = useState(false);
  const [nearbyGems, setNearbyGems] = useState<GemWithProfile[]>([]);
  const [nearbyPage, setNearbyPage] = useState(0);
  const [hasMoreNearby, setHasMoreNearby] = useState(true);
  const [loadingMoreNearby, setLoadingMoreNearby] = useState(false);
  const [followingGems, setFollowingGems] = useState<GemWithProfile[]>([]);
  const [locationAvailable, setLocationAvailable] = useState(false);
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [activeMainCategory, setActiveMainCategory] = useState<Category | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [activeCustomCategory, setActiveCustomCategory] = useState<CustomCategory | null>(null);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [allGems, setAllGems] = useState<GemWithProfile[]>([]);
  const [filteredGems, setFilteredGems] = useState<GemWithProfile[]>([]);
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [streakBannerText, setStreakBannerText] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const streakBannerOpacity = useRef(new Animated.Value(0)).current;

  const showStreakBanner = useCallback(
    (text: string) => {
      setStreakBannerText(text);
      streakBannerOpacity.setValue(0);
      Animated.timing(streakBannerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        Animated.timing(streakBannerOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setStreakBannerText(null));
      }, 3000);
    },
    [streakBannerOpacity],
  );

  const checkStreakBanner = useCallback(() => {
    const tryShow = (attempt = 0) => {
      const result = consumeLastStreakResult();
      if (result) {
        if (!result.isNewDay || result.current_streak <= 1) return;

        const text = result.brokeRecord
          ? `New record! ${result.current_streak} days 🎉`
          : `${result.current_streak} day streak! Keep it going 🔥`;

        showStreakBanner(text);
        return;
      }

      if (attempt < 15) {
        setTimeout(() => tryShow(attempt + 1), 200);
      }
    };

    tryShow();
  }, [showStreakBanner]);

  const sortByPreferences = useCallback(
    (gems: GemWithProfile[]) => {
      if (preferredCategories.length === 0) return gems;
      return [...gems].sort((a, b) => {
        const aMatch = preferredCategories.includes(a.category) ? 0 : 1;
        const bMatch = preferredCategories.includes(b.category) ? 0 : 1;
        return aMatch - bMatch;
      });
    },
    [preferredCategories],
  );

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

  const getGemDistance = useCallback(
    (gem: Gem) => {
      if (!userCoords) return null;
      return getDistance(
        userCoords.latitude,
        userCoords.longitude,
        gem.latitude,
        gem.longitude,
      );
    },
    [userCoords],
  );

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

  const filterBlocked = <T extends { user_id: string }>(
    gems: T[],
    blockedIds: Set<string>,
  ): T[] => gems.filter((g) => !blockedIds.has(g.user_id));

  const fetchRecentGems = useCallback(
    async (page = 0, myCommunityIds: string[] = []) => {
      const { data: { user } } = await supabase.auth.getUser();
      const blocked = user ? await getMyBlockedUsers(user.id) : [];
      const blockedIds = new Set<string>(
        blocked.map((b: { blocked_id: string }) => b.blocked_id),
      );

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('gems')
        .select(DISCOVER_GEM_SELECT)
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .range(from, to);

      query = applyCommunityGemFilter(query, myCommunityIds);

      const { data, error } = await query;

      if (error) {
        console.log('Fetch error:', error);
        setFeedError('Something went wrong loading your feed. Pull down to refresh.');
        return;
      }

      setFeedError(null);

      if (data) {
        const filtered = (data as GemWithProfile[]).filter((g) => !blockedIds.has(g.user_id));
        if (page === 0) {
          setRecentGems(filtered);
        } else {
          setRecentGems((prev) => [...prev, ...filtered]);
        }
        setHasMoreRecent(data.length === PAGE_SIZE);
        fetchLikeCounts(filtered as Gem[]);
      }
    },
    [fetchLikeCounts],
  );

  const fetchNearbyGems = useCallback(
    async (page = 0, myCommunityIds: string[] = [], coords?: UserCoords | null) => {
      const { data: { user } } = await supabase.auth.getUser();
      const blocked = user ? await getMyBlockedUsers(user.id) : [];
      const blockedIds = new Set<string>(
        blocked.map((b: { blocked_id: string }) => b.blocked_id),
      );

      let locationCoords = coords ?? null;

      if (page === 0) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationAvailable(false);
          setUserCoords(null);
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        locationCoords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setLocationAvailable(true);
        setUserCoords(locationCoords);
      } else if (!locationCoords) {
        return;
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('gems')
        .select(DISCOVER_GEM_SELECT)
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .range(from, to);

      query = applyCommunityGemFilter(query, myCommunityIds);

      const { data, error } = await query;

      if (error) {
        console.log('Fetch error:', error);
        setFeedError('Something went wrong loading your feed. Pull down to refresh.');
        return;
      }

      setFeedError(null);

      if (data && locationCoords) {
        const nearby = filterBlocked(data as GemWithProfile[], blockedIds)
          .map((gem) => ({
            gem,
            distance: getDistance(
              locationCoords!.latitude,
              locationCoords!.longitude,
              gem.latitude,
              gem.longitude,
            ),
          }))
          .filter(({ distance }) => distance < 50000)
          .sort((a, b) => a.distance - b.distance)
          .map(({ gem }) => gem);

        if (page === 0) {
          setNearbyGems(nearby);
        } else {
          setNearbyGems((prev) => {
            const existingIds = new Set(prev.map((g) => g.id));
            const newGems = nearby.filter((g) => !existingIds.has(g.id));
            return [...prev, ...newGems];
          });
        }
        setHasMoreNearby(data.length === PAGE_SIZE);
        fetchLikeCounts(nearby);
      }
    },
    [fetchLikeCounts],
  );

  const fetchFollowingGems = useCallback(async (myCommunityIds: string[] = []) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setFollowingGems([]);
      return;
    }

    const blocked = await getMyBlockedUsers(user.id);
    const blockedIds = new Set(blocked.map((b: { blocked_id: string }) => b.blocked_id));

    const { data: followingIds } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .eq('status', 'accepted');

    if (!followingIds || followingIds.length === 0) {
      setFollowingGems([]);
      return;
    }

    const ids = followingIds.map((f: { following_id: string }) => f.following_id);

    let query = supabase
      .from('gems')
      .select(DISCOVER_GEM_SELECT)
      .in('user_id', ids)
      .order('created_at', { ascending: false });

    query = applyCommunityGemFilter(query, myCommunityIds);

    const { data: gems, error } = await query;

    if (error) {
      console.log('Fetch error:', error);
      setFeedError('Something went wrong loading your feed. Pull down to refresh.');
      return;
    }

    setFeedError(null);

    if (gems) {
      const filtered = (gems as GemWithProfile[]).filter((g) => !blockedIds.has(g.user_id));
      setFollowingGems(filtered);
      fetchLikeCounts(filtered as Gem[]);
    }
  }, [fetchLikeCounts]);

  const refreshDiscoverData = useCallback(async (myCommunityIds: string[] = []) => {
    const { data: { user } } = await supabase.auth.getUser();
    const blocked = user ? await getMyBlockedUsers(user.id) : [];
    const blockedIds = new Set(blocked.map((b: { blocked_id: string }) => b.blocked_id));

    const filterBlockedLocal = <T extends { user_id: string }>(gems: T[]): T[] =>
      gems.filter((g) => !blockedIds.has(g.user_id));

    const fetchMysteryGem = async () => {
      const gem = await getMysteryGemOfTheWeek();
      if (gem && !blockedIds.has(gem.user_id)) {
        setMysteryGem(gem as GemWithProfile);
        fetchLikeCounts([gem as Gem]);
      } else {
        setMysteryGem(null);
      }
    };

    const fetchGemOfTheDay = async () => {
      let query = supabase
        .from('gems')
        .select(DISCOVER_GEM_SELECT)
        .eq('is_private', false)
        .limit(10);

      query = applyCommunityGemFilter(query, myCommunityIds);

      const { data, error } = await query;

      if (error) {
        console.log('Fetch error:', error);
        setFeedError('Something went wrong loading your feed. Pull down to refresh.');
        return;
      }

      setFeedError(null);

      if (data && data.length > 0) {
        const eligible = filterBlockedLocal(data as GemWithProfile[]);
        if (eligible.length > 0) {
          const random = eligible[Math.floor(Math.random() * eligible.length)];
          setGemOfTheDay(random);
          fetchLikeCounts([random]);
        } else {
          setGemOfTheDay(null);
        }
      }
    };

    const fetchTrending = async () => {
      let query = supabase
        .from('gems')
        .select(DISCOVER_GEM_SELECT)
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .limit(5);

      query = applyCommunityGemFilter(query, myCommunityIds);

      const { data, error } = await query;

      if (error) {
        console.log('Fetch error:', error);
        setFeedError('Something went wrong loading your feed. Pull down to refresh.');
        return;
      }

      setFeedError(null);

      if (data) {
        const filtered = filterBlockedLocal(data as GemWithProfile[]);
        setTrendingGems(filtered);
        fetchLikeCounts(filtered as Gem[]);
      }
    };

    const fetchAllGems = async () => {
      let query = supabase
        .from('gems')
        .select(DISCOVER_GEM_SELECT)
        .eq('is_private', false);

      query = applyCommunityGemFilter(query, myCommunityIds);

      const { data, error } = await query;

      if (error) {
        console.log('Fetch error:', error);
        setFeedError('Something went wrong loading your feed. Pull down to refresh.');
        return;
      }

      setFeedError(null);

      if (data) setAllGems(filterBlockedLocal(data as GemWithProfile[]));
    };

    setRecentlyAddedPage(0);
    setHasMoreRecent(true);
    setNearbyPage(0);
    setHasMoreNearby(true);

    fetchMysteryGem();
    await Promise.all([
      fetchGemOfTheDay(),
      fetchTrending(),
      fetchRecentGems(0, myCommunityIds),
      fetchAllGems(),
      fetchNearbyGems(0, myCommunityIds),
    ]);
    checkUnreadMessages();
    checkUnreadNotifications();

    const loadCustomCategories = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const categories = await fetchVisibleCustomCategories(user.id);
      setCustomCategories(categories);
    };
    loadCustomCategories();
  }, [checkUnreadMessages, checkUnreadNotifications, fetchLikeCounts, fetchRecentGems, fetchNearbyGems]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const { data: { user } } = await supabase.auth.getUser();
    const myCommunityIds = await fetchMyCommunityIds(user?.id ?? null);
    await Promise.all([
      refreshDiscoverData(myCommunityIds),
      fetchFollowingGems(myCommunityIds),
    ]);
    setRefreshing(false);
  }, [fetchFollowingGems, refreshDiscoverData]);

  const handleRetryFeed = useCallback(async () => {
    setFeedError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const myCommunityIds = await fetchMyCommunityIds(user?.id ?? null);
    await Promise.all([
      refreshDiscoverData(myCommunityIds),
      fetchFollowingGems(myCommunityIds),
    ]);
  }, [fetchFollowingGems, refreshDiscoverData]);

  const handleLoadMoreRecent = useCallback(async () => {
    if (loadingMoreRecent || !hasMoreRecent) return;
    setLoadingMoreRecent(true);
    const nextPage = recentlyAddedPage + 1;
    const { data: { user } } = await supabase.auth.getUser();
    const myCommunityIds = await fetchMyCommunityIds(user?.id ?? null);
    await fetchRecentGems(nextPage, myCommunityIds);
    setRecentlyAddedPage(nextPage);
    setLoadingMoreRecent(false);
  }, [loadingMoreRecent, hasMoreRecent, recentlyAddedPage, fetchRecentGems]);

  const handleLoadMoreNearby = useCallback(async () => {
    if (loadingMoreNearby || !hasMoreNearby) return;
    setLoadingMoreNearby(true);
    const nextPage = nearbyPage + 1;
    const { data: { user } } = await supabase.auth.getUser();
    const myCommunityIds = await fetchMyCommunityIds(user?.id ?? null);
    await fetchNearbyGems(nextPage, myCommunityIds, userCoords);
    setNearbyPage(nextPage);
    setLoadingMoreNearby(false);
  }, [loadingMoreNearby, hasMoreNearby, nearbyPage, fetchNearbyGems, userCoords]);

  useEffect(() => {
    checkIsPremium().then(setIsPremium);
  }, []);

  useEffect(() => {
    const fetchPreferredCategories = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('preferred_categories')
          .eq('id', user.id)
          .single();
        if (data?.preferred_categories?.length) {
          setPreferredCategories(data.preferred_categories);
        }
        return;
      }

      const raw = await AsyncStorage.getItem(PENDING_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { preferred_categories?: string[] };
        if (parsed.preferred_categories?.length) {
          setPreferredCategories(parsed.preferred_categories);
        }
      }
    };

    fetchPreferredCategories();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const myCommunityIds = await fetchMyCommunityIds(user?.id ?? null);
        await refreshDiscoverData(myCommunityIds);
      } finally {
        setInitialLoading(false);
      }
    };
    load();
    checkStreakBanner();
  }, [refreshDiscoverData, checkStreakBanner]);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const myCommunityIds = await fetchMyCommunityIds(user?.id ?? null);
        refreshDiscoverData(myCommunityIds);
        fetchFollowingGems(myCommunityIds);
      };
      load();
      checkStreakBanner();
    }, [refreshDiscoverData, fetchFollowingGems, checkStreakBanner]),
  );

  useEffect(() => {
    let channel: any = null;
    let cancelled = false;
    let isSubscribing = false;

    const setupSubscription = async () => {
      if (isSubscribing) return;
      isSubscribing = true;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        isSubscribing = false;
        return;
      }

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (cancelled) {
        isSubscribing = false;
        return;
      }

      setUnreadNotificationCount(count || 0);

      const channelName = 'notifications-badge-' + user.id;
      const existingChannels = supabase.getChannels();
      const existing = existingChannels.find((ch) => ch.topic === 'realtime:' + channelName);
      if (existing) {
        await supabase.removeChannel(existing);
      }

      if (cancelled) {
        isSubscribing = false;
        return;
      }

      channel = supabase
        .channel(channelName)
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

      isSubscribing = false;
    };

    setupSubscription();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, []);

  useEffect(() => {
    if (feedTab !== 'following') return;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const myCommunityIds = await fetchMyCommunityIds(user?.id ?? null);
      fetchFollowingGems(myCommunityIds);
    };
    load();
  }, [feedTab, fetchFollowingGems]);

  useEffect(() => {
    let results = allGems;
    if (activeCustomCategory) {
      results = results.filter((g) => g.custom_category_id === activeCustomCategory.id);
    } else if (activeMainCategory) {
      results = results.filter((g) => g.category === activeMainCategory.id);
    }
    if (activeSubcategory) {
      results = results.filter((g) => g.subcategory === activeSubcategory);
    }
    if (searchQuery.trim()) {
      results = results.filter(
        (g) =>
          g.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
    setFilteredGems(results);
  }, [activeCustomCategory, activeMainCategory, activeSubcategory, searchQuery, allGems]);

  const filteredGemOfTheDay = useMemo(
    () => (gemOfTheDay && matchesSearch(gemOfTheDay, searchQuery) ? gemOfTheDay : null),
    [gemOfTheDay, searchQuery],
  );

  const filteredTrendingGems = useMemo(
    () => sortByPreferences(trendingGems.filter((gem) => matchesSearch(gem, searchQuery))),
    [trendingGems, searchQuery, sortByPreferences],
  );

  const filteredRecentGems = useMemo(
    () => sortByPreferences(recentGems.filter((gem) => matchesSearch(gem, searchQuery))),
    [recentGems, searchQuery, sortByPreferences],
  );

  const filteredNearbyGems = useMemo(
    () => nearbyGems.filter((gem) => matchesSearch(gem, searchQuery)),
    [nearbyGems, searchQuery],
  );

  const filteredFollowingGems = useMemo(() => {
    const filteredIds = new Set(filteredGems.map((g) => g.id));
    return followingGems.filter(
      (gem) => matchesSearch(gem, searchQuery) && filteredIds.has(gem.id),
    );
  }, [followingGems, searchQuery, filteredGems]);

  const handleCategoryPress = async (cat: Category) => {
    if (cat.premium) {
      const isPremium = await checkIsPremium();
      if (!isPremium) {
        router.push('/paywall');
        return;
      }
    }
    hapticSelection();
    if (activeMainCategory?.id === cat.id) {
      setActiveMainCategory(null);
      setActiveSubcategory(null);
    } else {
      setActiveMainCategory(cat);
      setActiveSubcategory(null);
      setActiveCustomCategory(null);
    }
  };

  const handleCustomCategoryPress = (category: CustomCategory) => {
    hapticSelection();
    if (activeCustomCategory?.id === category.id) {
      setActiveCustomCategory(null);
    } else {
      setActiveCustomCategory(category);
      setActiveMainCategory(null);
      setActiveSubcategory(null);
    }
  };

  const handleGemSwipePress = async () => {
    const proceed = await requireAuth('/gem-swipe');
    if (!proceed) return;
    router.push('/gem-swipe');
  };

  const handleTripPlannerPress = async () => {
    const proceed = await requireAuth('/trip-planner');
    if (!proceed) return;
    router.push('/trip-planner');
  };

  const handleMessagesPress = async () => {
    const proceed = await requireAuth('/messages');
    if (!proceed) return;
    router.push('/messages');
  };

  const handleCommunitiesPress = async () => {
    const proceed = await requireAuth('/communities');
    if (!proceed) return;
    router.push('/communities');
  };

  const handleNotifications = async () => {
    const proceed = await requireAuth('/notifications');
    if (!proceed) return;
    router.push('/notifications');
  };

  const handleProfile = async () => {
    const proceed = await requireAuth('/profile');
    if (!proceed) return;
    router.push('/profile');
  };

  const renderLocalPickBadge = () => (
    <View style={styles.localPickBadge}>
      <Ionicons name="home" size={11} color={LOCAL_PICK_COLOR} />
      <Text style={styles.localPickBadgeText}>Local&apos;s Pick</Text>
    </View>
  );

  const renderPioneerBadge = () => (
    <View style={styles.pioneerBadge}>
      <Ionicons name="star" size={11} color={PIONEER_COLOR} />
      <Text style={styles.pioneerBadgeText}>Pioneer</Text>
    </View>
  );

  const renderCommunityBadge = (gem: GemWithProfile) => {
    if (!gem.community_id || !gem.communities) return null;
    const { name, icon, color } = gem.communities;

    return (
      <View
        style={[
          styles.communityBadge,
          { backgroundColor: color + '20', borderColor: color },
        ]}>
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={10}
          color={color}
        />
        <Text style={[styles.communityBadgeText, { color }]} numberOfLines={1}>
          {name}
        </Text>
      </View>
    );
  };

  const renderBestTimeHint = (bestTime: string | null | undefined) => {
    if (!bestTime) return null;
    return (
      <View style={styles.bestTimeHint}>
        <Ionicons name="time-outline" size={11} color={theme.coral} />
        <Text style={styles.bestTimeHintText} numberOfLines={1}>
          {bestTime}
        </Text>
      </View>
    );
  };

  const renderListCard = (
    gem: GemWithProfile,
    distanceMeters?: number | null,
    showBestTime = false,
    staggerIndex?: number,
  ) => {
    const username = gem.profiles?.username ?? 'unknown';

    const card = (
      <TouchableOpacity
        style={styles.listCard}
        onPress={() => router.push('/gem/' + gem.id)}
        activeOpacity={0.85}>
        <View style={styles.listCardImageWrap}>
          {gem.image_url ? (
            <Image
              source={{ uri: gem.image_url }}
              style={styles.listCardImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.listCardImage, styles.listCardImagePlaceholder]} />
          )}
        </View>
        <View style={styles.listCardContent}>
          {renderCommunityBadge(gem)}
          <View style={styles.listBadgeRow}>
            <View style={styles.listCategoryBadge}>
              <Text style={styles.listCategoryBadgeText}>{gem.category}</Text>
            </View>
            {gem.is_local_pick && renderLocalPickBadge()}
            {gem.is_first_in_area && renderPioneerBadge()}
          </View>
          <Text style={styles.listCardTitle} numberOfLines={1}>
            {gem.title}
          </Text>
          <Text style={styles.listCardUsername} numberOfLines={1} ellipsizeMode="tail">
            @{username}
          </Text>
          {showBestTime && renderBestTimeHint(gem.best_time)}
          <View style={styles.listCardMetaRow}>
            <View style={styles.listCardMetaItem}>
              <Ionicons name="heart-outline" size={12} color={theme.textSecondary} />
              <Text style={styles.listCardMetaText}>{likeCounts[gem.id] ?? 0}</Text>
            </View>
            {distanceMeters != null && (
              <>
                <Text style={styles.listCardMetaDivider}>|</Text>
                <View style={styles.listCardMetaItem}>
                  <Ionicons name="location-outline" size={12} color={theme.textSecondary} />
                  <Text style={styles.listCardMetaText}>{formatDistanceKm(distanceMeters)}</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );

    if (staggerIndex !== undefined) {
      return (
        <Reanimated.View
          key={gem.id}
          entering={FadeInDown.delay(staggerIndex * 60).duration(300)}>
          {card}
        </Reanimated.View>
      );
    }

    return (
      <View key={gem.id}>
        {card}
      </View>
    );
  };

  const renderTrendingCard = (gem: GemWithProfile, index: number) => {
    const username = gem.profiles?.username ?? 'unknown';

    return (
      <Reanimated.View
        key={gem.id}
        entering={FadeInDown.delay(index * 60).duration(300)}>
      <TouchableOpacity
        style={styles.trendingCard}
        onPress={() => router.push('/gem/' + gem.id)}
        activeOpacity={0.85}>
        <View style={styles.trendingImage}>
          {gem.image_url ? (
            <Image
              source={{ uri: gem.image_url }}
              style={styles.trendingImageFill}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.trendingImageFill, styles.trendingImagePlaceholder]} />
          )}
        </View>
        <View style={styles.trendingBody}>
          {renderCommunityBadge(gem)}
          {(gem.is_local_pick || gem.is_first_in_area) && (
            <View style={styles.trendingBadgeRow}>
              {gem.is_local_pick && renderLocalPickBadge()}
              {gem.is_first_in_area && renderPioneerBadge()}
            </View>
          )}
          <Text style={styles.trendingTitle} numberOfLines={2}>
            {gem.title}
          </Text>
          <View style={styles.trendingUserRow}>
            {gem.profiles?.avatar_url ? (
              <Image
                source={{ uri: gem.profiles.avatar_url }}
                style={styles.trendingAvatarImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.trendingAvatar}>
                <Text style={styles.trendingAvatarText}>{username[0]?.toUpperCase() ?? '?'}</Text>
              </View>
            )}
            <Text style={styles.trendingUsername}>@{username}</Text>
          </View>
          <View style={styles.trendingLikeRow}>
            <Ionicons name="heart-outline" size={12} color={theme.textSecondary} />
            <Text style={styles.trendingLikeText}>{likeCounts[gem.id] ?? 0}</Text>
          </View>
          {renderBestTimeHint(gem.best_time)}
        </View>
      </TouchableOpacity>
      </Reanimated.View>
    );
  };

  const renderMysteryGemCard = () => {
    if (!mysteryGem) return null;

    const username = mysteryGem.profiles?.username ?? 'unknown';

    return (
      <TouchableOpacity
        style={styles.mysteryCard}
        onPress={() => router.push('/gem/' + mysteryGem.id)}
        activeOpacity={0.85}>
        {mysteryGem.image_url ? (
          <Image
            source={{ uri: mysteryGem.image_url }}
            style={styles.mysteryImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.mysteryPlaceholder}>
            <View style={[styles.mysteryPlaceholderBase, { backgroundColor: theme.card }]} />
            <View
              style={[
                styles.mysteryPlaceholderGradient,
                { backgroundColor: theme.bgTertiary },
              ]}
            />
          </View>
        )}
        <View style={styles.mysteryOverlayBottom} />
        <View style={styles.mysteryBadge}>
          <Ionicons name="sparkles" size={12} color="#FFFFFF" />
          <Text style={styles.mysteryBadgeText}>MYSTERY GEM OF THE WEEK</Text>
        </View>
        <View style={styles.mysteryBottom}>
          <Text style={styles.mysteryTitle} numberOfLines={2}>
            {mysteryGem.title}
          </Text>
          <Text style={styles.mysteryCoords}>
            {formatCoordinates(mysteryGem.latitude, mysteryGem.longitude)}
          </Text>
          <View style={styles.mysteryMetaRow}>
            <Ionicons name="heart" size={11} color="rgba(255,255,255,0.85)" />
            <Text style={styles.mysteryMetaText}>
              {likeCounts[mysteryGem.id] ?? 0} · @{username}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderForYouContent = () => (
    <>
      {renderMysteryGemCard()}

      {filteredGemOfTheDay && (
        <>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Gem of the Day</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.accent} />
          </View>
          <TouchableOpacity
            style={styles.gemOfDayCard}
            onPress={() => router.push('/gem/' + filteredGemOfTheDay.id)}
            activeOpacity={0.85}>
            {filteredGemOfTheDay.image_url ? (
              <Image
                source={{ uri: filteredGemOfTheDay.image_url }}
                style={styles.gemOfDayImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.gemOfDayImage, styles.gemOfDayImagePlaceholder]} />
            )}
            <View style={styles.gemOfDayContent}>
              <View style={styles.gemOfDayLabel}>
                <Text style={styles.gemOfDayLabelText}>GEM OF THE DAY</Text>
              </View>
              <Text style={styles.gemOfDayTitle} numberOfLines={1}>
                {filteredGemOfTheDay.title}
              </Text>
              <Text style={styles.gemOfDayCoords}>
                {formatCoordinates(filteredGemOfTheDay.latitude, filteredGemOfTheDay.longitude)}
              </Text>
              <Text style={styles.gemOfDayMeta}>
                {filteredGemOfTheDay.category}
                {getGemDistance(filteredGemOfTheDay) != null
                  ? ` · ${formatDistanceKm(getGemDistance(filteredGemOfTheDay)!)}`
                  : ''}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {filteredTrendingGems.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Trending</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendingRow}>
            {filteredTrendingGems.map((gem, index) => renderTrendingCard(gem, index))}
          </ScrollView>
        </>
      )}

      {filteredRecentGems.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recently Added</Text>
          {filteredRecentGems.map((gem, index) => renderListCard(gem, undefined, true, index))}
          {hasMoreRecent && !searchQuery.trim() && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={handleLoadMoreRecent}
              disabled={loadingMoreRecent}
              activeOpacity={0.8}>
              <Text style={styles.loadMoreButtonText}>
                {loadingMoreRecent ? 'Loading...' : 'Load More'}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {locationAvailable && (
        <>
          <Text style={styles.sectionTitle}>Near You</Text>
          {filteredNearbyGems.length === 0 ? (
            <>
              <EmptyState
                icon={searchQuery.trim() ? 'search-outline' : 'location-outline'}
                title={
                  searchQuery.trim() ? 'No gems match your search' : 'No gems near you yet'
                }
                subtitle={
                  searchQuery.trim()
                    ? 'Try a different search term'
                    : 'Be the first to drop a gem nearby!'
                }
              />
              {hasMoreNearby && !searchQuery.trim() && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={handleLoadMoreNearby}
                  disabled={loadingMoreNearby}
                  activeOpacity={0.8}>
                  <Text style={styles.loadMoreButtonText}>
                    {loadingMoreNearby ? 'Loading...' : 'Load More'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              {filteredNearbyGems.map((gem) => renderListCard(gem, getGemDistance(gem)))}
              {hasMoreNearby && !searchQuery.trim() && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={handleLoadMoreNearby}
                  disabled={loadingMoreNearby}
                  activeOpacity={0.8}>
                  <Text style={styles.loadMoreButtonText}>
                    {loadingMoreNearby ? 'Loading...' : 'Load More'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </>
      )}
    </>
  );

  const renderFollowingContent = () => {
    if (followingGems.length === 0) {
      return (
        <View style={styles.followingEmpty}>
          <Ionicons name="people-outline" size={48} color={theme.accent} />
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

    if (filteredFollowingGems.length === 0) {
      return (
        <EmptyState
          icon="search-outline"
          title="No gems match your search"
          subtitle="Try a different search term"
        />
      );
    }

    return filteredFollowingGems.map((gem) => {
      const username = gem.profiles?.username ?? 'unknown';
      return (
        <View key={gem.id} style={styles.followingItem}>
          <Text style={styles.followingPostLabel}>@{username} posted a new gem</Text>
          {renderListCard(gem)}
        </View>
      );
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {streakBannerText && (
        <Animated.View style={[styles.streakBanner, { opacity: streakBannerOpacity }]}>
          <BlurView
            intensity={70}
            tint={isDark ? 'dark' : 'light'}
            style={{ borderRadius: 12, overflow: 'hidden' }}>
            <View
              style={{
                backgroundColor: theme.coral + 'CC',
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}>
              <Ionicons name="flame" size={18} color="#FFFFFF" />
              <Text style={styles.streakBannerText}>{streakBannerText}</Text>
            </View>
          </BlurView>
        </Animated.View>
      )}

      <View style={styles.headerRow}>
        <Text style={styles.title}>Discover</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleTripPlannerPress}
            activeOpacity={0.7}>
            <Ionicons name="airplane-outline" size={22} color={theme.text} />
            {!isPremium && <View style={styles.proBadgeDot} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleGemSwipePress}
            activeOpacity={0.7}>
            <Ionicons
              name="layers-outline"
              size={22}
              color={isPremium ? theme.coral : theme.text}
            />
            {!isPremium && <View style={styles.proBadgeDot} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleCommunitiesPress}
            activeOpacity={0.7}>
            <Ionicons name="people-circle-outline" size={22} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleMessagesPress}
            activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={24} color={theme.text} />
            {hasUnreadMessages && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={theme.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search gems..."
          placeholderTextColor={theme.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 8 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }}>
        {initialLoading ? (
          <>
            {[80, 100, 90, 85].map((width, i) => (
              <View key={i} style={{ width, marginRight: 10 }}>
                <SkeletonCard height={32} borderRadius={20} />
              </View>
            ))}
          </>
        ) : null}
        {!initialLoading && (
        <>
        <TouchableOpacity
          style={{
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 20,
            marginRight: 10,
            backgroundColor:
              activeMainCategory === null && activeCustomCategory === null
                ? theme.accent
                : theme.card,
            borderWidth: 1,
            borderColor: theme.border,
          }}
          onPress={() => {
            hapticSelection();
            setActiveMainCategory(null);
            setActiveSubcategory(null);
            setActiveCustomCategory(null);
          }}>
          <Text
            style={{
              color:
                activeMainCategory === null && activeCustomCategory === null
                  ? theme.accentText
                  : theme.text,
              fontSize: 14,
              fontWeight: '600',
            }}>
            All
          </Text>
        </TouchableOpacity>

        {CATEGORIES.map((cat) => {
          const isSelected = activeMainCategory?.id === cat.id;
          const chipTextColor = isSelected ? '#FFFFFF' : theme.text;
          return (
            <TouchableOpacity
              key={cat.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 20,
                marginRight: 10,
                backgroundColor: isSelected ? cat.color : theme.card,
                borderWidth: 1,
                borderColor: theme.border,
              }}
              onPress={() => handleCategoryPress(cat)}>
              <Ionicons name={cat.icon as any} size={14} color={chipTextColor} aria-hidden={true} />
              <Text
                style={{
                  color: chipTextColor,
                  fontSize: 14,
                  fontWeight: '600',
                }}>
                {cat.name}
                {cat.premium ? ' 💎' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}

        {customCategories.map((cat) => {
          const isSelected = activeCustomCategory?.id === cat.id;
          const chipTextColor = isSelected ? '#FFFFFF' : theme.text;
          return (
            <TouchableOpacity
              key={cat.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 20,
                marginRight: 10,
                backgroundColor: isSelected ? cat.color : theme.card,
                borderWidth: 1,
                borderColor: theme.border,
              }}
              onPress={() => handleCustomCategoryPress(cat)}>
              <Ionicons
                name={cat.icon as keyof typeof Ionicons.glyphMap}
                size={14}
                color={chipTextColor}
                aria-hidden={true}
              />
              <Text
                style={{
                  color: chipTextColor,
                  fontSize: 14,
                  fontWeight: '600',
                }}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
        </>
        )}
      </ScrollView>

      {activeMainCategory && !activeCustomCategory && (
        <View style={{ marginVertical: 10 }}>
          <Text
            style={{
              color: theme.textSecondary,
              fontSize: 12,
              marginBottom: 6,
              marginLeft: 16,
            }}>
            Filter by:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ paddingLeft: 16 }}>
            {activeMainCategory.subcategories.map((sub) => {
              const isSelected = activeSubcategory === sub;
              return (
                <TouchableOpacity
                  key={sub}
                  style={{
                    backgroundColor: isSelected ? activeMainCategory.color : theme.card,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 20,
                    paddingHorizontal: 18,
                    paddingVertical: 10,
                    marginRight: 10,
                  }}
                  onPress={() => {
                    hapticSelection();
                    setActiveSubcategory(activeSubcategory === sub ? null : sub);
                  }}
                  activeOpacity={0.7}>
                  <Text
                    style={{
                      color: isSelected ? '#FFFFFF' : theme.text,
                      fontSize: 14,
                      fontWeight: '600',
                    }}>
                    {sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={styles.feedTabContainer}>
        {(
          [
            { key: 'forYou' as const, label: 'For You' },
            { key: 'following' as const, label: 'Following' },
          ] as const
        ).map((tab) => {
          const isActive = feedTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.feedTab, isActive && styles.feedTabActive]}
              onPress={() => {
                hapticSelection();
                setFeedTab(tab.key);
              }}
              activeOpacity={0.8}>
              <Text style={[styles.feedTabText, isActive && styles.feedTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {feedError && <ErrorBanner message={feedError} onRetry={handleRetryFeed} />}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + insets.bottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }>
        {initialLoading ? (
          <View style={{ padding: 16 }}>
            <SkeletonCard height={160} borderRadius={16} />
            <SkeletonCard height={90} />
            <SkeletonCard height={90} />
            <SkeletonCard height={90} />
          </View>
        ) : feedTab === 'forYou' ? (
          renderForYouContent()
        ) : (
          renderFollowingContent()
        )}
      </ScrollView>

      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          borderTopWidth: 0.5,
          borderTopColor: theme.border,
        }}>
        <View style={[styles.tabBar, { paddingBottom: 8 + insets.bottom }]}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const isAddButton = 'addButton' in tab && tab.addButton;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabItem}
                onPress={async () => {
                  hapticSelection();
                  if (tab.key === 'discover') {
                    setActiveTab('discover');
                  } else if (tab.key === 'map') {
                    router.push('/map');
                    setActiveTab(tab.key);
                  } else if (tab.key === 'add') {
                    const proceed = await requireAuth('/add-gem');
                    if (!proceed) return;
                    router.push('/add-gem');
                    setActiveTab(tab.key);
                  } else if (tab.key === 'notifications') {
                    await handleNotifications();
                    setActiveTab(tab.key);
                  } else if (tab.key === 'profile') {
                    await handleProfile();
                    setActiveTab(tab.key);
                  }
                }}
                activeOpacity={0.7}>
                <View style={styles.tabIconWrap}>
                  <TabBarIcon
                    isActive={isActive}
                    icon={tab.icon}
                    activeIcon={tab.activeIcon}
                    size={isAddButton ? 34 : 24}
                    color={isAddButton ? theme.accent : isActive ? theme.accent : theme.textTertiary}
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
      </BlurView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  streakBanner: {
    position: 'absolute',
    top: 56,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  streakBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: 'SpaceGrotesk-Bold',
    color: theme.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    position: 'relative',
    padding: 4,
  },
  proBadgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.coral,
  },
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.danger,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.text,
    paddingVertical: 0,
  },
  feedTabContainer: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: 226,
    backgroundColor: theme.card,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: theme.border,
    padding: 3,
    marginBottom: 16,
  },
  feedTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 20,
  },
  feedTabActive: {
    backgroundColor: theme.accent,
  },
  feedTabText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  feedTabTextActive: {
    color: theme.accentText,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mysteryCard: {
    width: '100%',
    height: 190,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  mysteryImage: {
    width: '100%',
    height: '100%',
  },
  mysteryPlaceholder: {
    ...StyleSheet.absoluteFillObject,
  },
  mysteryPlaceholderBase: {
    ...StyleSheet.absoluteFillObject,
  },
  mysteryPlaceholderGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '65%',
  },
  mysteryOverlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  mysteryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.coral,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  mysteryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mysteryBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  mysteryTitle: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 21,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  mysteryCoords: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  mysteryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mysteryMetaText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
  },
  gemOfDayCard: {
    flexDirection: 'row',
    height: 110,
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
  },
  gemOfDayImage: {
    width: 86,
    height: '100%',
  },
  gemOfDayImagePlaceholder: {
    backgroundColor: theme.bgTertiary,
  },
  gemOfDayContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    gap: 3,
  },
  gemOfDayLabel: {
    alignSelf: 'flex-start',
    backgroundColor: theme.coral,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  gemOfDayLabelText: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk-Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  gemOfDayTitle: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk-Bold',
    color: theme.text,
  },
  gemOfDayCoords: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: theme.textSecondary,
  },
  gemOfDayMeta: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  trendingRow: {
    gap: 12,
    paddingBottom: 4,
    marginBottom: 24,
  },
  trendingCard: {
    width: 160,
    height: 210,
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  trendingImage: {
    height: 130,
    backgroundColor: theme.bgTertiary,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  trendingImageFill: {
    width: '100%',
    height: '100%',
  },
  trendingImagePlaceholder: {
    backgroundColor: theme.bgTertiary,
  },
  trendingBody: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  trendingTitle: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk-Bold',
    color: theme.text,
  },
  trendingUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  trendingAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendingAvatarImage: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  trendingAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.background,
  },
  trendingUsername: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  trendingLikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  trendingLikeText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  listCard: {
    flexDirection: 'row',
    height: 90,
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  listCardImageWrap: {
    width: 90,
    height: 90,
  },
  listCardImage: {
    width: 90,
    height: 90,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  listCardImagePlaceholder: {
    backgroundColor: theme.bgTertiary,
  },
  listCardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  listBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  listCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.accentSub,
    borderWidth: 0.5,
    borderColor: theme.accent,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  localPickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LOCAL_PICK_COLOR + '20',
    borderWidth: 0.5,
    borderColor: LOCAL_PICK_COLOR,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  localPickBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: LOCAL_PICK_COLOR,
  },
  pioneerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PIONEER_COLOR + '20',
    borderWidth: 0.5,
    borderColor: PIONEER_COLOR,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  pioneerBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: PIONEER_COLOR,
  },
  trendingBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  communityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
    maxWidth: '100%',
  },
  communityBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  listCategoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  listCardTitle: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk-Bold',
    color: theme.text,
  },
  listCardUsername: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  listCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listCardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listCardMetaText: {
    fontSize: 11,
    fontFamily: 'SpaceMono-Regular',
    color: theme.textSecondary,
  },
  listCardMetaDivider: {
    fontSize: 11,
    color: theme.textTertiary,
  },
  bestTimeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  bestTimeHintText: {
    fontSize: 10,
    color: theme.coral,
    flexShrink: 1,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingVertical: 16,
  },
  loadMoreButton: {
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  loadMoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent,
  },
  followingItem: {
    marginBottom: 4,
  },
  followingPostLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  followingEmpty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  followingEmptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  exploreButton: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  exploreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.background,
  },
  tabBar: {
    flexDirection: 'row',
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
    backgroundColor: theme.danger,
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
    color: theme.textTertiary,
  },
  tabLabelActive: {
    color: theme.textSecondary,
    fontWeight: '600',
  },
});
