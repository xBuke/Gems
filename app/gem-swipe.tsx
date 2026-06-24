import { AppBottomSheetModal, type AppBottomSheetModalRef } from '@/components/AppBottomSheetModal';
import { FullScreenError } from '@/components/FullScreenError';
import { CompassIcon } from '@/components/CompassIcon';
import { EmptyState } from '@/components/EmptyState';
import { GemSwipeDeckSkeleton } from '@/components/SkeletonCard';
import { CATEGORIES } from '@/lib/categories';
import { formatCoordinates } from '@/lib/coordinates';
import { getDistance } from '@/lib/distance';
import {
  applyCommunityGemFilter,
  fetchMyCommunityIds,
  GEM_SELECT_WITH_COMMUNITY,
} from '@/lib/gemVisibility';
import { checkIsPremium } from '@/lib/paywall';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { navigateToGemWithSharedTransition, type GemTransitionRefs } from '@/lib/gemSharedTransition';
import { useReduceMotion } from '@/lib/ReduceMotionContext';
import { useToast } from '@/lib/ToastContext';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.65;
const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 800;

const SWIPE_RADIUS_OPTIONS = [10, 25, 50, 100, 200] as const;

type Gem = {
  id: string;
  title: string;
  category: string;
  image_url: string | null;
  verified: boolean;
  latitude: number;
  longitude: number;
  user_id: string;
  profiles: { username: string } | null;
};

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const formatDistanceKm = (meters: number) => {
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
};

type SwipeCardProps = {
  gem: Gem;
  distanceMeters: number | null;
  theme: Theme;
  isDark: boolean;
  onSwipeComplete: (action: 'save' | 'skip') => void;
  triggerRef: React.MutableRefObject<((action: 'save' | 'skip') => void) | null>;
  promoteOnMount?: boolean;
  transitionRefs?: GemTransitionRefs;
};

function SwipeCard({ gem, distanceMeters, theme, isDark, onSwipeComplete, triggerRef, promoteOnMount, transitionRefs }: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isAnimating = useSharedValue(false);
  const entryScale = useSharedValue(promoteOnMount ? 0.95 : 1);
  const entryOpacity = useSharedValue(promoteOnMount ? 0.5 : 1);
  const cat = CATEGORIES.find((c) => c.id === gem.category);
  const username = gem.profiles?.username ?? 'unknown';

  const finishSwipe = useCallback(
    (action: 'save' | 'skip') => {
      onSwipeComplete(action);
      translateX.value = 0;
      translateY.value = 0;
      isAnimating.value = false;
    },
    [onSwipeComplete, isAnimating, translateX, translateY],
  );

  const animateOffScreen = useCallback(
    (action: 'save' | 'skip') => {
      if (isAnimating.value) return;
      isAnimating.value = true;
      const target = action === 'save' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
      translateX.value = withTiming(target, { duration: 280 }, () => {
        runOnJS(finishSwipe)(action);
      });
    },
    [finishSwipe, isAnimating, translateX],
  );

  useEffect(() => {
    triggerRef.current = animateOffScreen;
    return () => {
      triggerRef.current = null;
    };
  }, [animateOffScreen, triggerRef]);

  useEffect(() => {
    if (promoteOnMount) {
      entryScale.value = withTiming(1, { duration: 250 });
      entryOpacity.value = withTiming(1, { duration: 250 });
    }
  }, [promoteOnMount, entryScale, entryOpacity]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (isAnimating.value) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.15;
    })
    .onEnd((event) => {
      if (isAnimating.value) return;

      const save =
        translateX.value > SWIPE_THRESHOLD ||
        (event.velocityX > VELOCITY_THRESHOLD && translateX.value > 0);
      const skip =
        translateX.value < -SWIPE_THRESHOLD ||
        (event.velocityX < -VELOCITY_THRESHOLD && translateX.value < 0);

      if (save) {
        isAnimating.value = true;
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 280 }, () => {
          runOnJS(finishSwipe)('save');
        });
      } else if (skip) {
        isAnimating.value = true;
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 280 }, () => {
          runOnJS(finishSwipe)('skip');
        });
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: entryScale.value },
      {
        rotate: `${interpolate(translateX.value, [-200, 0, 200], [-15, 0, 15], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  const saveStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 60, SWIPE_THRESHOLD], [0, 0.5, 1], Extrapolation.CLAMP),
  }));

  const skipStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, -60, 0], [1, 0.5, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Reanimated.View style={[cardStyles.card, cardStyle]}>
        <View
          ref={transitionRefs?.imageRef as RefObject<View> | undefined}
          style={cardStyles.cardImageMeasure}
          collapsable={false}>
          {gem.image_url ? (
            <Image
              source={{ uri: gem.image_url }}
              style={cardStyles.cardImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[cardStyles.cardImage, { backgroundColor: theme.bgTertiary }]} />
          )}
        </View>

        <View style={cardStyles.gradient} />

        {cat && (
          <View style={[cardStyles.categoryBadge, { backgroundColor: cat.color }]}>
            <Ionicons name={cat.icon as keyof typeof Ionicons.glyphMap} size={12} color="#FFFFFF" />
            <Text style={cardStyles.categoryBadgeText}>{cat.name}</Text>
          </View>
        )}

        {gem.verified && (
          <View style={[cardStyles.verifiedBadge, { backgroundColor: theme.coral }]}>
            <Ionicons name="compass" size={12} color="#FFFFFF" />
          </View>
        )}

        <View style={cardStyles.bottomText}>
          <View ref={transitionRefs?.titleRef as RefObject<View> | undefined} collapsable={false}>
            <Text style={cardStyles.cardTitle}>{gem.title}</Text>
          </View>
          <Text
            style={[
              cardStyles.cardMeta,
              { color: isDark ? 'rgba(234,246,244,0.75)' : 'rgba(11,26,28,0.75)' },
            ]}>
            @{username}
            {' · '}
            {formatCoordinates(gem.latitude, gem.longitude)}
            {distanceMeters != null ? ` · ${formatDistanceKm(distanceMeters)}` : ''}
          </Text>
        </View>

        <Reanimated.View style={[cardStyles.saveStamp, { borderColor: theme.accent }, saveStampStyle]}>
          <Text style={[cardStyles.saveStampText, { color: theme.accent }]}>SAVE</Text>
        </Reanimated.View>

        <Reanimated.View style={[cardStyles.skipStamp, { borderColor: theme.danger }, skipStampStyle]}>
          <Text style={[cardStyles.skipStampText, { color: theme.danger }]}>SKIP</Text>
        </Reanimated.View>
      </Reanimated.View>
    </GestureDetector>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'absolute',
  },
  cardImageMeasure: {
    width: '100%',
    height: '100%',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  categoryBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'SpaceGrotesk-Bold',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomText: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  cardTitle: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 22,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  cardMeta: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
  },
  saveStamp: {
    position: 'absolute',
    top: 48,
    left: 24,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    transform: [{ rotate: '-20deg' }],
  },
  saveStampText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 28,
    letterSpacing: 2,
  },
  skipStamp: {
    position: 'absolute',
    top: 48,
    right: 24,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    transform: [{ rotate: '20deg' }],
  },
  skipStampText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 28,
    letterSpacing: 2,
  },
});

export default function GemSwipeScreen() {
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [checkingPremium, setCheckingPremium] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [loadingDeck, setLoadingDeck] = useState(true);
  const [deckError, setDeckError] = useState<string | null>(null);
  const [deck, setDeck] = useState<Gem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const filterSheetRef = useRef<AppBottomSheetModalRef>(null);
  const [searchRadius, setSearchRadius] = useState<number>(25);
  const [sessionSaveCount, setSessionSaveCount] = useState(0);
  const [weeklyNewCount, setWeeklyNewCount] = useState<number | null>(null);

  const swipeTriggerRef = useRef<((action: 'save' | 'skip') => void) | null>(null);
  const swipeImageRef = useRef<View>(null);
  const swipeTitleRef = useRef<View>(null);
  const processingRef = useRef(false);
  const [hasSwiped, setHasSwiped] = useState(false);

  const fetchDeck = useCallback(
    async (
      myId: string,
      categoryFilter: string | null,
      coords: { latitude: number; longitude: number } | null,
      radiusKm: number,
    ) => {
      setLoadingDeck(true);
      setDeckError(null);

      try {
        const { data: alreadySeen } = await supabase
          .from('saved_gems')
          .select('gem_id')
          .eq('user_id', myId);

        const seenIds = alreadySeen?.map((s: { gem_id: string }) => s.gem_id) ?? [];

        const myCommunityIds = await fetchMyCommunityIds(myId);

        let query = supabase
          .from('gems')
          .select(GEM_SELECT_WITH_COMMUNITY)
          .eq('is_private', false)
          .neq('user_id', myId);

        query = applyCommunityGemFilter(query, myCommunityIds);

        if (categoryFilter) {
          query = query.eq('category', categoryFilter);
        }

        const { data, error } = await query;

        if (error) {
          setDeckError(error.message);
          setDeck([]);
          setHasSwiped(false);
          return;
        }

        let filtered =
          data?.filter((g: { id: string }) => !seenIds.includes(g.id)) ?? [];

        if (coords) {
          const radiusMeters = radiusKm * 1000;
          filtered = filtered.filter(
            (g: { latitude: number; longitude: number }) =>
              getDistance(coords.latitude, coords.longitude, g.latitude, g.longitude) <=
              radiusMeters,
          );
        }

        const shuffled = shuffleArray(filtered).slice(0, 30);

        setDeck(shuffled as Gem[]);
        setHasSwiped(false);
      } catch {
        setDeckError('Could not load gems');
        setDeck([]);
        setHasSwiped(false);
      } finally {
        setLoadingDeck(false);
      }
    },
    [],
  );

  useEffect(() => {
    const init = async () => {
      setCheckingPremium(true);
      const premium = await checkIsPremium();
      setIsPremium(premium);
      setCheckingPremium(false);

      if (!premium) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserCoords({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (!isPremium || !userId) return;
    fetchDeck(userId, selectedCategoryFilter, userCoords, searchRadius);
  }, [isPremium, userId, selectedCategoryFilter, searchRadius, userCoords, fetchDeck]);

  useEffect(() => {
    if (deck.length > 0 || !userCoords) {
      setWeeklyNewCount(null);
      return;
    }

    let cancelled = false;

    const fetchWeeklyNewCount = async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('gems')
        .select('latitude, longitude')
        .eq('is_private', false)
        .gte('created_at', weekAgo);

      if (cancelled || !data) return;

      const radiusMeters = searchRadius * 1000;
      const count = data.filter(
        (gem: { latitude: number; longitude: number }) =>
          getDistance(userCoords.latitude, userCoords.longitude, gem.latitude, gem.longitude) <=
          radiusMeters,
      ).length;

      if (!cancelled) {
        setWeeklyNewCount(count);
      }
    };

    fetchWeeklyNewCount();

    return () => {
      cancelled = true;
    };
  }, [deck.length, userCoords, searchRadius]);

  const nextRadius = SWIPE_RADIUS_OPTIONS.find((radius) => radius > searchRadius);

  const handleExpandRadius = useCallback(() => {
    if (nextRadius) {
      setSearchRadius(nextRadius);
    }
  }, [nextRadius]);

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

  const handleSwipeAction = useCallback(
    async (action: 'save' | 'skip') => {
      if (processingRef.current || !userId || deck.length === 0) return;
      processingRef.current = true;

      const currentGem = deck[0];

      if (action === 'save') {
        hapticMedium();
      } else {
        hapticLight();
      }

      if (action === 'save') {
        await supabase.from('saved_gems').insert({
          user_id: userId,
          gem_id: currentGem.id,
          skipped: false,
        });
        setSessionSaveCount((count) => count + 1);
        showToast({
          type: 'success',
          title: 'Gem saved!',
          message: `${currentGem.title} added to your list`,
        });
      } else {
        await supabase.from('saved_gems').insert({
          user_id: userId,
          gem_id: currentGem.id,
          skipped: true,
          skipped_at: new Date().toISOString(),
        });
      }

      setDeck((prev) => prev.slice(1));
      setHasSwiped(true);
      processingRef.current = false;
    },
    [deck, userId, showToast],
  );

  const retryFetchDeck = useCallback(() => {
    if (!userId) return;
    fetchDeck(userId, selectedCategoryFilter, userCoords, searchRadius);
  }, [fetchDeck, userId, selectedCategoryFilter, userCoords, searchRadius]);

  const handleButtonPress = (action: 'save' | 'skip') => {
    swipeTriggerRef.current?.(action);
  };

  const currentGem = deck[0];
  const nextGem = deck[1];

  const renderFilterSheet = () => (
    <AppBottomSheetModal
      ref={filterSheetRef}
      onClose={() => {}}
      snapPoints={['50%']}>
      <BottomSheetScrollView
        overScrollMode="never"
        bounces={Platform.OS === 'ios' ? false : undefined}
        contentContainerStyle={styles.filterSheet}>
        <Text style={styles.filterTitle}>Filter by Category</Text>

        <TouchableOpacity
          style={[styles.filterOption, !selectedCategoryFilter && styles.filterOptionActive]}
          onPress={() => {
            setSelectedCategoryFilter(null);
            filterSheetRef.current?.dismiss();
          }}
          activeOpacity={0.7}>
          <Text style={styles.filterOptionText}>All Categories</Text>
          {!selectedCategoryFilter && (
            <Ionicons name="checkmark" size={20} color={theme.accent} />
          )}
        </TouchableOpacity>

        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.filterOption,
              selectedCategoryFilter === cat.id && styles.filterOptionActive,
            ]}
            onPress={() => {
              setSelectedCategoryFilter(cat.id);
              filterSheetRef.current?.dismiss();
            }}
            activeOpacity={0.7}>
            <View style={styles.filterOptionLeft}>
              <View style={[styles.filterDot, { backgroundColor: cat.color }]}>
                <Ionicons name={cat.icon as keyof typeof Ionicons.glyphMap} size={12} color="#FFFFFF" />
              </View>
              <Text style={styles.filterOptionText}>{cat.name}</Text>
            </View>
            {selectedCategoryFilter === cat.id && (
              <Ionicons name="checkmark" size={20} color={theme.accent} />
            )}
          </TouchableOpacity>
        ))}
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );

  if (checkingPremium) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isPremium) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gem Swipe</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.premiumPrompt}>
          <Ionicons name="diamond" size={56} color={theme.coral} />
          <Text style={styles.premiumTitle}>Gem Swipe is Premium</Text>
          <Text style={styles.premiumSubtitle}>
            Discover gems faster with swipe-based exploration
          </Text>
          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: theme.accent }]}
            onPress={() => router.push('/paywall')}
            activeOpacity={0.8}>
            <Text style={[styles.upgradeButtonText, { color: theme.accentText }]}>
              Upgrade to Premium
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gem Swipe</Text>
        <TouchableOpacity
          onPress={() => filterSheetRef.current?.present()}
          style={styles.headerButton}
          activeOpacity={0.7}>
          <Ionicons name="options-outline" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      {loadingDeck ? (
        <GemSwipeDeckSkeleton cardWidth={CARD_WIDTH} cardHeight={CARD_HEIGHT} />
      ) : deckError ? (
        <FullScreenError contentLabel="gems" onRetry={retryFetchDeck} />
      ) : deck.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            iconNode={<CompassIcon size={56} variant="complete" embedded />}
            overline="AREA EXPLORED"
            title="You've seen everything nearby"
            subtitle={
              weeklyNewCount != null
                ? `${weeklyNewCount} new gem${weeklyNewCount === 1 ? '' : 's'} added in this area this week.`
                : undefined
            }
            accentLine="Check back tomorrow →"
            cta={nextRadius ? `Expand to ${nextRadius} km` : undefined}
            onCta={nextRadius ? handleExpandRadius : undefined}
            secondaryCta="Try Trip Planner instead"
            onSecondaryCta={() => router.push('/trip-planner')}
            secondaryOutline
            footer={
              sessionSaveCount > 0 ? (
                <View style={[styles.sessionChip, { backgroundColor: theme.bgTertiary }]}>
                  <Text style={[styles.sessionChipText, { color: theme.textSecondary }]}>
                    ❤ {sessionSaveCount} saved this session
                  </Text>
                </View>
              ) : undefined
            }
          />
        </View>
      ) : (
        <View style={styles.deckArea}>
          <View style={styles.deckContainer}>
            {nextGem && (
              <View style={[cardStyles.card, styles.nextCard]}>
                {nextGem.image_url ? (
                  <Image
                    source={{ uri: nextGem.image_url }}
                    style={cardStyles.cardImage}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={[cardStyles.cardImage, { backgroundColor: theme.bgTertiary }]} />
                )}
              </View>
            )}

            {currentGem && (
              <SwipeCard
                key={currentGem.id}
                gem={currentGem}
                distanceMeters={getGemDistance(currentGem)}
                theme={theme}
                isDark={isDark}
                onSwipeComplete={handleSwipeAction}
                triggerRef={swipeTriggerRef}
                promoteOnMount={hasSwiped}
                transitionRefs={{ imageRef: swipeImageRef, titleRef: swipeTitleRef }}
              />
            )}
          </View>

          <Text style={styles.deckCounter}>
            {deck.length} gem{deck.length !== 1 ? 's' : ''} remaining
          </Text>

          <View style={[styles.actionButtons, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.card, borderColor: theme.danger }]}
              onPress={() => handleButtonPress('skip')}
              activeOpacity={0.8}>
              <Ionicons name="close" size={28} color={theme.danger} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewDetailButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() =>
                currentGem &&
                navigateToGemWithSharedTransition(
                  router,
                  currentGem,
                  { imageRef: swipeImageRef, titleRef: swipeTitleRef },
                  reduceMotion,
                )
              }
              activeOpacity={0.8}>
              <Text style={styles.viewDetailEmoji}>💎</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.card, borderColor: theme.accent }]}
              onPress={() => handleButtonPress('save')}
              activeOpacity={0.8}>
              <Ionicons name="heart" size={28} color={theme.accent} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {renderFilterSheet()}
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
    },
    headerButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 17,
      color: theme.text,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sessionChip: {
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    sessionChipText: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 11,
    },
    premiumPrompt: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 12,
    },
    premiumTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 22,
      color: theme.text,
      textAlign: 'center',
      marginTop: 8,
    },
    premiumSubtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    upgradeButton: {
      borderRadius: 12,
      paddingHorizontal: 28,
      paddingVertical: 14,
      marginTop: 16,
    },
    upgradeButtonText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 16,
    },
    deckArea: {
      flex: 1,
      position: 'relative',
    },
    deckContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextCard: {
      transform: [{ scale: 0.95 }],
      opacity: 0.5,
    },
    deckCounter: {
      position: 'absolute',
      bottom: 110,
      left: 0,
      right: 0,
      fontFamily: 'SpaceMono-Regular',
      fontSize: 11,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 28,
      paddingTop: 8,
    },
    actionButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewDetailButton: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewDetailEmoji: {
      fontSize: 16,
    },
    filterOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    filterSheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
    },
    filterTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 18,
      color: theme.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    filterOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginBottom: 4,
    },
    filterOptionActive: {
      backgroundColor: theme.accentSub,
    },
    filterOptionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    filterDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterOptionText: {
      fontSize: 16,
      color: theme.text,
    },
  });
