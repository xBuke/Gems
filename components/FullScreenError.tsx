import { HapticPressable } from '@/components/HapticPressable';
import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type FullScreenErrorProps = {
  contentLabel: string;
  onRetry: () => void;
};

export function FullScreenError({ contentLabel, onRetry }: FullScreenErrorProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: theme.bgTertiary }]}>
          <Ionicons name="cloud-offline-outline" size={36} color={theme.textSecondary} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>
          Can't load {contentLabel}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Check your connection and try again
        </Text>
        <HapticPressable
          haptic="medium"
          onPress={onRetry}
          style={[styles.button, { backgroundColor: theme.accent }]}>
          <Text style={[styles.buttonText, { color: theme.accentText }]}>Try Again</Text>
        </HapticPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 0.5,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  buttonText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 13,
    fontWeight: '700',
  },
});
