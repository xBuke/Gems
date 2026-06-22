import { formatCoordinates } from '@/lib/coordinates';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTheme } from '@/lib/ThemeContext';
import { ACHIEVEMENTS } from '@/lib/gamification';
import { hapticSuccess } from '@/lib/haptics';

const EASTER_EGG_COORDS = { latitude: 43.0512, longitude: 17.4291 };

type Props = {
  visible: boolean;
  badgeType: string | null;
  onClose: () => void;
};

export const AchievementUnlockModal = ({ visible, badgeType, onClose }: Props) => {
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

  const coordLabel = formatCoordinates(EASTER_EGG_COORDS.latitude, EASTER_EGG_COORDS.longitude);

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
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 24 },
            shadowOpacity: 0.6,
            shadowRadius: 64,
            elevation: 12,
          }}>
          <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <View
              style={{
                position: 'absolute',
                width: 240,
                height: 240,
                borderRadius: 120,
                top: -60,
                backgroundColor: theme.accent + '2E',
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: 126,
                height: 126,
                borderRadius: 63,
                backgroundColor: theme.accent + '0A',
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: 110,
                height: 110,
                borderRadius: 55,
                backgroundColor: theme.accent + '14',
              }}
            />
            <Animated.View
              style={[
                {
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  backgroundColor: theme.accent + '1F',
                  borderWidth: 2,
                  borderColor: theme.accent,
                  justifyContent: 'center',
                  alignItems: 'center',
                },
                animatedStyle,
              ]}>
              <Ionicons name={achievement.icon as any} size={38} color={theme.accent} />
            </Animated.View>
          </View>
          <Text
            style={{
              color: theme.coral,
              fontSize: 11,
              fontFamily: 'SpaceMono-Bold',
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 8,
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
            }}>
            {achievement.name}
          </Text>
          <Text
            style={{
              color: theme.textSecondary,
              fontSize: 13,
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 8,
            }}>
            {achievement.description}
          </Text>
          <Text
            style={{
              fontFamily: 'SpaceMono-Regular',
              fontSize: 10,
              color: theme.textSecondary,
              marginBottom: 20,
            }}>
            {coordLabel}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{
              alignSelf: 'stretch',
              backgroundColor: theme.accent,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
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
