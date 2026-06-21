import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';

type EmptyStateProps = {
  icon: string;
  title: string;
  subtitle?: string;
  ctaText?: string;
  onCtaPress?: () => void;
};

export const EmptyState = ({
  icon,
  title,
  subtitle,
  ctaText,
  onCtaPress,
}: EmptyStateProps) => {
  const { theme } = useTheme();

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={56}
        color={theme.accent}
        style={{ marginBottom: 12 }}
      />
      <Text
        style={{
          color: theme.text,
          fontSize: 18,
          fontWeight: '600',
          textAlign: 'center',
        }}>
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            color: theme.textSecondary,
            fontSize: 13,
            textAlign: 'center',
            marginTop: 6,
          }}>
          {subtitle}
        </Text>
      ) : null}
      {ctaText && onCtaPress ? (
        <TouchableOpacity
          onPress={onCtaPress}
          style={{
            marginTop: 20,
            backgroundColor: theme.accent,
            borderRadius: 10,
            paddingVertical: 12,
            paddingHorizontal: 24,
          }}>
          <Text style={{ color: theme.accentText, fontSize: 14, fontWeight: '600' }}>
            {ctaText}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
