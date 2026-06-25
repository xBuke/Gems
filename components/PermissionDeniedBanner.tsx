import { useTheme } from '@/lib/ThemeContext';
import { semantic, type Theme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const WARNING_COLOR = semantic.warning;

type PermissionDeniedBannerProps = {
  title: string;
  description: string;
  dismissible?: boolean;
  onDismiss?: () => void;
};

export function PermissionDeniedBanner({
  title,
  description,
  dismissible = false,
  onDismiss,
}: PermissionDeniedBannerProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const handleOpenSettings = () => {
    void Linking.openSettings();
  };

  return (
    <View style={styles.container}>
      <Ionicons name="warning-outline" size={18} color={WARNING_COLOR} />
      <View style={styles.textColumn}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={handleOpenSettings}
        activeOpacity={0.8}>
        <Text style={styles.settingsButtonText}>Open Settings</Text>
        <Ionicons name="chevron-forward" size={12} color={theme.accentText} />
      </TouchableOpacity>
      {dismissible ? (
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          style={styles.dismissButton}>
          <Ionicons name="close" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.bgTertiary,
      borderWidth: 0.5,
      borderColor: WARNING_COLOR,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    textColumn: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontWeight: '700',
      color: theme.text,
      fontSize: 13,
      marginBottom: 2,
    },
    description: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    settingsButton: {
      backgroundColor: theme.accent,
      borderRadius: 8,
      paddingVertical: 7,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    settingsButtonText: {
      color: theme.accentText,
      fontSize: 12,
      fontWeight: '700',
    },
    dismissButton: {
      marginLeft: -4,
    },
  });
