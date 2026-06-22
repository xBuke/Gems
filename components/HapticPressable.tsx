import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import {
  hapticLight,
  hapticMedium,
  hapticSuccess,
} from '@/lib/haptics';
import { useTheme } from '@/lib/ThemeContext';

type HapticType = 'light' | 'medium' | 'success';

type HapticPressableProps = PressableProps & {
  haptic?: HapticType;
  rippleColor?: string;
  style?: StyleProp<ViewStyle>;
};

const triggerHaptic = (type: HapticType) => {
  if (type === 'light') hapticLight();
  else if (type === 'medium') hapticMedium();
  else hapticSuccess();
};

export const HapticPressable = ({
  haptic,
  rippleColor,
  onPress,
  android_ripple,
  children,
  ...props
}: HapticPressableProps) => {
  const { theme } = useTheme();

  return (
    <Pressable
      {...props}
      android_ripple={
        android_ripple ?? {
          color: rippleColor ?? theme.accentSub,
          borderless: false,
        }
      }
      onPress={(e) => {
        if (haptic) triggerHaptic(haptic);
        onPress?.(e);
      }}>
      {children}
    </Pressable>
  );
};
