import {
  TouchableOpacity,
  type GestureResponderEvent,
  type TouchableOpacityProps,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export const PressableScale = ({
  children,
  style,
  onPressIn,
  onPressOut,
  activeOpacity,
  disabled,
  ...props
}: TouchableOpacityProps) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!disabled) {
      scale.value = withTiming(0.96, { duration: 100 });
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    scale.value = withTiming(1, { duration: 100 });
    onPressOut?.(e);
  };

  return (
    <Animated.View style={[animatedStyle, style]}>
      <TouchableOpacity
        {...props}
        disabled={disabled}
        activeOpacity={activeOpacity ?? 1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};
