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
import { getDistance } from '@/lib/distance';
import { hapticSelection } from '@/lib/haptics';
import { getMysteryGemOfTheWeek } from '@/lib/mysteryGem';
import { getMyBlockedUsers } from '@/lib/safety';
import { consumeLastStreakResult } from '@/lib/streak';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const ACCENT_MUTED = '#A8D5BA';
const IMAGE_PLACEHOLDER = '#1A5C3A';
const LOCAL_PICK_COLOR = '#7F77DD';

const DISCOVER_GEM_SELECT =
  '*, profiles!gems_user_id_fkey(username, avatar_url), communities(name, icon, color)';

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
  const [nearbyGems, setNearbyGems] = useState<GemWithProfile[]>([]);
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

    const { data: gems } = await query;

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

    const filterBlocked = <T extends { user_id: string }>(gems: T[]): T[] =>
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

      const { data } = await query;

      if (data && data.length > 0) {
        const eligible = filterBlocked(data as GemWithProfile[]);
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

      const { data } = await query;

      if (data) {
        const filtered = filterBlocked(data as GemWithProfile[]);
        setTrendingGems(filtered);
        fetchLikeCounts(filtered as Gem[]);
      }
    };

    const fetchRecent = async () => {
      let query = supabase
        .from('gems')
        .select(DISCOVER_GEM_SELECT)
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .limit(10);

      query = applyCommunityGemFilter(query, myCommunityIds);

      const { data } = await query;

      if (data) {
        const filtered = filterBlocked(data as GemWithProfile[]);
        setRecentGems(filtered);
        fetchLikeCounts(filtered as Gem[]);
      }
    };

    const fetchAllGems = async () => {
      let query = supabase
        .from('gems')
        .select(DISCOVER_GEM_SELECT)
        .eq('is_private', false);

      query = applyCommunityGemFilter(query, myCommunityIds);

      const { data } = await query;

      if (data) setAllGems(filterBlocked(data as GemWithProfile[]));
    };

    const fetchNearby = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationAvailable(false);
        setUserCoords(null);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocationAvailable(true);
      setUserCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      let query = supabase
        .from('gems')
        .select(DISCOVER_GEM_SELECT)
        .eq('is_private', false);

      query = applyCommunityGemFilter(query, myCommunityIds);

      const { data } = await query;

      if (data) {
        const nearby = filterBlocked(data as GemWithProfile[])
          .map((gem) => ({
            gem,
            distance: getDistance(
              location.coords.latitude,
              location.coords.longitude,
              gem.latitude,
              gem.longitude,
            ),
          }))
          .filter(({ distance }) => distance < 50000)
          .sort((a, b) => a.distance - b.distance)
          .map(({ gem }) => gem);

        setNearbyGems(nearby);
        fetchLikeCounts(nearby);
      }
    };

    fetchMysteryGem();
    fetchGemOfTheDay();
    fetchTrending();
    fetchRecent();
    fetchAllGems();
    fetchNearby();
    checkUnreadMessages();
    checkUnreadNotifications();

    const loadCustomCategories = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const categories = await fetchVisibleCustomCategories(user.id);
      setCustomCategories(categories);
    };
    loadCustomCategories();
  }, [checkUnreadMessages, checkUnreadNotifications, fetchLikeCounts]);

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
      const { data: { user } } = await supabase.auth.getUser();
      const myCommunityIds = await fetchMyCommunityIds(user?.id ?? null);
      refreshDiscoverData(myCommunityIds);
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
            <Image source={{ uri: gem.image_url }} style={styles.listCardImage} />
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
          </View>
          <Text style={styles.listCardTitle} numberOfLines={1}>
            {gem.title}
          </Text>
          <Text style={styles.listCardUsername}>@{username}</Text>
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
            <Image source={{ uri: gem.image_url }} style={styles.trendingImageFill} />
          ) : (
            <View style={[styles.trendingImageFill, styles.trendingImagePlaceholder]} />
          )}
        </View>
        <View style={styles.trendingBody}>
          {renderCommunityBadge(gem)}
          {gem.is_local_pick && (
            <View style={styles.trendingBadgeRow}>{renderLocalPickBadge()}</View>
          )}
          <Text style={styles.trendingTitle} numberOfLines={2}>
            {gem.title}
          </Text>
          <View style={styles.trendingUserRow}>
            {gem.profiles?.avatar_url ? (
              <Image source={{ uri: gem.profiles.avatar_url }} style={styles.trendingAvatarImage} />
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
          <Image source={{ uri: mysteryGem.image_url }} style={styles.mysteryImage} />
        ) : (
          <View style={styles.mysteryPlaceholder}>
            <View style={[styles.mysteryPlaceholderBase, { backgroundColor: theme.card }]} />
            <View
              style={[
                styles.mysteryPlaceholderGradient,
                { backgroundColor: theme.backgroundTertiary },
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
          <Text style={styles.sectionTitle}>Gem of the Day</Text>
          <TouchableOpacity
            style={styles.heroCard}
            onPress={() => router.push('/gem/' + filteredGemOfTheDay.id)}
            activeOpacity={0.85}>
            {filteredGemOfTheDay.image_url ? (
              <Image source={{ uri: filteredGemOfTheDay.image_url }} style={styles.heroImage} />
            ) : (
              <View style={[styles.heroImage, styles.heroImagePlaceholder]} />
            )}
            <View style={styles.heroOverlay} />
            <View style={styles.heroLabel}>
              <Text style={styles.heroLabelText}>GEM OF THE DAY</Text>
            </View>
            <View style={styles.heroBottom}>
              <View style={styles.heroBottomText}>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {filteredGemOfTheDay.title}
                </Text>
                <Text style={styles.heroMeta}>
                  {filteredGemOfTheDay.category}
                  {getGemDistance(filteredGemOfTheDay) != null
                    ? ` · ${formatDistanceKm(getGemDistance(filteredGemOfTheDay)!)}`
                    : ''}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={theme.text} />
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
        </>
      )}

      {locationAvailable && (
        <>
          <Text style={styles.sectionTitle}>Near You</Text>
          {filteredNearbyGems.length === 0 ? (
            <Text style={styles.emptyText}>No gems near you yet — be the first!</Text>
          ) : (
            filteredNearbyGems.map((gem) => renderListCard(gem, getGemDistance(gem)))
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
      return <Text style={styles.emptyText}>No gems match your search.</Text>;
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
        <TouchableOpacity
          style={{
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 20,
            marginRight: 10,
            backgroundColor:
              activeMainCategory === null && activeCustomCategory === null
                ? '#1D9E75'
                : 'rgba(255,255,255,0.15)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.4)',
          }}
          onPress={() => {
            hapticSelection();
            setActiveMainCategory(null);
            setActiveSubcategory(null);
            setActiveCustomCategory(null);
          }}>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: '600',
            }}>
            All
          </Text>
        </TouchableOpacity>

        {CATEGORIES.map((cat) => (
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
              backgroundColor: activeMainCategory?.id === cat.id ? cat.color : 'rgba(255,255,255,0.15)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.4)',
            }}
            onPress={() => handleCategoryPress(cat)}>
            <Ionicons name={cat.icon as any} size={14} color="#FFFFFF" aria-hidden={true} />
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: '600',
              }}>
              {cat.name}
              {cat.premium ? ' 💎' : ''}
            </Text>
          </TouchableOpacity>
        ))}

        {customCategories.map((cat) => (
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
              backgroundColor:
                activeCustomCategory?.id === cat.id ? cat.color : 'rgba(255,255,255,0.15)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.4)',
            }}
            onPress={() => handleCustomCategoryPress(cat)}>
            <Ionicons
              name={cat.icon as keyof typeof Ionicons.glyphMap}
              size={14}
              color="#FFFFFF"
              aria-hidden={true}
            />
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: '600',
              }}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
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
            {activeMainCategory.subcategories.map((sub) => (
              <TouchableOpacity
                key={sub}
                style={{
                  backgroundColor: activeSubcategory === sub ? activeMainCategory.color : 'rgba(255,255,255,0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.4)',
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
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: '600',
                  }}>
                  {sub}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

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
          <Text
            style={[styles.feedTabText, feedTab === 'following' && styles.feedTabTextActive]}>
            Following
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + insets.bottom }]}>
        {feedTab === 'forYou' ? renderForYouContent() : renderFollowingContent()}
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
                  <Ionicons
                    name={isActive ? tab.activeIcon : tab.icon}
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
    backgroundColor: theme.card,
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
    backgroundColor: theme.accent,
  },
  feedTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  feedTabTextActive: {
    color: theme.background,
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
  mysteryCard: {
    width: '100%',
    height: 160,
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
    fontSize: 18,
    color: '#FFFFFF',
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
  heroCard: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroImagePlaceholder: {
    backgroundColor: IMAGE_PLACEHOLDER,
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  heroLabel: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: theme.coral,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  heroLabelText: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk-Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 16,
  },
  heroBottomText: {
    flex: 1,
    marginRight: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk-Bold',
    color: theme.text,
    marginBottom: 4,
  },
  heroMeta: {
    fontSize: 12,
    fontFamily: 'SpaceMono-Regular',
    color: ACCENT_MUTED,
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
  },
  trendingImage: {
    height: 130,
    backgroundColor: IMAGE_PLACEHOLDER,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  trendingImageFill: {
    width: '100%',
    height: '100%',
  },
  trendingImagePlaceholder: {
    backgroundColor: IMAGE_PLACEHOLDER,
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
    backgroundColor: IMAGE_PLACEHOLDER,
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
    backgroundColor: theme.accentSubtle,
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
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  localPickBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: LOCAL_PICK_COLOR,
  },
  trendingBadgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  communityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
    maxWidth: '100%',
  },
  communityBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    flexShrink: 1,
  },
  listCategoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.accent,
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
    color: theme.accent,
    fontWeight: '600',
  },
});
