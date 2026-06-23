import { useEffect } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';

const SHIMMER_DARK = ['#142B2E', '#1e3e42', '#142B2E'] as const;
const SHIMMER_LIGHT = ['#dce8e6', '#edf6f4', '#dce8e6'] as const;

type SkeletonBoxProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  delay?: number;
  fadeIndex?: number;
  totalFadeCards?: number;
  style?: StyleProp<ViewStyle>;
};

export const SkeletonBox = ({
  width = '100%',
  height = 90,
  borderRadius = 12,
  delay = 0,
  fadeIndex,
  totalFadeCards = 3,
  style,
}: SkeletonBoxProps) => {
  const { theme, isDark } = useTheme();
  const progress = useSharedValue(0);
  const colors = isDark ? SHIMMER_DARK : SHIMMER_LIGHT;

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.linear }),
        -1,
        false,
      ),
    );
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const bg = interpolate(progress.value, [0, 0.5, 1], [0, 1, 2]);
    const colorIndex = Math.min(Math.floor(bg), colors.length - 1);
    const nextIndex = Math.min(colorIndex + 1, colors.length - 1);
    const frac = bg - colorIndex;

    const r1 = parseInt(colors[colorIndex].slice(1, 3), 16);
    const g1 = parseInt(colors[colorIndex].slice(3, 5), 16);
    const b1 = parseInt(colors[colorIndex].slice(5, 7), 16);
    const r2 = parseInt(colors[nextIndex].slice(1, 3), 16);
    const g2 = parseInt(colors[nextIndex].slice(3, 5), 16);
    const b2 = parseInt(colors[nextIndex].slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * frac);
    const g = Math.round(g1 + (g2 - g1) * frac);
    const b = Math.round(b1 + (b2 - b1) * frac);

    let opacity = 1;
    if (fadeIndex != null && fadeIndex >= totalFadeCards - 2) {
      opacity = fadeIndex === totalFadeCards - 1 ? 0.4 : 0.6;
    }

    return {
      backgroundColor: `rgb(${r},${g},${b})`,
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
        },
        style,
        animatedStyle,
      ]}
    />
  );
};

type SkeletonCardProps = SkeletonBoxProps;

export const SkeletonCard = ({
  width = '100%',
  height = 90,
  borderRadius = 12,
  delay = 0,
  fadeIndex,
  totalFadeCards = 3,
}: SkeletonCardProps) => (
  <SkeletonBox
    width={width}
    height={height}
    borderRadius={borderRadius}
    delay={delay}
    fadeIndex={fadeIndex}
    totalFadeCards={totalFadeCards}
    style={{ marginBottom: 10 }}
  />
);

type SkeletonListProps = {
  count?: number;
  height?: number;
  borderRadius?: number;
};

export const SkeletonList = ({ count = 3, height = 90, borderRadius = 12 }: SkeletonListProps) => (
  <View>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard
        key={i}
        height={height}
        borderRadius={borderRadius}
        delay={i * 200}
        fadeIndex={i}
        totalFadeCards={count}
      />
    ))}
  </View>
);

export const CommunityListSkeleton = () => (
  <View style={communitySkeletonStyles.list}>
    {Array.from({ length: 4 }).map((_, i) => (
      <View
        key={i}
        style={[communitySkeletonStyles.row, i === 3 && communitySkeletonStyles.rowFade]}>
        <SkeletonBox width={58} height={58} borderRadius={12} delay={i * 150} />
        <View style={communitySkeletonStyles.lines}>
          <SkeletonBox width="70%" height={14} borderRadius={6} delay={i * 150 + 50} />
          <SkeletonBox width="90%" height={12} borderRadius={6} delay={i * 150 + 100} />
          <SkeletonBox width="40%" height={10} borderRadius={6} delay={i * 150 + 150} />
        </View>
      </View>
    ))}
  </View>
);

export const TripPlannerResultsSkeleton = () => (
  <View>
    {Array.from({ length: 3 }).map((_, i) => (
      <View
        key={i}
        style={[tripResultSkeletonStyles.row, i === 2 && tripResultSkeletonStyles.rowFade]}>
        <SkeletonBox width={80} height={80} borderRadius={12} delay={i * 180} />
        <View style={tripResultSkeletonStyles.content}>
          <SkeletonBox width="40%" height={10} borderRadius={6} delay={i * 180 + 60} />
          <SkeletonBox width="75%" height={14} borderRadius={6} delay={i * 180 + 120} />
          <SkeletonBox width="55%" height={11} borderRadius={6} delay={i * 180 + 180} />
        </View>
      </View>
    ))}
  </View>
);

type GemSwipeDeckSkeletonProps = {
  cardWidth: number;
  cardHeight: number;
};

export const GemSwipeDeckSkeleton = ({ cardWidth, cardHeight }: GemSwipeDeckSkeletonProps) => {
  const { theme } = useTheme();

  return (
    <View style={gemSwipeSkeletonStyles.deckArea}>
      <View style={[gemSwipeSkeletonStyles.deckContainer, { width: cardWidth, height: cardHeight }]}>
        <View
          style={[
            gemSwipeSkeletonStyles.card,
            {
              width: cardWidth,
              height: cardHeight,
              transform: [{ scale: 0.9 }, { translateY: 16 }],
              opacity: 0.35,
            },
          ]}>
          <SkeletonBox
            width={cardWidth}
            height={cardHeight}
            borderRadius={24}
            delay={0}
            style={gemSwipeSkeletonStyles.cardFill}
          />
        </View>

        <View
          style={[
            gemSwipeSkeletonStyles.card,
            {
              width: cardWidth,
              height: cardHeight,
              transform: [{ scale: 0.95 }, { translateY: 8 }],
              opacity: 0.6,
            },
          ]}>
          <SkeletonBox
            width={cardWidth}
            height={cardHeight}
            borderRadius={24}
            delay={120}
            style={gemSwipeSkeletonStyles.cardFill}
          />
        </View>

        <View
          style={[
            gemSwipeSkeletonStyles.card,
            { width: cardWidth, height: cardHeight },
          ]}>
          <SkeletonBox
            width={cardWidth}
            height={cardHeight}
            borderRadius={24}
            delay={240}
            style={gemSwipeSkeletonStyles.cardFill}
          />
          <View style={gemSwipeSkeletonStyles.gradient} />
          <View style={gemSwipeSkeletonStyles.frontText}>
            <SkeletonBox width={60} height={20} borderRadius={10} delay={300} />
            <SkeletonBox width="75%" height={16} borderRadius={6} delay={360} />
            <SkeletonBox width="50%" height={11} borderRadius={6} delay={420} />
          </View>
        </View>
      </View>

      <View style={gemSwipeSkeletonStyles.actionButtons}>
        <View style={gemSwipeSkeletonStyles.actionButtonWrap}>
          <SkeletonBox
            width={60}
            height={60}
            borderRadius={30}
            delay={480}
            style={{ borderColor: theme.border }}
          />
        </View>
        <View style={[gemSwipeSkeletonStyles.actionButtonWrap, gemSwipeSkeletonStyles.actionButtonWrapSmall]}>
          <SkeletonBox
            width={46}
            height={46}
            borderRadius={23}
            delay={520}
            style={{ borderColor: theme.border }}
          />
        </View>
        <View style={gemSwipeSkeletonStyles.actionButtonWrap}>
          <SkeletonBox
            width={60}
            height={60}
            borderRadius={30}
            delay={560}
            style={{ borderColor: theme.border }}
          />
        </View>
      </View>
    </View>
  );
};

type SearchSpinnerProps = {
  color: string;
};

export const SearchSpinner = ({ color }: SearchSpinnerProps) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 800, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 14,
          height: 14,
          borderRadius: 7,
          borderWidth: 2,
          borderColor: color,
          borderTopColor: 'transparent',
        },
        spinStyle,
      ]}
    />
  );
};

const communitySkeletonStyles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  rowFade: {
    opacity: 0.6,
  },
  lines: {
    flex: 1,
    gap: 8,
  },
});

const tripResultSkeletonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    height: 80,
    marginBottom: 10,
    overflow: 'hidden',
  },
  rowFade: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
});

const gemSwipeSkeletonStyles = StyleSheet.create({
  deckArea: {
    flex: 1,
  },
  deckContainer: {
    flex: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    borderRadius: 24,
    overflow: 'hidden',
  },
  cardFill: {
    borderWidth: 0,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  frontText: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    gap: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
    paddingBottom: 32,
    paddingTop: 8,
  },
  actionButtonWrap: {
    opacity: 0.65,
  },
  actionButtonWrapSmall: {
    opacity: 0.55,
  },
});
