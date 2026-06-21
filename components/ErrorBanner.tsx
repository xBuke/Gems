import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';

type ErrorBannerProps = {
  message: string;
  onRetry: () => void;
};

export const ErrorBanner = ({ message, onRetry }: ErrorBannerProps) => {
  const { theme } = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 12,
        padding: 14,
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 0.5,
        borderColor: theme.danger,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}>
      <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
      <Text style={{ color: theme.text, fontSize: 13, flex: 1 }}>{message}</Text>
      <TouchableOpacity onPress={onRetry}>
        <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
};
