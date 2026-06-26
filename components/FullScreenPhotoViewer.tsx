import { shouldTrackGemShare, trackGemShare } from '@/lib/gemShareTracking';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FullScreenPhotoViewerProps = {
  visible: boolean;
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
  gemId?: string;
  currentUserId?: string | null;
  gemTitle?: string;
  gemCategory?: string;
  gemUsername?: string;
  likeCount?: number;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

const AnimatedFlatList = Animated.FlatList;

export default function FullScreenPhotoViewer({
  visible,
  photos,
  initialIndex = 0,
  onClose,
  gemId,
  currentUserId,
  gemTitle,
  gemCategory,
  gemUsername,
  likeCount = 0,
}: FullScreenPhotoViewerProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<Animated.FlatList<string>>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    setActiveIndex(initialIndex);
    translateY.value = 0;
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    });
  }, [visible, initialIndex, translateY]);

  useEffect(() => {
    if (!visible || !gemId || !currentUserId) {
      setIsBookmarked(false);
      return;
    }

    let cancelled = false;

    const loadBookmarkState = async () => {
      const { data } = await supabase
        .from('saved_gems')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('gem_id', gemId)
        .eq('skipped', false)
        .maybeSingle();

      if (!cancelled) {
        setIsBookmarked(!!data);
      }
    };

    void loadBookmarkState();

    return () => {
      cancelled = true;
    };
  }, [visible, gemId, currentUserId]);

  const handleClose = useCallback(() => {
    translateY.value = 0;
    onClose();
  }, [onClose, translateY]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(12)
        .failOffsetX([-24, 24])
        .onUpdate((event) => {
          if (event.translationY > 0) {
            translateY.value = event.translationY;
          }
        })
        .onEnd((event) => {
          if (
            event.translationY > DISMISS_DISTANCE ||
            event.velocityY > DISMISS_VELOCITY
          ) {
            translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 }, () => {
              runOnJS(handleClose)();
            });
            return;
          }

          translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
        }),
    [handleClose, translateY],
  );

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: 1 - Math.min(translateY.value / SCREEN_HEIGHT, 0.35),
  }));

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setActiveIndex(index);
    },
    [],
  );

  const handleShare = useCallback(async () => {
    if (!gemTitle) return;

    try {
      const result = await Share.share({
        message: `Check out ${gemTitle} on Abdita Gems! 📍`,
      });
      if (gemId && shouldTrackGemShare(result)) {
        trackGemShare(gemId);
      }
    } catch {
      // User dismissed share sheet
    }
  }, [gemId, gemTitle]);

  const handleBookmark = useCallback(async () => {
    if (!gemId || !currentUserId) return;

    if (isBookmarked) {
      const { error } = await supabase
        .from('saved_gems')
        .delete()
        .eq('user_id', currentUserId)
        .eq('gem_id', gemId);

      if (!error) {
        setIsBookmarked(false);
      }
      return;
    }

    const { error } = await supabase.from('saved_gems').upsert(
      {
        user_id: currentUserId,
        gem_id: gemId,
        skipped: false,
      },
      { onConflict: 'user_id,gem_id' },
    );

    if (!error) {
      setIsBookmarked(true);
    }
  }, [currentUserId, gemId, isBookmarked]);

  const styles = useMemo(() => createStyles(theme), [theme]);
  const showGemInfo = Boolean(gemTitle && gemCategory && gemUsername);

  if (!visible || photos.length === 0) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <StatusBar
        style="light"
        {...(Platform.OS === 'android' ? { backgroundColor: '#000000', translucent: false } : {})}
      />
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.container, containerAnimatedStyle]}>
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <View style={styles.topBarSide} />
            <Text style={styles.pageCounter}>
              {activeIndex + 1} / {photos.length}
            </Text>
            <View style={[styles.topBarSide, styles.topBarActions]}>
              {gemId && currentUserId ? (
                <Pressable
                  style={styles.actionButton}
                  onPress={() => void handleBookmark()}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons
                    name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color="#FFFFFF"
                  />
                </Pressable>
              ) : null}
              {gemTitle ? (
                <Pressable
                  style={styles.actionButton}
                  onPress={() => void handleShare()}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                </Pressable>
              ) : null}
            </View>
          </View>

          <AnimatedFlatList
            ref={listRef}
            data={photos}
            keyExtractor={(uri, index) => `${uri}-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onMomentumScrollEnd={onMomentumScrollEnd}
            renderItem={({ item }) => (
              <View style={styles.slide}>
                <Image
                  source={{ uri: item }}
                  style={styles.image}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </View>
            )}
          />

          {showGemInfo ? (
            <View style={[styles.bottomInfo, { paddingBottom: insets.bottom + 28 }]}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{gemCategory}</Text>
              </View>
              <Text style={styles.gemTitle} numberOfLines={2}>
                {gemTitle}
              </Text>
              <Text style={styles.attribution} numberOfLines={1}>
                by @{gemUsername} · ♥ {likeCount}
              </Text>
            </View>
          ) : null}

          {photos.length > 1 ? (
            <View
              style={[
                styles.dotsRow,
                { bottom: (showGemInfo ? insets.bottom + 108 : insets.bottom + 16) },
              ]}>
              {photos.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === activeIndex ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const createStyles = (theme: { accent: string }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    topBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
    },
    topBarSide: {
      flex: 1,
    },
    topBarActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
    },
    pageCounter: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 11,
      color: 'rgba(255,255,255,0.7)',
      textAlign: 'center',
    },
    actionButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    slide: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
    },
    bottomInfo: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    categoryBadge: {
      alignSelf: 'flex-start',
      borderWidth: 0.5,
      borderColor: theme.accent,
      backgroundColor: 'rgba(45,212,191,0.15)',
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 20,
      marginBottom: 8,
    },
    categoryBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.85)',
    },
    gemTitle: {
      color: '#FFFFFF',
      fontSize: 20,
      fontFamily: 'SpaceGrotesk-Bold',
      marginBottom: 4,
    },
    attribution: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.7)',
    },
    dotsRow: {
      position: 'absolute',
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      alignItems: 'center',
    },
    dot: {
      height: 6,
      borderRadius: 3,
    },
    dotInactive: {
      width: 6,
      backgroundColor: 'rgba(255,255,255,0.4)',
    },
    dotActive: {
      width: 18,
      backgroundColor: theme.accent,
    },
  });
