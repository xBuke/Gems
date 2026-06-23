import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

type CompassIconProps = {
  size?: number;
  variant?: 'default' | 'complete';
  /** Renders without the outer halo — for use inside EmptyState's icon circle */
  embedded?: boolean;
};

export function CompassIcon({ size = 64, variant = 'default', embedded = false }: CompassIconProps) {
  const { theme } = useTheme();
  const radius = size / 2;
  const haloPadding = 8;
  const needleWidth = 2;
  const needleHeight = Math.round(size * 0.25);
  const needleInset = Math.round(size * 0.16);
  const dotSize = Math.round(size * 0.11);

  const compassFace = (
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
          opacity: variant === 'complete' ? 0.5 : 1,
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
      {variant === 'complete' ? (
        <Ionicons name="checkmark" size={Math.round(size * 0.28)} color={theme.accent} />
      ) : (
        <View
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: theme.accent,
          }}
        />
      )}
    </View>
  );

  if (embedded) {
    return compassFace;
  }

  return (
    <View
      style={{
        padding: haloPadding,
        borderRadius: radius + haloPadding,
        backgroundColor: theme.accentSub,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {compassFace}
    </View>
  );
}
