import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';

export const SkeletonCard = ({
  height = 90,
  borderRadius = 12,
}: {
  height?: number;
  borderRadius?: number;
}) => {
  const { theme } = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.5, 1]),
  }));

  return (
    <Animated.View
      style={[
        {
          height,
          borderRadius,
          backgroundColor: theme.card,
          borderWidth: 0.5,
          borderColor: theme.border,
          marginBottom: 10,
        },
        animatedStyle,
      ]}
    />
  );
};
