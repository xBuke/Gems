import {
  Platform,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type PressableScaleProps = PressableProps & {
  androidRippleColor?: string;
  activeOpacity?: number;
};

export const PressableScale = ({
  children,
  style,
  onPressIn,
  onPressOut,
  activeOpacity,
  androidRippleColor,
  disabled,
  ...props
}: PressableScaleProps) => {
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

  const resolveStyle = (state: PressableStateCallbackType) => {
    const baseStyle = typeof style === 'function' ? style(state) : style;
    if (activeOpacity != null && activeOpacity < 1 && state.pressed) {
      return [baseStyle, { opacity: activeOpacity }];
    }
    return baseStyle;
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        {...props}
        disabled={disabled}
        style={resolveStyle}
        android_ripple={
          Platform.OS === 'android' && androidRippleColor
            ? { color: androidRippleColor, borderless: false }
            : undefined
        }
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}>
        {children}
      </Pressable>
    </Animated.View>
  );
};
