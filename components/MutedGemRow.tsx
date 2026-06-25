import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type MutedGemRowProps = {
  imageUrl: string | null;
  username: string;
  onUnmute: () => void;
  compact?: boolean;
};

export function MutedGemRow({ imageUrl, username, onUnmute, compact = false }: MutedGemRowProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <View style={styles.thumbnailWrap}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
        )}
      </View>
      <View style={styles.textCol}>
        <Text style={styles.hiddenLabel} numberOfLines={1}>
          Hidden gem by @{username}
        </Text>
        <Text style={styles.mutedLine}>
          <Text style={styles.mutedText}>Muted </Text>
          <Text style={styles.mutedDot}>· </Text>
          <Text style={styles.unmuteLink} onPress={onUnmute}>
            Unmute
          </Text>
        </Text>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 12,
      borderWidth: 0.5,
      borderStyle: 'dashed',
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.card,
      opacity: 0.85,
    },
    rowCompact: {
      width: 220,
      marginHorizontal: 0,
      marginBottom: 0,
    },
    thumbnailWrap: {
      width: 40,
      height: 40,
      borderRadius: 8,
      overflow: 'hidden',
    },
    thumbnail: {
      width: 40,
      height: 40,
      opacity: 0.4,
    },
    thumbnailPlaceholder: {
      backgroundColor: theme.bgTertiary,
      opacity: 0.4,
    },
    textCol: {
      flex: 1,
      gap: 2,
    },
    hiddenLabel: {
      fontSize: 12,
      color: theme.textTertiary,
    },
    mutedLine: {
      fontSize: 11,
    },
    mutedText: {
      color: theme.textTertiary,
    },
    mutedDot: {
      color: theme.textTertiary,
    },
    unmuteLink: {
      color: theme.textSecondary,
      fontWeight: '600',
    },
  });
