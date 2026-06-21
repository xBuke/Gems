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
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  if (!achievement) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.75)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}>
        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: 24,
            padding: 32,
            alignItems: 'center',
            maxWidth: 320,
          }}>
          <Animated.View
            style={[
              {
                width: 90,
                height: 90,
                borderRadius: 45,
                backgroundColor: theme.accentSubtle,
                borderWidth: 2,
                borderColor: theme.accent,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
              },
              animatedStyle,
            ]}>
            <Ionicons name={achievement.icon as any} size={42} color={theme.accent} />
          </Animated.View>
          <Text
            style={{
              color: theme.coral,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1,
              marginBottom: 6,
            }}>
            ACHIEVEMENT UNLOCKED
          </Text>
          <Text
            style={{
              color: theme.text,
              fontSize: 20,
              fontWeight: '700',
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
              marginBottom: 20,
            }}>
            {achievement.description}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{
              backgroundColor: theme.accent,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 32,
            }}>
            <Text style={{ color: theme.accentText, fontWeight: '700' }}>Nice!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
