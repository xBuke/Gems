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
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
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
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.65;
const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 800;

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
  onSwipeComplete: (action: 'save' | 'skip') => void;
  triggerRef: React.MutableRefObject<((action: 'save' | 'skip') => void) | null>;
  promoteOnMount?: boolean;
};

function SwipeCard({ gem, distanceMeters, theme, onSwipeComplete, triggerRef, promoteOnMount }: SwipeCardProps) {
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
          <Text style={cardStyles.cardTitle}>{gem.title}</Text>
          <Text style={cardStyles.cardMeta}>
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
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
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
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [checkingPremium, setCheckingPremium] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [loadingDeck, setLoadingDeck] = useState(true);
  const [deck, setDeck] = useState<Gem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);

  const swipeTriggerRef = useRef<((action: 'save' | 'skip') => void) | null>(null);
  const processingRef = useRef(false);
  const [hasSwiped, setHasSwiped] = useState(false);

  const fetchDeck = useCallback(async (myId: string, categoryFilter: string | null) => {
    setLoadingDeck(true);

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

    const { data } = await query.limit(50);
    const filtered = data?.filter((g: { id: string }) => !seenIds.includes(g.id)) ?? [];
    const shuffled = shuffleArray(filtered).slice(0, 30);

    setDeck(shuffled as Gem[]);
    setHasSwiped(false);
    setLoadingDeck(false);
  }, []);

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
    fetchDeck(userId, selectedCategoryFilter);
  }, [isPremium, userId, selectedCategoryFilter, fetchDeck]);

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
    [deck, userId],
  );

  const handleButtonPress = (action: 'save' | 'skip') => {
    swipeTriggerRef.current?.(action);
  };

  const currentGem = deck[0];
  const nextGem = deck[1];

  const renderFilterSheet = () => (
    <Modal visible={filterVisible} transparent animationType="slide">
      <Pressable style={styles.filterOverlay} onPress={() => setFilterVisible(false)}>
        <Pressable style={styles.filterSheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.filterTitle}>Filter by Category</Text>

          <TouchableOpacity
            style={[styles.filterOption, !selectedCategoryFilter && styles.filterOptionActive]}
            onPress={() => {
              setSelectedCategoryFilter(null);
              setFilterVisible(false);
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
                setFilterVisible(false);
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
        </Pressable>
      </Pressable>
    </Modal>
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
          onPress={() => setFilterVisible(true)}
          style={styles.headerButton}
          activeOpacity={0.7}>
          <Ionicons name="options-outline" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      {loadingDeck ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>Finding gems for you...</Text>
        </View>
      ) : deck.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle-outline" size={56} color={theme.accent} />
          <Text style={styles.emptyTitle}>You&apos;ve seen them all!</Text>
          <Text style={styles.emptySubtitle}>Check back later for new gems</Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.accent }]}
            onPress={() => router.back()}
            activeOpacity={0.8}>
            <Text style={[styles.backButtonText, { color: theme.accentText }]}>Back to Discover</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
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
                onSwipeComplete={handleSwipeAction}
                triggerRef={swipeTriggerRef}
                promoteOnMount={hasSwiped}
              />
            )}
          </View>

          <Text style={styles.deckCounter}>
            {deck.length} gem{deck.length !== 1 ? 's' : ''} remaining
          </Text>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.card, borderColor: theme.danger }]}
              onPress={() => handleButtonPress('skip')}
              activeOpacity={0.8}>
              <Ionicons name="close" size={28} color={theme.danger} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonSmall, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => currentGem && router.push('/gem/' + currentGem.id)}
              activeOpacity={0.8}>
              <Ionicons name="diamond" size={20} color={theme.coral} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.card, borderColor: theme.accent }]}
              onPress={() => handleButtonPress('save')}
              activeOpacity={0.8}>
              <Ionicons name="heart" size={28} color={theme.accent} />
            </TouchableOpacity>
          </View>
        </>
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
      paddingHorizontal: 32,
      paddingTop: 60,
    },
    loadingText: {
      fontSize: 15,
      color: theme.textSecondary,
      marginTop: 16,
      textAlign: 'center',
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
      fontFamily: 'SpaceMono-Regular',
      fontSize: 11,
      color: theme.textTertiary,
      textAlign: 'center',
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 28,
      paddingBottom: 32,
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
    actionButtonSmall: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 20,
      color: theme.text,
      marginTop: 16,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    backButton: {
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 14,
      marginTop: 24,
    },
    backButtonText: {
      fontFamily: 'SpaceGrotesk-Bold',
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
