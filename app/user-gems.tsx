import { EmptyState } from '@/components/EmptyState';
import { LoadMore, type LoadMoreStatus } from '@/components/LoadMore';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

const PAGE_SIZE = 24;
const GRID_COLUMNS = 3;

type Gem = {
  id: string;
  title: string;
  image_url: string | null;
};

export default function UserGemsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const thumbnailSize = Math.floor((width - 24 - GRID_COLUMNS * 8) / GRID_COLUMNS);
  const { userId, username } = useLocalSearchParams<{ userId: string; username?: string }>();
  const [gems, setGems] = useState<Gem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadMoreStatus, setLoadMoreStatus] = useState<LoadMoreStatus>('idle');
  const [paginationTriggered, setPaginationTriggered] = useState(false);
  const [page, setPage] = useState(0);

  const fetchGems = useCallback(
    async (pageIndex: number, options: { append?: boolean; isRefresh?: boolean } = {}) => {
      const { append = false, isRefresh = false } = options;
      if (!userId) return;

      if (append) {
        setLoadMoreStatus('loading');
      } else if (!isRefresh) {
        setLoading(true);
      }

      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('gems')
        .select('id, title, image_url')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        if (append) {
          setLoadMoreStatus('error');
        }
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const nextGems = (data as Gem[] | null) ?? [];
      const nextHasMore = nextGems.length === PAGE_SIZE;

      setGems((prev) => (append ? [...prev, ...nextGems] : nextGems));
      setHasMore(nextHasMore);
      setPage(pageIndex);

      if (append) {
        setLoadMoreStatus(nextHasMore ? 'idle' : 'end');
        setPaginationTriggered(true);
      } else {
        setPaginationTriggered(false);
        setLoadMoreStatus('idle');
      }

      setLoading(false);
      setRefreshing(false);
    },
    [userId],
  );

  useEffect(() => {
    fetchGems(0);
  }, [fetchGems]);

  const handleLoadMore = () => {
    if (!hasMore || loadMoreStatus === 'loading') return;
    fetchGems(page + 1, { append: true });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchGems(0, { isRefresh: true });
  };

  const footerStatus: LoadMoreStatus = (() => {
    if (loadMoreStatus === 'loading' || loadMoreStatus === 'error') return loadMoreStatus;
    if (!hasMore && paginationTriggered) return 'end';
    return 'idle';
  })();

  const renderItem = ({ item }: { item: Gem }) => (
    <TouchableOpacity
      style={[styles.thumbnail, { width: thumbnailSize, height: thumbnailSize }]}
      onPress={() => router.push({ pathname: '/gem/[id]', params: { id: item.id } })}
      activeOpacity={0.85}>
      {item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          style={styles.thumbnailImage}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={styles.thumbnailPlaceholder}>
          <Ionicons name="location" size={20} color={theme.accent} />
        </View>
      )}
    </TouchableOpacity>
  );

  const title = username ? `@${username}'s Gems` : 'Gems';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSide} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : gems.length === 0 ? (
        <EmptyState icon="location-outline" title="No gems yet" />
      ) : (
        <FlatList
          data={gems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />
          }
          ListFooterComponent={
            <LoadMore
              status={footerStatus}
              itemLabel="gems"
              totalCount={footerStatus === 'end' ? gems.length : undefined}
              onRetry={handleLoadMore}
            />
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
      backgroundColor: theme.background,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerSide: {
      width: 22,
      alignItems: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: 17,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.text,
      textAlign: 'center',
      marginHorizontal: 8,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    row: {
      gap: 0,
    },
    thumbnail: {
      margin: 4,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
    },
    thumbnailImage: {
      width: '100%',
      height: '100%',
    },
    thumbnailPlaceholder: {
      flex: 1,
      backgroundColor: '#1A5C3A',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
