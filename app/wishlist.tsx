import { DiscoverListCard } from '@/components/DiscoverListCard';
import { EmptyState } from '@/components/EmptyState';
import { getDistance } from '@/lib/distance';
import { checkIsPremium } from '@/lib/paywall';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { WISHLIST_FREE_LIMIT } from '@/lib/wishlist';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type WishlistGem = {
  id: string;
  title: string;
  category: string;
  image_url: string | null;
  latitude: number;
  longitude: number;
  is_local_pick?: boolean;
  is_first_in_area?: boolean;
  profiles?: { username: string; avatar_url?: string | null } | null;
};

type WishlistRow = {
  gem_id: string;
  gem: WishlistGem | null;
};

const formatDistanceKm = (meters: number) => {
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
};

export default function WishlistScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [gems, setGems] = useState<WishlistGem[]>([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLikeCounts = useCallback(async (gemList: WishlistGem[]) => {
    if (gemList.length === 0) {
      setLikeCounts({});
      return;
    }

    const gemIds = gemList.map((gem) => gem.id);
    const { data } = await supabase.from('gem_likes').select('gem_id').in('gem_id', gemIds);

    const counts: Record<string, number> = {};
    for (const gemId of gemIds) counts[gemId] = 0;
    if (data) {
      for (const row of data) {
        counts[row.gem_id] = (counts[row.gem_id] ?? 0) + 1;
      }
    }
    setLikeCounts(counts);
  }, []);

  const fetchWishlist = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setGems([]);
        setWishlistCount(0);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [wishlistResult, countResult, premium] = await Promise.all([
        supabase
          .from('wishlist')
          .select('gem_id, gem:gems(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('wishlist')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        checkIsPremium(),
      ]);

      setIsPremium(premium);
      setWishlistCount(countResult.count ?? 0);

      const parsedGems = ((wishlistResult.data as WishlistRow[] | null) ?? [])
        .map((row) => row.gem)
        .filter((gem): gem is WishlistGem => gem != null);

      setGems(parsedGems);
      await fetchLikeCounts(parsedGems);

      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setUserCoords({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        } else {
          setUserCoords(null);
        }
      } catch {
        setUserCoords(null);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [fetchLikeCounts],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchWishlist();
    }, [fetchWishlist]),
  );

  const onRefresh = useCallback(() => {
    void fetchWishlist(true);
  }, [fetchWishlist]);

  const countLabel = isPremium
    ? `${wishlistCount} saved`
    : `${wishlistCount} / ${WISHLIST_FREE_LIMIT} saved`;

  const renderItem = ({ item }: { item: WishlistGem }) => {
    const distanceMeters = userCoords
      ? getDistance(userCoords.latitude, userCoords.longitude, item.latitude, item.longitude)
      : null;

    return (
      <DiscoverListCard
        gem={item}
        likeCount={likeCounts[item.id] ?? 0}
        distanceMeters={distanceMeters}
        formatDistanceKm={formatDistanceKm}
      />
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
        <Text style={styles.headerTitle}>Wishlist</Text>
        <View style={styles.headerSide} />
      </View>

      {!loading && gems.length > 0 ? (
        <View style={styles.countBanner}>
          <Ionicons name="bookmark" size={14} color={theme.accent} />
          <Text style={styles.countText}>{countLabel}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : gems.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          title="Nothing saved yet"
          subtitle="Explore gems and bookmark places you want to visit."
          cta="Explore gems"
          onCta={() => router.push('/')}
        />
      ) : (
        <FlatList
          data={gems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          }
        />
      )}
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.border,
    },
    headerSide: {
      width: 32,
    },
    headerTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 18,
      color: theme.text,
    },
    countBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.accentSub,
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: theme.accent,
    },
    countText: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 12,
      color: theme.textSecondary,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
    },
  });
