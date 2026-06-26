import { AchievementBadge, getAchievementAccentColor } from '@/components/AchievementBadge';
import { formatCoordinates } from '@/lib/coordinates';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '@/lib/ThemeContext';
import { ACHIEVEMENTS, type AchievementType } from '@/lib/gamification';
import { hapticSuccess } from '@/lib/haptics';

type Props = {
  visible: boolean;
  badgeType: string | null;
  onClose: () => void;
  latitude?: number;
  longitude?: number;
};

export const AchievementUnlockModal = ({ visible, badgeType, onClose, latitude, longitude }: Props) => {
  const { theme } = useTheme();
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);

  const achievement = ACHIEVEMENTS.find((a) => a.type === badgeType);

  useEffect(() => {
    if (visible) {
      hapticSuccess();
      scale.value = withSpring(1, { damping: 8, stiffness: 100 });
      rotation.value = withTiming(360, { duration: 600 });
    } else {
      scale.value = 0;
      rotation.value = 0;
    }
  }, [visible, scale, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  if (!achievement) return null;

  const accentColor = getAchievementAccentColor(achievement.type as AchievementType);
  const coordLabel =
    latitude != null && longitude != null ? formatCoordinates(latitude, longitude) : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.78)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}>
        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: 24,
            paddingTop: 28,
            paddingHorizontal: 20,
            paddingBottom: 24,
            alignItems: 'center',
            maxWidth: 320,
            width: '100%',
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 24 },
            shadowOpacity: 0.6,
            shadowRadius: 64,
            elevation: 12,
          }}>
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              width: 240,
              height: 120,
            }}>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -60,
                width: 240,
                height: 240,
                zIndex: 0,
              }}>
              <Svg width={240} height={240}>
                <Defs>
                  <RadialGradient id="achievementGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor={accentColor} stopOpacity={0.18} />
                    <Stop offset="65%" stopColor={accentColor} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="240" height="240" fill="url(#achievementGlow)" />
              </Svg>
            </View>
            <View style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: 124,
                  height: 124,
                  borderRadius: 62,
                  top: -18,
                  left: -18,
                  backgroundColor: accentColor + '0A',
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: 108,
                  height: 108,
                  borderRadius: 54,
                  top: -10,
                  left: -10,
                  backgroundColor: accentColor + '14',
                }}
              />
              <Animated.View style={animatedStyle}>
                <AchievementBadge type={achievement.type} size={72} />
              </Animated.View>
            </View>
          </View>
          <Text
            style={{
              color: theme.coral,
              fontSize: 11,
              fontFamily: 'SpaceMono-Bold',
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 8,
              zIndex: 1,
            }}>
            ACHIEVEMENT UNLOCKED
          </Text>
          <Text
            style={{
              color: theme.text,
              fontSize: 20,
              fontFamily: 'SpaceGrotesk-Bold',
              textAlign: 'center',
              marginBottom: 6,
              zIndex: 1,
            }}>
            {achievement.name}
          </Text>
          <Text
            style={{
              color: theme.textSecondary,
              fontSize: 13,
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: coordLabel ? 8 : 20,
              zIndex: 1,
            }}>
            {achievement.description}
          </Text>
          {coordLabel ? (
            <Text
              style={{
                fontFamily: 'SpaceMono-Regular',
                fontSize: 10,
                color: theme.accent,
                marginBottom: 20,
                zIndex: 1,
              }}>
              {coordLabel}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={onClose}
            style={{
              alignSelf: 'stretch',
              backgroundColor: theme.accent,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              zIndex: 1,
            }}>
            <Text
              style={{
                color: theme.accentText,
                fontFamily: 'SpaceGrotesk-Bold',
                fontSize: 15,
              }}>
              Nice!
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
