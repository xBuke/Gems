import { requireAuth } from '@/lib/authGuard';
import { CATEGORIES } from '@/lib/categories';
import { searchCities } from '@/lib/cityAutocomplete';
import type { CustomCategory } from '@/lib/customCategories';
import { getDistance } from '@/lib/distance';
import { checkLocaleExpertBadge } from '@/lib/localeExpert';
import {
  ACHIEVEMENTS,
  checkAndUnlockAchievements,
  getExplorerLevel,
  getExplorerLevelIndex,
  getMasteryTier,
  getNextLevel,
  getNextMasteryTier,
  MASTERY_TIERS,
} from '@/lib/gamification';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { compressImage } from '@/lib/imageCompress';
import { checkIsPremium } from '@/lib/paywall';
import { blockUser } from '@/lib/safety';
import { navigateToGemWithSharedTransition } from '@/lib/gemSharedTransition';
import { goBackOrTab, useTabRootBackHandler, useTabStackGesture } from '@/lib/navigationMotion';
import { useReduceMotion } from '@/lib/ReduceMotionContext';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { useToast } from '@/lib/ToastContext';
import { supabase } from '@/lib/supabase';
import { AchievementUnlockModal } from '@/components/AchievementUnlockModal';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { PressableScale } from '@/components/PressableScale';
import ReportSheet from '@/components/ReportSheet';
import { SkeletonCard } from '@/components/SkeletonCard';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, Fragment, type ReactNode } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const IMAGE_PLACEHOLDER = '#1A5C3A';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Profile = {
  id: string;
  username: string;
  avatar_url?: string | null;
  current_streak?: number;
  streak_points?: number;
  is_private?: boolean;
  liked_gems_public?: boolean;
  visited_gems_public?: boolean;
  home_town?: string | null;
  home_lat?: number | null;
  home_lng?: number | null;
};

type UnlockedAchievement = {
  badge_type: string;
};

type AccordionPanel = 'gems' | 'liked' | 'visited' | 'achievements' | 'categoryMastery';

type ExplorationMode = 'city' | 'country';

type VisitedGemRow = {
  gem_id: string;
  gems: { latitude: number; longitude: number; title: string } | null;
};

type ExplorationStats = {
  exploredCount: number;
  totalCount: number;
  hasCenter: boolean;
};

type CitySuggestion = { name: string; lat: number; lng: number };

type SelectedCity = { name: string; lat: number; lng: number };

type LocaleBadge = {
  id: string;
  user_id: string;
  city_name: string;
  lat: number;
  lng: number;
};

const CITY_RADIUS_M = 25_000;
const COUNTRY_RADIUS_M = 200_000;

type GemLinkRow = { gem: Gem | null };

type FollowRequest = {
  follower_id: string;
  following_id: string;
  follower: { username: string } | null;
};

type Gem = {
  id: string;
  title: string;
  category: string;
  image_url: string | null;
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
};

type ProfileGemThumbnailProps = {
  gem: Gem;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
  isOwnProfile: boolean;
  onDelete: (gemId: string, imageUrl: string | null) => void;
  router: ReturnType<typeof useRouter>;
  reduceMotion: boolean;
};

function ProfileGemThumbnail({
  gem,
  styles,
  theme,
  isOwnProfile,
  onDelete,
  router,
  reduceMotion,
}: ProfileGemThumbnailProps) {
  const imageRef = useRef<View>(null);
  const titleRef = useRef<View>(null);

  return (
    <TouchableOpacity
      style={styles.gemThumbnail}
      onPress={() =>
        navigateToGemWithSharedTransition(router, gem, { imageRef, titleRef }, reduceMotion)
      }
      onLongPress={
        isOwnProfile
          ? () =>
              Alert.alert('Delete Gem', gem.title + ' will be deleted permanently.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => onDelete(gem.id, gem.image_url),
                },
              ])
          : undefined
      }
      activeOpacity={0.85}>
      <View ref={imageRef} style={styles.gemThumbnailImageWrap} collapsable={false}>
        {gem.image_url ? (
          <Image
            source={{ uri: gem.image_url }}
            style={styles.gemThumbnailImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.gemThumbnailPlaceholder}>
            <Ionicons name="location" size={20} color={theme.accent} />
          </View>
        )}
      </View>
      <View ref={titleRef} style={styles.gemThumbnailMeasureTitle} collapsable={false} pointerEvents="none">
        <Text style={styles.gemThumbnailMeasureTitleText} numberOfLines={1}>
          {gem.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const PROFILE_GRID_MAX_SLOTS = 9;
const PROFILE_GRID_COLUMNS = 3;

const parseGemLinkRows = (rows: GemLinkRow[] | null): Gem[] =>
  (rows ?? []).map((row) => row.gem).filter((gem): gem is Gem => gem != null);

const getExplorationCenter = (
  profile: Profile | null,
  visitedRows: VisitedGemRow[],
): { lat: number; lng: number } | null => {
  if (profile?.home_lat != null && profile?.home_lng != null) {
    return { lat: profile.home_lat, lng: profile.home_lng };
  }

  const clusters: Record<string, { count: number; lat: number; lng: number }> = {};
  for (const visit of visitedRows) {
    const gem = visit.gems;
    if (gem?.latitude == null || gem?.longitude == null) continue;
    const key = `${gem.latitude.toFixed(2)},${gem.longitude.toFixed(2)}`;
    if (!clusters[key]) {
      clusters[key] = {
        count: 0,
        lat: Number(gem.latitude.toFixed(2)),
        lng: Number(gem.longitude.toFixed(2)),
      };
    }
    clusters[key].count += 1;
  }

  let best: { count: number; lat: number; lng: number } | null = null;
  for (const cluster of Object.values(clusters)) {
    if (!best || cluster.count > best.count) best = cluster;
  }

  return best ? { lat: best.lat, lng: best.lng } : null;
};

const computeExplorationStats = (
  center: { lat: number; lng: number },
  radiusM: number,
  visitedRows: VisitedGemRow[],
  publicGems: { id: string; latitude: number; longitude: number }[],
): ExplorationStats => {
  const exploredGemIds = new Set<string>();
  for (const visit of visitedRows) {
    const gem = visit.gems;
    if (!gem) continue;
    if (getDistance(center.lat, center.lng, gem.latitude, gem.longitude) <= radiusM) {
      exploredGemIds.add(visit.gem_id);
    }
  }

  const totalCount = publicGems.filter(
    (gem) => getDistance(center.lat, center.lng, gem.latitude, gem.longitude) <= radiusM,
  ).length;

  return {
    exploredCount: exploredGemIds.size,
    totalCount,
    hasCenter: true,
  };
};

const getMasteryTierIndex = (visits: number) => {
  let index = 0;
  for (let i = 0; i < MASTERY_TIERS.length; i += 1) {
    if (visits >= MASTERY_TIERS[i].minVisits) index = i;
  }
  return index;
};

const getMasteryTierColors = (tierIndex: number, categoryColor: string, theme: Theme) => {
  if (tierIndex === 0) {
    return {
      badgeBg: theme.textTertiary + '25',
      badgeText: theme.textTertiary,
      progressColor: theme.textTertiary,
    };
  }

  const intensity = tierIndex / (MASTERY_TIERS.length - 1);
  const opacity = Math.round(32 + intensity * 200)
    .toString(16)
    .padStart(2, '0');

  return {
    badgeBg: categoryColor + opacity,
    badgeText: tierIndex === MASTERY_TIERS.length - 1 ? categoryColor : theme.text,
    progressColor: categoryColor,
  };
};

const uploadAvatar = async (uri: string, userId: string) => {
  const compressedUri = await compressImage(uri);
  const fileName = `avatar_${userId}_${Date.now()}.jpg`;

  const formData = new FormData();
  formData.append('file', {
    uri: compressedUri,
    name: fileName,
    type: 'image/jpeg',
  } as any);

  const { error } = await supabase.storage.from('avatars').upload(fileName, formData, {
    contentType: 'multipart/form-data',
  });

  if (error) {
    console.error('Avatar upload error:', error);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

  await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);

  return publicUrl;
};

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gems, setGems] = useState<Gem[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  useTabRootBackHandler(isOwnProfile);
  useTabStackGesture(router);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [followRequestsExpanded, setFollowRequestsExpanded] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [likedGems, setLikedGems] = useState<Gem[]>([]);
  const [visitedGems, setVisitedGems] = useState<Gem[]>([]);
  const [expandedPanel, setExpandedPanel] = useState<AccordionPanel | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [unlockedAchievementTypes, setUnlockedAchievementTypes] = useState<string[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [explorationMode, setExplorationMode] = useState<ExplorationMode>('city');
  const [cityExploration, setCityExploration] = useState<ExplorationStats>({
    exploredCount: 0,
    totalCount: 0,
    hasCenter: false,
  });
  const [countryExploration, setCountryExploration] = useState<ExplorationStats>({
    exploredCount: 0,
    totalCount: 0,
    hasCenter: false,
  });
  const [cityQuery, setCityQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<SelectedCity | null>(null);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingCities, setSearchingCities] = useState(false);
  const [localeBadges, setLocaleBadges] = useState<LocaleBadge[]>([]);
  const [unlockedBadge, setUnlockedBadge] = useState<string | null>(null);
  const citySearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMyCustomCategories = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isOwn = !userId || userId === user.id;
    if (!isOwn) {
      setIsPremium(false);
      setCustomCategories([]);
      return;
    }

    const premium = await checkIsPremium();
    setIsPremium(premium);

    if (premium) {
      const { data: categoriesData } = await supabase
        .from('custom_categories')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });
      setCustomCategories((categoriesData as CustomCategory[]) ?? []);
    } else {
      setCustomCategories([]);
    }
  }, [userId]);

  const fetchData = useCallback(async () => {
    try {
      setProfileError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfileLoading(false);
        return;
      }

      const isOwn = !userId || userId === user.id;
      const profileId = isOwn ? user.id : userId;

      setIsOwnProfile(isOwn);
      setCurrentUserId(user.id);

      await fetchMyCustomCategories();

      const { data: profileData, error: profileFetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (profileFetchError) {
        setProfileError('Something went wrong loading this profile. Tap retry to try again.');
        setProfileLoading(false);
        return;
      }

      if (profileData) {
        setProfile(profileData);

        if (isOwn) {
          setCityQuery((prev) => (prev === '' && profileData.home_town ? profileData.home_town : prev));
          setSelectedCity((prev) => {
            if (prev) return prev;
            if (
              profileData.home_town &&
              profileData.home_lat != null &&
              profileData.home_lng != null
            ) {
              return {
                name: profileData.home_town,
                lat: profileData.home_lat,
                lng: profileData.home_lng,
              };
            }
            return null;
          });
        }
      }

    const { data: achievementsData } = await supabase
      .from('achievements')
      .select('badge_type')
      .eq('user_id', profileId);
    setUnlockedAchievementTypes(
      (achievementsData as UnlockedAchievement[] | null)?.map((a) => a.badge_type) ?? [],
    );

    const likedPublic = profileData?.liked_gems_public !== false;
    const visitedPublic = profileData?.visited_gems_public !== false;

    const { data: gemsData } = await supabase
      .from('gems')
      .select('*')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false });
    if (gemsData) setGems(gemsData);

    const { count: following } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profileId)
      .eq('status', 'accepted');

    const { count: followers } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profileId)
      .eq('status', 'accepted');

    setFollowingCount(following ?? 0);
    setFollowersCount(followers ?? 0);

    if (!isOwn) {
      const { data: followData } = await supabase
        .from('follows')
        .select('status')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle();

      setIsFollowing(followData?.status === 'accepted');
      setIsRequested(followData?.status === 'pending');
      setFollowRequests([]);

      const otherUserFetches: Promise<void>[] = [];

      if (likedPublic) {
        otherUserFetches.push(
          supabase
            .from('gem_likes')
            .select('*, gem:gems(*)')
            .eq('user_id', profileId)
            .order('created_at', { ascending: false })
            .limit(6)
            .then(({ data: likedData }) => {
              setLikedGems(parseGemLinkRows(likedData as GemLinkRow[] | null));
            }),
        );
      } else {
        setLikedGems([]);
      }

      if (visitedPublic) {
        otherUserFetches.push(
          supabase
            .from('gem_visits')
            .select('*, gem:gems(*)')
            .eq('user_id', profileId)
            .order('created_at', { ascending: false })
            .limit(6)
            .then(({ data: visitedData }) => {
              setVisitedGems(parseGemLinkRows(visitedData as GemLinkRow[] | null));
            }),
        );
      } else {
        setVisitedGems([]);
      }

      await Promise.all(otherUserFetches);
    } else {
      setIsFollowing(false);
      setIsRequested(false);

      const { data: pendingRequests } = await supabase
        .from('follows')
        .select('*, follower:profiles!follows_follower_id_fkey(username)')
        .eq('following_id', user.id)
        .eq('status', 'pending');

      setFollowRequests((pendingRequests as FollowRequest[]) ?? []);

      const [{ data: likedData }, { data: visitedData }] = await Promise.all([
        supabase
          .from('gem_likes')
          .select('*, gem:gems(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('gem_visits')
          .select('*, gem:gems(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(6),
      ]);

      setLikedGems(parseGemLinkRows(likedData as GemLinkRow[] | null));
      setVisitedGems(parseGemLinkRows(visitedData as GemLinkRow[] | null));
    }

    setProfileLoading(false);
    } catch {
      setProfileError('Something went wrong loading this profile. Tap retry to try again.');
      setProfileLoading(false);
    }
  }, [userId, fetchMyCustomCategories]);

  const handleRetryProfile = useCallback(() => {
    setProfileError(null);
    setProfileLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const fetchCategoryMastery = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isOwn = !userId || userId === user.id;
    if (!isOwn) return;

    const { data: visits } = await supabase
      .from('gem_visits')
      .select('category')
      .eq('user_id', user.id);

    const counts: Record<string, number> = {};
    visits?.forEach((v: { category: string | null }) => {
      if (v.category) counts[v.category] = (counts[v.category] || 0) + 1;
    });
    setCategoryCounts(counts);
  }, [userId]);

  const fetchLocaleBadges = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isOwn = !userId || userId === user.id;
    const profileId = isOwn ? user.id : userId;
    if (!profileId) return;

    const { data: myLocaleBadges } = await supabase
      .from('locale_badges')
      .select('*')
      .eq('user_id', profileId);

    setLocaleBadges((myLocaleBadges as LocaleBadge[] | null) ?? []);
  }, [userId]);

  const fetchExplorationProgress = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isOwn = !userId || userId === user.id;
    if (!isOwn) return;

    const [{ data: profileData }, { data: visitedData }, { data: publicGems }] = await Promise.all([
      supabase
        .from('profiles')
        .select('home_lat, home_lng, home_town')
        .eq('id', user.id)
        .single(),
      supabase
        .from('gem_visits')
        .select('gem_id, gems(latitude, longitude, title)')
        .eq('user_id', user.id),
      supabase
        .from('gems')
        .select('id, latitude, longitude')
        .eq('is_private', false)
        .is('community_id', null),
    ]);

    const visitedRows = (visitedData as VisitedGemRow[] | null) ?? [];
    const gems = (publicGems as { id: string; latitude: number; longitude: number }[] | null) ?? [];

    let center: { lat: number; lng: number } | null = null;
    if (selectedCity) {
      center = { lat: selectedCity.lat, lng: selectedCity.lng };
    } else {
      center = getExplorationCenter(profileData as Profile | null, visitedRows);
    }

    if (!center) {
      setCityExploration({ exploredCount: 0, totalCount: 0, hasCenter: false });
      setCountryExploration({ exploredCount: 0, totalCount: 0, hasCenter: false });
      return;
    }

    // V1: radius-based proxy for city/country boundaries. True boundary detection
    // would require a proper geocoding service — a good V2 improvement.
    const cityStats = computeExplorationStats(center, CITY_RADIUS_M, visitedRows, gems);
    const countryStats = computeExplorationStats(center, COUNTRY_RADIUS_M, visitedRows, gems);
    setCityExploration(cityStats);
    setCountryExploration(countryStats);

    if (selectedCity) {
      const isNewLocaleExpert = await checkLocaleExpertBadge(
        user.id,
        selectedCity.name,
        selectedCity.lat,
        selectedCity.lng,
      );
      if (isNewLocaleExpert) {
        Alert.alert(
          '🏆 Locale Expert!',
          `You've explored over 90% of public gems in ${selectedCity.name}. You're a true local expert!`,
        );
        await fetchLocaleBadges();
      }
    }
  }, [userId, selectedCity, fetchLocaleBadges]);

  const handleCitySearchInput = useCallback((text: string) => {
    setCityQuery(text);

    if (citySearchDebounceRef.current) clearTimeout(citySearchDebounceRef.current);

    if (text.length < 2) {
      setShowSuggestions(false);
      setCitySuggestions([]);
      setSearchingCities(false);
      return;
    }

    setSearchingCities(true);
    citySearchDebounceRef.current = setTimeout(async () => {
      const results = await searchCities(text);
      setCitySuggestions(results);
      setShowSuggestions(results.length > 0);
      setSearchingCities(false);
    }, 400);
  }, []);

  const selectExplorationCity = (city: CitySuggestion) => {
    setCityQuery(city.name);
    setSelectedCity({ name: city.name, lat: city.lat, lng: city.lng });
    setShowSuggestions(false);
    setCitySuggestions([]);
  };

  const resetToHomeTown = () => {
    if (!profile?.home_town || profile.home_lat == null || profile.home_lng == null) return;

    setCityQuery(profile.home_town);
    setSelectedCity({
      name: profile.home_town,
      lat: profile.home_lat,
      lng: profile.home_lng,
    });
    setShowSuggestions(false);
    setCitySuggestions([]);
  };

  useFocusEffect(
    useCallback(() => {
      fetchCategoryMastery();
      fetchExplorationProgress();
      fetchLocaleBadges();
    }, [fetchCategoryMastery, fetchExplorationProgress, fetchLocaleBadges]),
  );

  useEffect(() => {
    if (isOwnProfile) {
      fetchExplorationProgress();
    }
  }, [selectedCity, isOwnProfile, fetchExplorationProgress]);

  const username = profile?.username ?? 'User';
  const initials = username.charAt(0).toUpperCase();

  const profileGrid = useMemo(() => {
    const addSlotCount = isOwnProfile ? 1 : 0;
    const availableForGems = PROFILE_GRID_MAX_SLOTS - addSlotCount;
    const needsOverflowTile = gems.length > availableForGems;
    const visibleGemCount = needsOverflowTile
      ? availableForGems - 1
      : Math.min(gems.length, availableForGems);
    const remainingCount = gems.length - visibleGemCount;

    return {
      visibleGems: gems.slice(0, visibleGemCount),
      remainingCount,
      needsOverflowTile,
    };
  }, [gems, isOwnProfile]);

  const profileId = isOwnProfile ? currentUserId : userId;

  const handleProfileBack = useCallback(() => {
    if (isOwnProfile) {
      goBackOrTab(router, 'index');
      return;
    }
    router.back();
  }, [isOwnProfile, router]);

  const handleAvatarPicked = async (uri: string) => {
    if (!currentUserId) return;

    setUploadingAvatar(true);
    const publicUrl = await uploadAvatar(uri, currentUserId);
    setUploadingAvatar(false);

    if (!publicUrl) {
      Alert.alert('Error', 'Could not upload profile photo');
      return;
    }

    await fetchData();
  };

  const openAvatarCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      await handleAvatarPicked(result.assets[0].uri);
    }
  };

  const openAvatarGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery access is required to choose a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      await handleAvatarPicked(result.assets[0].uri);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!currentUserId) return;

    await supabase.from('profiles').update({ avatar_url: null }).eq('id', currentUserId);
    await fetchData();
  };

  const handleAvatarPress = () => {
    if (!isOwnProfile || uploadingAvatar) return;

    const hasAvatar = !!profile?.avatar_url;
    const options = hasAvatar
      ? ['Take Photo', 'Choose from Library', 'Remove Photo', 'Cancel']
      : ['Take Photo', 'Choose from Library', 'Cancel'];
    const cancelIndex = options.length - 1;
    const removeIndex = hasAvatar ? 2 : -1;

    const handleSelection = (index: number) => {
      if (index === 0) openAvatarCamera();
      else if (index === 1) openAvatarGallery();
      else if (hasAvatar && index === removeIndex) {
        Alert.alert('Remove Photo', 'Remove your profile photo?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: handleRemoveAvatar },
        ]);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          destructiveButtonIndex: hasAvatar ? removeIndex : undefined,
        },
        handleSelection,
      );
    } else {
      const buttons = [
        { text: 'Take Photo', onPress: openAvatarCamera },
        { text: 'Choose from Library', onPress: openAvatarGallery },
      ];
      if (hasAvatar) {
        buttons.push({
          text: 'Remove Photo',
          onPress: () => {
            Alert.alert('Remove Photo', 'Remove your profile photo?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: handleRemoveAvatar },
            ]);
          },
        });
      }
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert('Profile Photo', 'Choose an option', buttons);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth');
        },
      },
    ]);
  };

  const handleFollow = async () => {
    if (!currentUserId || !userId || !profile) return;

    hapticLight();

    const isPrivate = profile.is_private === true;

    await supabase.from('follows').insert({
      follower_id: currentUserId,
      following_id: userId,
      status: isPrivate ? 'pending' : 'accepted',
    });

    await supabase.from('notifications').insert({
      user_id: userId,
      sender_id: currentUserId,
      type: isPrivate ? 'follow_request' : 'follow',
      gem_id: null,
      read: false,
    });

    if (isPrivate) {
      setIsRequested(true);
      showToast({
        type: 'info',
        title: 'Request sent',
        message: `Waiting for @${profile.username} to approve`,
      });
    } else {
      setIsFollowing(true);
      showToast({
        type: 'success',
        title: 'Following!',
        message: `@${profile.username} added to your feed`,
      });
    }
    await fetchData();
  };

  const performUnfollow = async () => {
    if (!currentUserId || !userId) return;

    hapticLight();

    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', userId);

    setIsFollowing(false);
    setIsRequested(false);
    await fetchData();
  };

  const handleUnfollow = () => {
    if (!currentUserId || !userId) return;

    if (isFollowing) {
      Alert.alert('Unfollow', `Stop following @${username}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unfollow', style: 'destructive', onPress: () => performUnfollow() },
      ]);
      return;
    }

    performUnfollow();
  };

  const handleAcceptRequest = async (followerId: string) => {
    if (!currentUserId) return;
    const { error } = await supabase
      .from('follows')
      .update({ status: 'accepted' })
      .eq('follower_id', followerId)
      .eq('following_id', currentUserId);
    if (!error) {
      hapticSuccess();
      setFollowRequests((prev) => prev.filter((r) => r.follower_id !== followerId));

      const { count: followers } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', currentUserId)
        .eq('status', 'accepted');
      setFollowersCount(followers ?? 0);

      const newAchievements = await checkAndUnlockAchievements(currentUserId);
      if (newAchievements.length > 0) {
        setUnlockedBadge(newAchievements[0]);
      }
    }
  };

  const handleDeclineRequest = async (followerId: string) => {
    if (!currentUserId) return;

    hapticLight();

    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', currentUserId);

    setFollowRequests((prev) => prev.filter((r) => r.follower_id !== followerId));
  };

  const showProfileMenu = () => {
    if (!userId || isOwnProfile) return;

    const options = ['Report User', 'Block User', 'Cancel'];
    const cancelIndex = 2;

    const handleSelection = (index: number) => {
      if (index === 0) setReportVisible(true);
      if (index === 1) {
        Alert.alert(
          `Block @${username}?`,
          'They won\'t be able to see your content and you won\'t see theirs.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                if (!currentUserId) return;
                await blockUser(currentUserId, userId);
                Alert.alert('Blocked', `@${username} has been blocked.`);
                router.back();
              },
            },
          ],
        );
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: 1 },
        handleSelection,
      );
    } else {
      Alert.alert('Options', undefined, [
        { text: 'Report User', onPress: () => setReportVisible(true) },
        {
          text: 'Block User',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              `Block @${username}?`,
              'They won\'t be able to see your content and you won\'t see theirs.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Block',
                  style: 'destructive',
                  onPress: async () => {
                    if (!currentUserId) return;
                    await blockUser(currentUserId, userId);
                    Alert.alert('Blocked', `@${username} has been blocked.`);
                    router.back();
                  },
                },
              ],
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleDeleteGem = async (gemId: string, imageUrl: string | null) => {
    if (imageUrl) {
      const fileName = imageUrl.split('/').pop();
      if (fileName) {
        await supabase.storage.from('gem-images').remove([fileName]);
      }
    }

    const { error } = await supabase.from('gems').delete().eq('id', gemId);

    if (error) {
      Alert.alert('Error', 'Could not delete gem');
      return;
    }

    setGems((prev) => prev.filter((g) => g.id !== gemId));
  };

  const handleSendMessage = async () => {
    if (!userId) return;

    const proceed = await requireAuth();
    if (!proceed) return;

    router.push({
      pathname: '/chat',
      params: { userId, username },
    });
  };

  const togglePanel = (panel: AccordionPanel) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPanel((prev) => (prev === panel ? null : panel));
  };

  const toggleLikedGemsPublic = async () => {
    if (!currentUserId || !profile) return;

    hapticLight();
    const newValue = profile.liked_gems_public === false;
    await supabase
      .from('profiles')
      .update({ liked_gems_public: newValue })
      .eq('id', currentUserId);
    setProfile({ ...profile, liked_gems_public: newValue });
  };

  const toggleVisitedGemsPublic = async () => {
    if (!currentUserId || !profile) return;

    hapticLight();
    const newValue = profile.visited_gems_public === false;
    await supabase
      .from('profiles')
      .update({ visited_gems_public: newValue })
      .eq('id', currentUserId);
    setProfile({ ...profile, visited_gems_public: newValue });
  };

  const likedGemsPublic = profile?.liked_gems_public !== false;
  const visitedGemsPublic = profile?.visited_gems_public !== false;
  const showLikedSection = isOwnProfile || likedGemsPublic;
  const showVisitedSection = isOwnProfile || visitedGemsPublic;
  const streakPoints = profile?.streak_points ?? 0;
  const explorerLevel = getExplorerLevel(streakPoints);
  const explorerLevelIndex = getExplorerLevelIndex(streakPoints);
  const nextLevel = getNextLevel(streakPoints);
  const xpToNextLevel = nextLevel ? nextLevel.minPoints - streakPoints : 0;
  const unlockedCount = unlockedAchievementTypes.length;
  const categoriesWithVisits = CATEGORIES.filter((cat) => (categoryCounts[cat.id] ?? 0) > 0);
  const visibleCategories = showAllCategories ? CATEGORIES : categoriesWithVisits;
  const activeExploration = explorationMode === 'city' ? cityExploration : countryExploration;
  const explorationPercent =
    activeExploration.totalCount > 0
      ? Math.round((activeExploration.exploredCount / activeExploration.totalCount) * 100)
      : 0;
  const explorationAreaLabel =
    explorationMode === 'city'
      ? selectedCity?.name
        ? `Your City: ${selectedCity.name}`
        : profile?.home_town
          ? `Your City: ${profile.home_town}`
          : 'Your City'
      : selectedCity?.name
        ? `Your Region: ${selectedCity.name}`
        : 'Your Region';

  const showResetHomeTown =
    isOwnProfile &&
    profile?.home_town &&
    selectedCity != null &&
    selectedCity.name !== profile.home_town;

  const renderLocaleExpertBadges = () => {
    if (localeBadges.length === 0) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.localeBadgesRow}>
        {localeBadges.map((badge) => (
          <View key={badge.id} style={styles.localeExpertChip}>
            <Text style={styles.localeExpertChipText}>🏆 {badge.city_name} Expert</Text>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderGemThumbnail = (gem: Gem) => (
    <ProfileGemThumbnail
      key={gem.id}
      gem={gem}
      styles={styles}
      theme={theme}
      isOwnProfile={isOwnProfile}
      onDelete={handleDeleteGem}
      router={router}
      reduceMotion={reduceMotion}
    />
  );

  const renderAddGemTile = () => (
    <TouchableOpacity
      key="add-gem-tile"
      style={styles.gemThumbnailAdd}
      onPress={() => router.push('/add-gem')}
      activeOpacity={0.85}>
      <Ionicons name="add" size={24} color={theme.accent} />
    </TouchableOpacity>
  );

  const renderOverflowTile = () => (
    <TouchableOpacity
      key="overflow-tile"
      style={styles.gemThumbnailOverflow}
      onPress={() =>
        profileId &&
        router.push({
          pathname: '/user-gems',
          params: { userId: profileId, username },
        })
      }
      activeOpacity={0.85}>
      <Text style={styles.gemThumbnailOverflowText}>+{profileGrid.remainingCount}</Text>
    </TouchableOpacity>
  );

  const renderProfileGridRow = (rowItems: ReactNode[], rowKey: string) => (
    <View key={rowKey} style={styles.gemThumbnailRow}>
      {rowItems}
      {rowItems.length < PROFILE_GRID_COLUMNS
        ? Array.from({ length: PROFILE_GRID_COLUMNS - rowItems.length }).map((_, index) => (
            <View key={`${rowKey}-spacer-${index}`} style={styles.gemThumbnailSpacer} />
          ))
        : null}
    </View>
  );

  const renderProfileGemsGrid = () => {
    const gridItems: ReactNode[] = [];

    if (isOwnProfile) {
      gridItems.push(renderAddGemTile());
    }

    profileGrid.visibleGems.forEach((gem) => {
      gridItems.push(renderGemThumbnail(gem));
    });

    if (profileGrid.needsOverflowTile) {
      gridItems.push(renderOverflowTile());
    }

    const rows = chunk(gridItems, PROFILE_GRID_COLUMNS);
    return (
      <View style={styles.gemsGrid}>
        {rows.map((row, index) => renderProfileGridRow(row, `profile-grid-row-${index}`))}
      </View>
    );
  };

  const renderHorizontalGemCard = (gem: Gem) => (
    <TouchableOpacity
      key={gem.id}
      style={styles.horizontalGemCard}
      onPress={() => router.push('/gem/' + gem.id)}
      activeOpacity={0.85}>
      <View style={styles.horizontalGemImage}>
        {gem.image_url ? (
          <Image
            source={{ uri: gem.image_url }}
            style={styles.horizontalGemImageFill}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.horizontalGemImageFill, styles.horizontalGemImagePlaceholder]}>
            <Ionicons name="location-outline" size={28} color={theme.accent} />
          </View>
        )}
      </View>
      <View style={styles.horizontalGemBody}>
        <View style={styles.horizontalCategoryBadge}>
          <Text style={styles.horizontalCategoryBadgeText}>{gem.category}</Text>
        </View>
        <Text style={styles.horizontalGemTitle} numberOfLines={2}>
          {gem.title}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderHorizontalGemList = (
    gemsList: Gem[],
    emptyIcon: string,
    emptyTitle: string,
    emptySubtitle?: string,
  ) =>
    gemsList.length === 0 ? (
      <EmptyState icon={emptyIcon} title={emptyTitle} subtitle={emptySubtitle} />
    ) : (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalGemRow}>
        {gemsList.map((gem) => renderHorizontalGemCard(gem))}
      </ScrollView>
    );

  const renderPrivacyToggle = (
    isPublic: boolean,
    onToggle: () => void,
  ) => (
    <TouchableOpacity
      style={styles.privacyToggle}
      onPress={onToggle}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons
        name={isPublic ? 'eye-outline' : 'eye-off-outline'}
        size={14}
        color={theme.textTertiary}
      />
      <Text style={styles.privacyToggleLabel}>{isPublic ? 'Public' : 'Private'}</Text>
    </TouchableOpacity>
  );

  const renderAccordionHeader = (
    panel: AccordionPanel,
    title: string,
    count: number,
    showPrivacy?: boolean,
    isPublic?: boolean,
    onTogglePrivacy?: () => void,
    totalCount?: number,
  ) => (
    <View style={styles.accordionHeaderRow}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={() => togglePanel(panel)}
        activeOpacity={0.7}>
        <Text style={styles.sectionTitle}>
          {totalCount != null ? `${title} (${count}/${totalCount})` : `${title} (${count})`}
        </Text>
        <Ionicons
          name={expandedPanel === panel ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.textSecondary}
        />
      </TouchableOpacity>
      {showPrivacy && onTogglePrivacy != null && isPublic != null
        ? renderPrivacyToggle(isPublic, onTogglePrivacy)
        : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleProfileBack} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {isOwnProfile ? (
          <TouchableOpacity onPress={() => router.push('/settings')} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
            <Ionicons name="settings-outline" size={22} color={theme.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={showProfileMenu} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
          </TouchableOpacity>
        )}
      </View>

      {profileError && !profileLoading && (
        <ErrorBanner message={profileError} onRetry={handleRetryProfile} />
      )}

      {profileLoading ? (
        <View style={{ padding: 16 }}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 88 }}>
              <SkeletonCard height={88} borderRadius={44} />
            </View>
          </View>
          <SkeletonCard height={70} borderRadius={12} />
          <SkeletonCard height={120} borderRadius={12} />
        </View>
      ) : (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.profileSection}>
          {isOwnProfile ? (
            <TouchableOpacity
              onPress={handleAvatarPress}
              activeOpacity={0.8}
              disabled={uploadingAvatar}
              style={styles.avatarWrap}>
              <View style={styles.avatarRingOuter}>
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
              </View>
              <View style={[styles.avatarCameraBadge, { backgroundColor: theme.accent }]}>
                <Ionicons name="camera" size={12} color={theme.background} />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.avatarWrap}>
              <View style={styles.avatarRingOuter}>
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
          <Text style={styles.username}>@{username}</Text>
          {(profile?.current_streak ?? 0) > 0 && (
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={16} color={theme.coral} />
              <Text style={styles.streakBadgeText}>
                {profile!.current_streak} day streak
              </Text>
            </View>
          )}
          <View style={styles.explorerLevelCard}>
            <Text style={styles.explorerLevelLabel}>EXPLORER LEVEL</Text>
            <View style={styles.explorerLevelHeader}>
              <Text style={styles.explorerLevelName}>{explorerLevel.name}</Text>
              <View style={styles.explorerLevelBadge}>
                <Text style={styles.explorerLevelBadgeText}>Lv. {explorerLevelIndex}</Text>
              </View>
            </View>
            {nextLevel && (
              <>
                <View style={styles.explorerProgressTrack}>
                  <View
                    style={[
                      styles.explorerProgressFill,
                      {
                        width: `${Math.min(100, (streakPoints / nextLevel.minPoints) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.explorerProgressLabel}>
                  {streakPoints} XP · {xpToNextLevel} to {nextLevel.name}
                </Text>
              </>
            )}
          </View>
          <Text style={styles.bio}>Explorer & gem hunter 🌍</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{gems.length}</Text>
            <Text style={styles.statLabel}>Gems</Text>
          </View>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.statItem}
            onPress={() =>
              profileId &&
              router.push({ pathname: '/followers', params: { userId: profileId, type: 'following' } })
            }
            activeOpacity={0.7}>
            <Text style={styles.statValue}>{followingCount}</Text>
            <View style={styles.statLabelRow}>
              <Text style={styles.statLabelInRow}>Following</Text>
              <Text style={styles.statChevron}>›</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.statItem}
            onPress={() =>
              profileId &&
              router.push({ pathname: '/followers', params: { userId: profileId, type: 'followers' } })
            }
            activeOpacity={0.7}>
            <Text style={styles.statValue}>{followersCount}</Text>
            <View style={styles.statLabelRow}>
              <Text style={styles.statLabelInRow}>Followers</Text>
              <Text style={styles.statChevron}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {isOwnProfile && (
          <View style={styles.achievementsPreview}>
            <View style={styles.achievementsPreviewHeader}>
              <Text style={styles.achievementsPreviewTitle}>Achievements</Text>
              <Text style={styles.achievementsPreviewCount}>
                {unlockedCount} / {ACHIEVEMENTS.length}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.achievementsPreviewRow}>
              {ACHIEVEMENTS.map((achievement) => {
                const isUnlocked = unlockedAchievementTypes.includes(achievement.type);
                const badgeColor =
                  achievement.type === 'seven_day_streak' ? theme.coral : theme.accent;
                return (
                  <TouchableOpacity
                    key={achievement.type}
                    style={styles.achievementPreviewItem}
                    onPress={() =>
                      Alert.alert(
                        achievement.name,
                        isUnlocked
                          ? achievement.description
                          : `${achievement.description}\n\n🔒 Not unlocked yet`,
                      )
                    }
                    activeOpacity={0.7}>
                    <View
                      style={[
                        styles.achievementPreviewCircle,
                        isUnlocked
                          ? {
                              backgroundColor: badgeColor + '1F',
                              borderWidth: 1.5,
                              borderColor: badgeColor,
                            }
                          : styles.achievementPreviewCircleLocked,
                      ]}>
                      <Ionicons
                        name={achievement.icon as keyof typeof Ionicons.glyphMap}
                        size={16}
                        color={isUnlocked ? badgeColor : theme.textTertiary}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {isOwnProfile && isPremium && (
          <View style={styles.categoriesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Categories</Text>
              <Text style={styles.sectionCount}>{customCategories.length}</Text>
            </View>

            <TouchableOpacity
              style={styles.newCategoryButton}
              onPress={() => router.push('/create-category')}
              activeOpacity={0.8}>
              <Ionicons name="add" size={18} color={theme.accent} />
              <Text style={styles.newCategoryButtonText}>New Category</Text>
            </TouchableOpacity>

            {customCategories.length > 0 && (
              <View style={styles.categoryChips}>
                {customCategories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[styles.categoryChip, { borderColor: category.color }]}
                    onPress={() =>
                      Alert.alert(
                        category.name,
                        `${category.visibility === 'public' ? 'Public' : 'Private'} category · Tap to view gems coming soon`,
                      )
                    }
                    activeOpacity={0.7}>
                    <Ionicons
                      name={category.icon as keyof typeof Ionicons.glyphMap}
                      size={14}
                      color={category.color}
                    />
                    <Text style={styles.categoryChipText}>{category.name}</Text>
                    <Ionicons
                      name={category.visibility === 'public' ? 'globe' : 'lock-closed'}
                      size={12}
                      color={theme.textTertiary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {!isOwnProfile && localeBadges.length > 0 && (
          <View style={styles.localeBadgesSection}>
            {renderLocaleExpertBadges()}
          </View>
        )}

        <View style={styles.actionRow}>
          {isOwnProfile ? (
            <>
              <PressableScale
                style={styles.followButton}
                onPress={() => router.push('/settings')}>
                <Text style={styles.followButtonText}>Edit Profile</Text>
              </PressableScale>
              <View style={styles.actionRowSpacer} />
            </>
          ) : (
            <>
              <PressableScale
                style={
                  isFollowing
                    ? styles.followingButton
                    : isRequested
                      ? styles.requestedButton
                      : styles.followButton
                }
                onPress={isFollowing || isRequested ? handleUnfollow : handleFollow}
                disabled={isRequested}>
                <Text
                  style={
                    isFollowing
                      ? styles.followingButtonText
                      : isRequested
                        ? styles.requestedButtonText
                        : styles.followButtonText
                  }>
                  {isFollowing ? 'Following ✓' : isRequested ? 'Requested' : 'Follow'}
                </Text>
              </PressableScale>
              <PressableScale style={styles.messageButton} onPress={handleSendMessage}>
                <Text style={styles.messageButtonText}>Message</Text>
              </PressableScale>
            </>
          )}
        </View>

        {isOwnProfile && followRequests.length > 0 && (
          <View style={styles.followRequestsSection}>
            <TouchableOpacity
              style={styles.followRequestsBanner}
              onPress={() => setFollowRequestsExpanded((prev) => !prev)}
              activeOpacity={0.8}>
              <Ionicons name="person-add" size={18} color={theme.coral} />
              <Text style={styles.followRequestsBannerText}>
                {followRequests.length} follow request{followRequests.length !== 1 ? 's' : ''}
              </Text>
              <Ionicons
                name={followRequestsExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            {followRequestsExpanded &&
              followRequests.map((request) => {
                const requestUsername = request.follower?.username ?? 'User';
                const initial = requestUsername.charAt(0).toUpperCase();
                return (
                  <View key={request.follower_id} style={styles.followRequestRow}>
                    <View style={styles.followRequestAvatar}>
                      <Text style={styles.followRequestAvatarText}>{initial}</Text>
                    </View>
                    <Text style={styles.followRequestUsername} numberOfLines={1}>
                      {requestUsername}
                    </Text>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleAcceptRequest(request.follower_id)}
                      activeOpacity={0.8}>
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineButton}
                      onPress={() => handleDeclineRequest(request.follower_id)}
                      activeOpacity={0.8}>
                      <Text style={styles.declineButtonText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
          </View>
        )}

        <View style={styles.accordionSection}>
          {renderAccordionHeader('gems', 'My Gems', gems.length)}

          {expandedPanel === 'gems' && (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
              {gems.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="location-outline"
                    size={56}
                    color={theme.accent}
                    style={styles.emptyIcon}
                  />
                  <Text style={styles.emptyTitle}>No gems yet</Text>
                  <Text style={styles.emptySubtitle}>Start exploring and drop your first gem!</Text>
                  {isOwnProfile && (
                    <PressableScale
                      style={styles.addButton}
                      onPress={() => router.push('/add-gem')}>
                      <Text style={styles.addButtonText}>Add Gem</Text>
                    </PressableScale>
                  )}
                </View>
              ) : (
                renderProfileGemsGrid()
              )}
            </Animated.View>
          )}
        </View>

        {showLikedSection && (
          <View style={styles.accordionSection}>
            {renderAccordionHeader(
              'liked',
              'Liked Gems',
              likedGems.length,
              isOwnProfile,
              likedGemsPublic,
              toggleLikedGemsPublic,
            )}

            {expandedPanel === 'liked' && (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                {renderHorizontalGemList(
                  likedGems,
                  'heart-outline',
                  'No liked gems yet',
                  'Gems you like will appear here',
                )}
              </Animated.View>
            )}
          </View>
        )}

        {showVisitedSection && (
          <View style={styles.accordionSection}>
            {renderAccordionHeader(
              'visited',
              'Visited Gems',
              visitedGems.length,
              isOwnProfile,
              visitedGemsPublic,
              toggleVisitedGemsPublic,
            )}

            {expandedPanel === 'visited' && (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                {renderHorizontalGemList(
                  visitedGems,
                  'checkmark-circle-outline',
                  'No verified visits yet',
                  'Verify visits at gem locations to track them here',
                )}
              </Animated.View>
            )}
          </View>
        )}

        <View style={styles.accordionSection}>
          {renderAccordionHeader(
            'achievements',
            'Achievements',
            unlockedCount,
            false,
            undefined,
            undefined,
            ACHIEVEMENTS.length,
          )}

          {expandedPanel === 'achievements' && (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
              <View style={styles.achievementsGrid}>
                {ACHIEVEMENTS.map((achievement) => {
                  const isUnlocked = unlockedAchievementTypes.includes(achievement.type);
                  return (
                    <View key={achievement.type} style={styles.achievementItem}>
                      <View
                        style={[
                          styles.achievementIconCircle,
                          isUnlocked
                            ? styles.achievementIconCircleUnlocked
                            : styles.achievementIconCircleLocked,
                        ]}>
                        <Ionicons
                          name={achievement.icon as keyof typeof Ionicons.glyphMap}
                          size={22}
                          color={isUnlocked ? theme.accent : theme.textTertiary}
                        />
                        {!isUnlocked && (
                          <View style={styles.achievementLockOverlay}>
                            <Ionicons name="lock-closed" size={14} color={theme.textTertiary} />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.achievementName,
                          !isUnlocked && styles.achievementNameLocked,
                        ]}
                        numberOfLines={2}>
                        {achievement.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}
        </View>

        {isOwnProfile && (
          <View style={styles.accordionSection}>
            {renderAccordionHeader(
              'categoryMastery',
              'Category Mastery',
              categoriesWithVisits.length,
            )}

            {expandedPanel === 'categoryMastery' && (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                {visibleCategories.length === 0 ? (
                  <Text style={styles.sectionEmptyText}>
                    No category visits yet — verify visits to build mastery!
                  </Text>
                ) : (
                  visibleCategories.map((cat) => {
                    const visits = categoryCounts[cat.id] ?? 0;
                    const tier = getMasteryTier(visits);
                    const nextTier = getNextMasteryTier(visits);
                    const tierIndex = getMasteryTierIndex(visits);
                    const tierColors = getMasteryTierColors(tierIndex, cat.color, theme);
                    const progress = nextTier
                      ? (visits - tier.minVisits) / (nextTier.minVisits - tier.minVisits)
                      : 1;

                    return (
                      <View key={cat.id} style={styles.masteryRow}>
                        <View style={styles.masteryRowHeader}>
                          <View style={styles.masteryCategoryInfo}>
                            <View
                              style={[
                                styles.masteryIconCircle,
                                { backgroundColor: cat.color + '20' },
                              ]}>
                              <Ionicons
                                name={cat.icon as keyof typeof Ionicons.glyphMap}
                                size={16}
                                color={cat.color}
                              />
                            </View>
                            <Text style={styles.masteryCategoryName}>{cat.name}</Text>
                          </View>
                          <View style={styles.masteryRowRight}>
                            <Text style={styles.masteryVisitCount}>{visits}</Text>
                            <View
                              style={[
                                styles.masteryTierBadge,
                                { backgroundColor: tierColors.badgeBg },
                              ]}>
                              <Text
                                style={[
                                  styles.masteryTierBadgeText,
                                  { color: tierColors.badgeText },
                                ]}>
                                {tier.name}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.masteryProgressTrack}>
                          <View
                            style={[
                              styles.masteryProgressFill,
                              {
                                width: `${Math.min(100, Math.max(0, progress * 100))}%`,
                                backgroundColor: tierColors.progressColor,
                              },
                            ]}
                          />
                        </View>
                        {nextTier ? (
                          <Text style={styles.masteryProgressHint}>
                            {nextTier.minVisits - visits} more to {nextTier.name}
                          </Text>
                        ) : (
                          <Text style={styles.masteryProgressHint}>Max tier reached</Text>
                        )}
                      </View>
                    );
                  })
                )}
                {categoriesWithVisits.length < CATEGORIES.length && (
                  <TouchableOpacity
                    style={styles.showAllCategoriesButton}
                    onPress={() => setShowAllCategories((prev) => !prev)}
                    activeOpacity={0.7}>
                    <Text style={styles.showAllCategoriesText}>
                      {showAllCategories ? 'Show visited only' : 'Show all categories'}
                    </Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            )}
          </View>
        )}

        {isOwnProfile && (
          <View style={styles.explorationSection}>
            <Text style={[styles.sectionTitle, styles.explorationSectionTitle]}>
              Exploration Progress
            </Text>

            <View style={styles.citySearchWrap}>
              <TextInput
                style={styles.citySearchInput}
                value={cityQuery}
                onChangeText={handleCitySearchInput}
                placeholder="Search a city to check your exploration..."
                placeholderTextColor={theme.textSecondary}
                autoCorrect={false}
              />
              {searchingCities && (
                <View style={styles.citySearchIndicator}>
                  <ActivityIndicator size="small" color={theme.accent} />
                </View>
              )}
              {showSuggestions && citySuggestions.length > 0 && (
                <View style={styles.citySuggestions}>
                  <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                    {citySuggestions.map((city, index) => (
                      <TouchableOpacity
                        key={`${city.name}-${index}`}
                        style={[
                          styles.citySuggestionRow,
                          index < citySuggestions.length - 1 && styles.citySuggestionRowBorder,
                        ]}
                        onPress={() => selectExplorationCity(city)}
                        activeOpacity={0.7}>
                        <Ionicons name="location-outline" size={14} color={theme.textTertiary} />
                        <Text style={styles.citySuggestionText}>{city.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {showResetHomeTown && (
              <TouchableOpacity onPress={resetToHomeTown} activeOpacity={0.7}>
                <Text style={styles.resetHomeTownLink}>Reset to my home town</Text>
              </TouchableOpacity>
            )}

            <View style={styles.explorationTabContainer}>
              <TouchableOpacity
                style={[
                  styles.explorationTab,
                  explorationMode === 'city' && styles.explorationTabActive,
                ]}
                onPress={() => setExplorationMode('city')}
                activeOpacity={0.8}>
                <Text
                  style={[
                    styles.explorationTabText,
                    explorationMode === 'city' && styles.explorationTabTextActive,
                  ]}>
                  City
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.explorationTab,
                  explorationMode === 'country' && styles.explorationTabActive,
                ]}
                onPress={() => setExplorationMode('country')}
                activeOpacity={0.8}>
                <Text
                  style={[
                    styles.explorationTabText,
                    explorationMode === 'country' && styles.explorationTabTextActive,
                  ]}>
                  Country
                </Text>
              </TouchableOpacity>
            </View>

            {!activeExploration.hasCenter ? (
              <Text style={styles.sectionEmptyText}>
                Set your home town or verify a visit to see exploration progress.
              </Text>
            ) : (
              <View style={styles.explorationCard}>
                <Text style={styles.explorationLabel}>{explorationAreaLabel}</Text>
                <Text style={styles.explorationCount}>
                  {activeExploration.exploredCount} / {activeExploration.totalCount} gems explored
                </Text>
                <View style={styles.explorationProgressTrack}>
                  <View
                    style={[
                      styles.explorationProgressFill,
                      { width: `${explorationPercent}%` },
                    ]}
                  />
                </View>
                <Text style={styles.explorationPercent}>{explorationPercent}% complete</Text>
              </View>
            )}

            {renderLocaleExpertBadges()}
          </View>
        )}

        {isOwnProfile && (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
      )}

      {!isOwnProfile && currentUserId && userId && (
        <ReportSheet
          visible={reportVisible}
          onClose={() => setReportVisible(false)}
          targetType="user"
          targetId={userId}
          reporterId={currentUserId}
        />
      )}

      <AchievementUnlockModal
        visible={!!unlockedBadge}
        badgeType={unlockedBadge}
        onClose={() => setUnlockedBadge(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSide: {
    width: 22,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'SpaceGrotesk-Bold',
    color: theme.text,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarRingOuter: {
    padding: 5,
    borderRadius: 44,
    backgroundColor: theme.coral,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: theme.background,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: theme.background,
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 26,
    fontFamily: 'SpaceGrotesk-Bold',
    color: theme.accentText,
  },
  username: {
    fontSize: 17,
    fontFamily: 'SpaceGrotesk-SemiBold',
    color: theme.text,
    marginTop: 12,
    marginBottom: 8,
  },
  bio: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.accentSub,
    borderWidth: 0.5,
    borderColor: theme.accent,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  levelBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.accent,
  },
  levelProgressText: {
    fontSize: 11,
    color: theme.textTertiary,
    marginTop: 4,
  },
  explorerLevelCard: {
    alignSelf: 'stretch',
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  explorerLevelLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    color: theme.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  explorerLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  explorerLevelName: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk-Bold',
    color: theme.text,
  },
  explorerLevelBadge: {
    backgroundColor: theme.accentSub,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  explorerLevelBadgeText: {
    fontFamily: 'SpaceMono-Bold',
    fontSize: 13,
    color: theme.accent,
  },
  explorerProgressTrack: {
    height: 6,
    backgroundColor: theme.bgTertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  explorerProgressFill: {
    height: '100%',
    backgroundColor: theme.accent,
    borderRadius: 3,
  },
  explorerProgressLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: theme.textSecondary,
    marginTop: 6,
  },
  achievementsPreview: {
    marginHorizontal: 20,
    marginBottom: 8,
  },
  achievementsPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  achievementsPreviewTitle: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk-SemiBold',
    color: theme.text,
  },
  achievementsPreviewCount: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: theme.textSecondary,
  },
  achievementsPreviewRow: {
    flexDirection: 'row',
    gap: 7,
    paddingRight: 4,
  },
  achievementPreviewItem: {
    alignItems: 'center',
  },
  achievementPreviewCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementPreviewCircleLocked: {
    backgroundColor: theme.card,
    borderWidth: 1.5,
    borderColor: theme.border,
    opacity: 0.35,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.coralSubtle,
    borderWidth: 1,
    borderColor: theme.coral,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 8,
  },
  streakBadgeText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 13,
    color: theme.coral,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 16,
    marginHorizontal: 20,
    marginVertical: 20,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: 'SpaceGrotesk-Bold',
    color: theme.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 3,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 3,
  },
  statLabelInRow: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  statChevron: {
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 11,
    color: theme.textTertiary,
  },
  statDivider: {
    width: 0.5,
    height: 30,
    backgroundColor: theme.border,
    alignSelf: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  actionRowSpacer: {
    flex: 1,
  },
  followButton: {
    flex: 1,
    backgroundColor: theme.accent,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accentText,
  },
  followingButton: {
    flex: 1,
    backgroundColor: theme.bgTertiary,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  followingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  requestedButton: {
    flex: 1,
    backgroundColor: theme.bgTertiary,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
    opacity: 0.7,
  },
  requestedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  followRequestsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  followRequestsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.coralSubtle,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  followRequestsBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: theme.coral,
  },
  followRequestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  followRequestAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followRequestAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.background,
  },
  followRequestUsername: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  acceptButton: {
    backgroundColor: theme.accent,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  acceptButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.background,
  },
  declineButton: {
    borderWidth: 0.5,
    borderColor: theme.danger,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  declineButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.danger,
  },
  messageButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk-Bold',
    color: theme.text,
  },
  sectionCount: {
    fontSize: 13,
    color: theme.accent,
  },
  categoriesSection: {
    marginBottom: 8,
  },
  newCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.card,
    borderWidth: 1.5,
    borderColor: theme.accent,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  newCategoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent,
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.text,
  },
  gemsGrid: {
    paddingHorizontal: 12,
  },
  gemThumbnailRow: {
    flexDirection: 'row',
  },
  gemThumbnail: {
    flex: 1,
    aspectRatio: 1,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  gemThumbnailImageWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  gemThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  gemThumbnailMeasureTitle: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 4,
    opacity: 0,
  },
  gemThumbnailMeasureTitleText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 12,
    color: theme.text,
  },
  gemThumbnailPlaceholder: {
    flex: 1,
    backgroundColor: IMAGE_PLACEHOLDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gemThumbnailAdd: {
    flex: 1,
    aspectRatio: 1,
    margin: 4,
    borderRadius: 8,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gemThumbnailOverflow: {
    flex: 1,
    aspectRatio: 1,
    margin: 4,
    borderRadius: 8,
    backgroundColor: theme.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gemThumbnailOverflowText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: theme.textTertiary,
  },
  gemThumbnailSpacer: {
    flex: 1,
    margin: 4,
  },
  gemRow: {
    flexDirection: 'row',
  },
  gemCard: {
    flex: 1,
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  gemCardSpacer: {
    flex: 1,
    margin: 4,
  },
  gemImageArea: {
    height: 140,
    position: 'relative',
  },
  gemImage: {
    width: '100%',
    height: 140,
  },
  gemImagePlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: IMAGE_PLACEHOLDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gemOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.accentSub,
    borderWidth: 0.5,
    borderColor: theme.accent,
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  gemTitle: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk-Bold',
    color: theme.text,
    marginTop: 3,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  addButton: {
    marginTop: 20,
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.background,
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: theme.danger,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.danger,
  },
  gemSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  accordionSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  accordionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  accordionHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  privacyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  privacyToggleLabel: {
    fontSize: 11,
    color: theme.textTertiary,
  },
  sectionEmptyText: {
    fontSize: 13,
    color: theme.textTertiary,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  horizontalGemRow: {
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  horizontalGemCard: {
    width: 160,
    height: 200,
    backgroundColor: theme.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  horizontalGemImage: {
    height: 120,
    backgroundColor: IMAGE_PLACEHOLDER,
  },
  horizontalGemImageFill: {
    width: '100%',
    height: '100%',
  },
  horizontalGemImagePlaceholder: {
    backgroundColor: IMAGE_PLACEHOLDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalGemBody: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  horizontalCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.accentSub,
    borderWidth: 0.5,
    borderColor: theme.accent,
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  horizontalCategoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  horizontalGemTitle: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk-Bold',
    color: theme.text,
    marginTop: 6,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  achievementItem: {
    width: '25%',
    alignItems: 'center',
    padding: 8,
  },
  achievementIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  achievementIconCircleUnlocked: {
    backgroundColor: theme.accentSub,
    borderWidth: 0.5,
    borderColor: theme.accent,
  },
  achievementIconCircleLocked: {
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    opacity: 0.35,
  },
  achievementLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 26,
  },
  achievementName: {
    fontSize: 10,
    fontWeight: '500',
    color: theme.text,
    textAlign: 'center',
    marginTop: 6,
  },
  achievementNameLocked: {
    color: theme.textTertiary,
  },
  masteryRow: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  masteryRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  masteryCategoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  masteryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masteryCategoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  masteryRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  masteryVisitCount: {
    fontSize: 14,
    fontFamily: 'SpaceMono-Regular',
    color: theme.text,
  },
  masteryTierBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  masteryTierBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  masteryProgressTrack: {
    height: 4,
    backgroundColor: theme.bgTertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  masteryProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  masteryProgressHint: {
    fontSize: 10,
    color: theme.textTertiary,
    marginTop: 4,
  },
  showAllCategoriesButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  showAllCategoriesText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.accent,
  },
  explorationSection: {
    marginTop: 8,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  explorationSectionTitle: {
    marginBottom: 12,
  },
  citySearchWrap: {
    zIndex: 10,
    position: 'relative',
    marginBottom: 8,
  },
  citySearchInput: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: theme.text,
  },
  citySearchIndicator: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  citySuggestions: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    marginTop: 4,
    maxHeight: 200,
    overflow: 'hidden',
    zIndex: 20,
    elevation: 4,
  },
  citySuggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  citySuggestionRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  citySuggestionText: {
    fontSize: 14,
    color: theme.text,
    flex: 1,
  },
  resetHomeTownLink: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.accent,
    marginBottom: 10,
  },
  localeBadgesSection: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  localeBadgesRow: {
    gap: 8,
    paddingVertical: 4,
  },
  localeExpertChip: {
    backgroundColor: theme.coralSubtle,
    borderWidth: 0.5,
    borderColor: theme.coral,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  localeExpertChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.coral,
  },
  explorationTabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  explorationTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  explorationTabActive: {
    backgroundColor: theme.accent,
  },
  explorationTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  explorationTabTextActive: {
    color: theme.background,
    fontWeight: '600',
  },
  explorationCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  explorationLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk-Bold',
    color: theme.text,
    marginBottom: 6,
  },
  explorationCount: {
    fontSize: 15,
    fontFamily: 'SpaceMono-Regular',
    color: theme.text,
    marginBottom: 10,
  },
  explorationProgressTrack: {
    height: 8,
    backgroundColor: theme.bgTertiary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  explorationProgressFill: {
    height: '100%',
    backgroundColor: theme.accent,
    borderRadius: 4,
  },
  explorationPercent: {
    fontSize: 12,
    fontFamily: 'SpaceMono-Regular',
    color: theme.textSecondary,
    marginTop: 6,
  },
});
