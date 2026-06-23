import { useTheme } from '@/lib/ThemeContext';
import { View } from 'react-native';

type CompassIconProps = {
  size?: number;
};

export function CompassIcon({ size = 64 }: CompassIconProps) {
  const { theme } = useTheme();
  const radius = size / 2;
  const haloPadding = 8;
  const needleWidth = 2;
  const needleHeight = Math.round(size * 0.25);
  const needleInset = Math.round(size * 0.16);
  const dotSize = Math.round(size * 0.11);

  return (
    <View
      style={{
        padding: haloPadding,
        borderRadius: radius + haloPadding,
        backgroundColor: theme.accentSub,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: 2,
          borderColor: theme.accent,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.background,
        }}>
        <View
          style={{
            position: 'absolute',
            top: needleInset,
            left: '50%',
            marginLeft: -needleWidth / 2,
            width: needleWidth,
            height: needleHeight,
            backgroundColor: theme.coral,
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: needleInset,
            left: '50%',
            marginLeft: -needleWidth / 2,
            width: needleWidth,
            height: needleHeight,
            backgroundColor: theme.accent,
            borderBottomLeftRadius: 2,
            borderBottomRightRadius: 2,
          }}
        />
        <View
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: theme.accent,
          }}
        />
      </View>
    </View>
  );
}
