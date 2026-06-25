import { HighlightText } from '@/components/HighlightText';
import { LoadMore, type LoadMoreStatus } from '@/components/LoadMore';
import { ModalEntryWrapper } from '@/components/ModalEntryWrapper';
import { CATEGORIES } from '@/lib/categories';
import {
  runGlobalSearchPage,
  type SearchFilter,
  type SearchResult,
} from '@/lib/globalSearch';
import {
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
  saveRecentSearch,
} from '@/lib/recentSearches';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FILTERS: { key: SearchFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'gems', label: 'Gems' },
  { key: 'people', label: 'People' },
  { key: 'places', label: 'Places' },
];

const MIN_QUERY_LENGTH = 2;

const formatDistanceKm = (meters: number) => {
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
};

const getCategoryColor = (categoryId: string) =>
  CATEGORIES.find((category) => category.id === categoryId)?.color ?? '#534AB7';

type ResultRowProps = {
  item: SearchResult;
  query: string;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
};

function ResultTypeTag({ label, theme, styles }: { label: string; theme: Theme; styles: ReturnType<typeof createStyles> }) {
  return <Text style={[styles.typeTag, { color: theme.textTertiary }]}>{label}</Text>;
}

function GemResultRow({ item, query, theme, styles, onPress }: ResultRowProps) {
  if (item.type !== 'gem') return null;

  const subtitle =
    item.city_name ??
    (item.distanceMeters != null ? formatDistanceKm(item.distanceMeters) : null);

  return (
    <TouchableOpacity style={styles.resultRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.resultThumbWrap}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.resultThumb} contentFit="cover" />
        ) : (
          <View style={[styles.resultThumb, { backgroundColor: getCategoryColor(item.category) }]} />
        )}
      </View>
      <View style={styles.resultContent}>
        <HighlightText
          text={item.title}
          query={query}
          style={styles.resultTitle}
          highlightStyle={{ color: theme.accent }}
          numberOfLines={1}
        />
        <Text style={styles.resultSubtitle} numberOfLines={1}>
          ♥ {item.likeCount}
          {subtitle ? ` · ${subtitle}` : ''}
        </Text>
      </View>
      <ResultTypeTag label="GEM" theme={theme} styles={styles} />
    </TouchableOpacity>
  );
}

function PersonResultRow({ item, query, theme, styles, onPress }: ResultRowProps) {
  if (item.type !== 'person') return null;

  const initial = item.username.charAt(0).toUpperCase();

  return (
    <TouchableOpacity style={styles.resultRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.resultThumbWrap}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.resultThumb} contentFit="cover" />
        ) : (
          <View style={[styles.resultThumb, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
      </View>
      <View style={styles.resultContent}>
        <HighlightText
          text={item.username}
          query={query}
          style={styles.resultTitle}
          highlightStyle={{ color: theme.accent }}
          numberOfLines={1}
        />
        <Text style={styles.resultSubtitle} numberOfLines={1}>
          @{item.username} · {item.followerCount} followers
        </Text>
      </View>
      <ResultTypeTag label="PERSON" theme={theme} styles={styles} />
    </TouchableOpacity>
  );
}

function PlaceResultRow({ item, query, theme, styles, onPress }: ResultRowProps) {
  if (item.type !== 'place') return null;

  return (
    <TouchableOpacity style={styles.resultRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.resultThumbWrap, styles.placeThumb, { backgroundColor: theme.bgTertiary }]}>
        <Text style={styles.placeEmoji}>📍</Text>
      </View>
      <View style={styles.resultContent}>
        <HighlightText
          text={item.cityName}
          query={query}
          style={styles.resultTitle}
          highlightStyle={{ color: theme.accent }}
          numberOfLines={1}
        />
        <Text style={styles.resultSubtitle} numberOfLines={1}>
          {item.gemCount} gems nearby
        </Text>
      </View>
      <ResultTypeTag label="PLACE" theme={theme} styles={styles} />
    </TouchableOpacity>
  );
}

function SearchResultRow(props: ResultRowProps) {
  if (props.item.type === 'gem') return <GemResultRow {...props} />;
  if (props.item.type === 'person') return <PersonResultRow {...props} />;
  return <PlaceResultRow {...props} />;
}

export default function SearchScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searchPage, setSearchPage] = useState(0);
  const [loadMoreStatus, setLoadMoreStatus] = useState<LoadMoreStatus>('idle');
  const [paginationTriggered, setPaginationTriggered] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestRef = useRef(0);

  useEffect(() => {
    getRecentSearches().then(setRecentSearches);
    inputRef.current?.focus();

    const loadLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await Location.getCurrentPositionAsync({});
      setUserCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    };

    loadLocation();
  }, []);

  const executeSearch = useCallback(
    async (searchQuery: string, filter: SearchFilter, page = 0, append = false) => {
      const trimmed = searchQuery.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setResults([]);
        setHasMore(false);
        setLoadMoreStatus('idle');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const requestId = ++searchRequestRef.current;
      if (!append) {
        setLoading(true);
      }

      try {
        const { results: nextResults, hasMore: nextHasMore } = await runGlobalSearchPage(
          trimmed,
          filter,
          userCoords,
          page,
        );
        if (requestId !== searchRequestRef.current) return;

        setResults((prev) => (append ? [...prev, ...nextResults] : nextResults));
        setHasMore(nextHasMore);
        setSearchPage(page);

        if (append) {
          setLoadMoreStatus(nextHasMore ? 'idle' : 'end');
        } else {
          setPaginationTriggered(false);
          setLoadMoreStatus('idle');
          const updated = await saveRecentSearch(trimmed);
          setRecentSearches(updated);
        }
      } catch {
        if (requestId !== searchRequestRef.current) return;
        if (append) {
          setLoadMoreStatus('error');
        }
      } finally {
        if (requestId === searchRequestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [userCoords],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setHasMore(false);
      setSearchPage(0);
      setLoadMoreStatus('idle');
      setPaginationTriggered(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      executeSearch(trimmed, activeFilter, 0, false);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeFilter, executeSearch]);

  const handleLoadMore = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH || !hasMore || loadMoreStatus === 'loading') {
      return;
    }

    setPaginationTriggered(true);
    setLoadMoreStatus('loading');
    executeSearch(trimmed, activeFilter, searchPage + 1, true);
  }, [query, hasMore, loadMoreStatus, activeFilter, searchPage, executeSearch]);

  const handleRefresh = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    setRefreshing(true);
    executeSearch(trimmed, activeFilter, 0, false);
  }, [query, activeFilter, executeSearch]);

  const footerStatus: LoadMoreStatus = (() => {
    if (loadMoreStatus === 'loading' || loadMoreStatus === 'error') return loadMoreStatus;
    if (!hasMore && paginationTriggered && results.length > 0) return 'end';
    return 'idle';
  })();

  const handleRecentPress = (term: string) => {
    setQuery(term);
  };

  const handleRemoveRecent = async (term: string) => {
    const updated = await removeRecentSearch(term);
    setRecentSearches(updated);
  };

  const handleClearRecent = async () => {
    await clearRecentSearches();
    setRecentSearches([]);
  };

  const handleResultPress = (item: SearchResult) => {
    if (item.type === 'gem') {
      router.push(`/gem/${item.id}`);
      return;
    }

    if (item.type === 'person') {
      router.push({ pathname: '/profile', params: { userId: item.id } });
      return;
    }

    router.push({
      pathname: '/map',
      params: {
        focusLat: String(item.latitude),
        focusLng: String(item.longitude),
      },
    });
  };

  const showRecent = isFocused && query.trim().length === 0;
  const showResults = query.trim().length >= MIN_QUERY_LENGTH;

  const listEmptyComponent = showResults ? (
    loading ? null : (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={48} color={theme.textTertiary} />
        <Text style={styles.emptyTitle}>No results found</Text>
        <Text style={styles.emptySubtitle}>Try a different search term</Text>
      </View>
    )
  ) : null;

  return (
    <ModalEntryWrapper>
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <View style={styles.searchHeader}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={theme.textTertiary} />
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                placeholder="Search gems, people, places..."
                placeholderTextColor={theme.textTertiary}
                value={query}
                onChangeText={setQuery}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => executeSearch(query, activeFilter)}
              />
            </View>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            keyboardShouldPersistTaps="handled">
            {FILTERS.map((filter) => {
              const isSelected = activeFilter === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterPill,
                    isSelected && { backgroundColor: theme.accent, borderColor: theme.accent },
                  ]}
                  onPress={() => setActiveFilter(filter.key)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.filterPillText,
                      isSelected && { color: theme.accentText },
                    ]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {showRecent && (
            <View style={styles.recentSection}>
              <View style={styles.recentHeader}>
                <Text style={styles.recentTitle}>Recent</Text>
                {recentSearches.length > 0 && (
                  <TouchableOpacity onPress={handleClearRecent} activeOpacity={0.7}>
                    <Text style={styles.clearAllText}>Clear all</Text>
                  </TouchableOpacity>
                )}
              </View>
              {recentSearches.length === 0 ? (
                <Text style={styles.recentEmpty}>Your recent searches will appear here</Text>
              ) : (
                <View style={styles.recentChips}>
                  {recentSearches.map((term) => (
                    <View key={term} style={styles.recentChip}>
                      <TouchableOpacity onPress={() => handleRecentPress(term)} activeOpacity={0.7}>
                        <Text style={styles.recentChipText}>{term}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveRecent(term)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}>
                        <Ionicons name="close" size={14} color={theme.textTertiary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {loading && showResults && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={theme.accent} />
            </View>
          )}

          {showResults && (
            <FlatList
              data={results}
              keyExtractor={(item) =>
                item.type === 'gem'
                  ? `gem-${item.id}`
                  : item.type === 'person'
                    ? `person-${item.id}`
                    : `place-${item.cityName}`
              }
              renderItem={({ item }) => (
                <SearchResultRow
                  item={item}
                  query={query}
                  theme={theme}
                  styles={styles}
                  onPress={() => handleResultPress(item)}
                />
              )}
              ListEmptyComponent={listEmptyComponent}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.resultsContent}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.3}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />
              }
              ListFooterComponent={
                <LoadMore
                  status={footerStatus}
                  itemLabel="results"
                  totalCount={footerStatus === 'end' ? results.length : undefined}
                  onRetry={handleLoadMore}
                />
              }
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ModalEntryWrapper>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    searchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    searchBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: theme.border,
      paddingHorizontal: 12,
      height: 44,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
    },
    cancelText: {
      fontSize: 15,
      color: theme.accent,
      fontWeight: '600',
    },
    filterRow: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 10,
    },
    filterPill: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      marginRight: 10,
    },
    filterPillText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    recentSection: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    recentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    recentTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      letterSpacing: 0.5,
    },
    clearAllText: {
      fontSize: 13,
      color: theme.accent,
      fontWeight: '600',
    },
    recentEmpty: {
      fontSize: 14,
      color: theme.textTertiary,
    },
    recentChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    recentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 20,
      paddingLeft: 14,
      paddingRight: 10,
      paddingVertical: 8,
    },
    recentChipText: {
      fontSize: 14,
      color: theme.text,
    },
    loadingWrap: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    resultsContent: {
      paddingBottom: 24,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    resultThumbWrap: {
      width: 44,
      height: 44,
      borderRadius: 10,
      overflow: 'hidden',
    },
    resultThumb: {
      width: 44,
      height: 44,
      borderRadius: 10,
    },
    placeThumb: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeEmoji: {
      fontSize: 20,
    },
    avatarPlaceholder: {
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.accentText,
    },
    resultContent: {
      flex: 1,
      minWidth: 0,
    },
    resultTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 2,
    },
    resultSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    typeTag: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 9,
      letterSpacing: 0.5,
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: 48,
      paddingHorizontal: 32,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
    },
  });
