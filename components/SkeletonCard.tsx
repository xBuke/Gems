import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
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

type SkeletonCardProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  delay?: number;
  fadeIndex?: number;
  totalFadeCards?: number;
};

export const SkeletonCard = ({
  width = '100%',
  height = 90,
  borderRadius = 12,
  delay = 0,
  fadeIndex,
  totalFadeCards = 3,
}: SkeletonCardProps) => {
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
          marginBottom: 10,
        },
        animatedStyle,
      ]}
    />
  );
};

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
