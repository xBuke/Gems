import { navigateToGemFromDiscover } from '@/lib/gemSharedTransition';
import { useReduceMotion } from '@/lib/ReduceMotionContext';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const LOCAL_PICK_COLOR = '#7F77DD';
const PIONEER_COLOR = '#FFD700';

export type DiscoverListCardGem = {
  id: string;
  title: string;
  category: string;
  image_url: string | null;
  is_local_pick?: boolean;
  is_first_in_area?: boolean;
  best_time?: string | null;
  profiles?: { username: string; avatar_url?: string | null } | null;
  communities?: {
    name: string;
    icon: string;
    color: string;
  } | null;
  community_id?: string | null;
};

type DiscoverListCardProps = {
  gem: DiscoverListCardGem;
  likeCount: number;
  distanceMeters?: number | null;
  showBestTime?: boolean;
  renderCommunityBadge?: (gem: DiscoverListCardGem) => React.ReactNode;
  renderLocalPickBadge?: () => React.ReactNode;
  renderPioneerBadge?: () => React.ReactNode;
  renderBestTimeHint?: (bestTime: string | null | undefined) => React.ReactNode;
  formatDistanceKm: (meters: number) => string;
};

export function DiscoverListCard({
  gem,
  likeCount,
  distanceMeters,
  showBestTime = false,
  renderCommunityBadge,
  renderLocalPickBadge,
  renderPioneerBadge,
  renderBestTimeHint,
  formatDistanceKm,
}: DiscoverListCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  const imageRef = useRef<View>(null);
  const titleRef = useRef<View>(null);
  const username = gem.profiles?.username ?? 'unknown';

  const handlePress = () => {
    navigateToGemFromDiscover(router, gem, { imageRef, titleRef }, reduceMotion);
  };

  return (
    <TouchableOpacity style={styles.listCard} onPress={handlePress} activeOpacity={0.85}>
      <View ref={imageRef} style={styles.listCardImageWrap} collapsable={false}>
        {gem.image_url ? (
          <Image
            source={{ uri: gem.image_url }}
            style={styles.listCardImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.listCardImage, styles.listCardImagePlaceholder]} />
        )}
      </View>
      <View style={styles.listCardContent}>
        {renderCommunityBadge?.(gem)}
        <View style={styles.listBadgeRow}>
          <View style={styles.listCategoryBadge}>
            <Text style={styles.listCategoryBadgeText}>{gem.category}</Text>
          </View>
          {gem.is_local_pick && renderLocalPickBadge?.()}
          {gem.is_first_in_area && renderPioneerBadge?.()}
        </View>
        <View ref={titleRef} collapsable={false}>
          <Text style={styles.listCardTitle} numberOfLines={1}>
            {gem.title}
          </Text>
        </View>
        <Text style={styles.listCardUsername} numberOfLines={1} ellipsizeMode="tail">
          @{username}
        </Text>
        {showBestTime && renderBestTimeHint?.(gem.best_time)}
        <View style={styles.listCardMetaRow}>
          <View style={styles.listCardMetaItem}>
            <Ionicons name="heart-outline" size={12} color={theme.textSecondary} />
            <Text style={styles.listCardMetaText}>{likeCount}</Text>
          </View>
          {distanceMeters != null && (
            <>
              <Text style={styles.listCardMetaDivider}>|</Text>
              <View style={styles.listCardMetaItem}>
                <Ionicons name="location-outline" size={12} color={theme.textSecondary} />
                <Text style={styles.listCardMetaText}>{formatDistanceKm(distanceMeters)}</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    listCard: {
      flexDirection: 'row',
      height: 90,
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    listCardImageWrap: {
      width: 90,
      height: 90,
    },
    listCardImage: {
      width: 90,
      height: 90,
      borderTopLeftRadius: 12,
      borderBottomLeftRadius: 12,
    },
    listCardImagePlaceholder: {
      backgroundColor: theme.bgTertiary,
    },
    listCardContent: {
      flex: 1,
      padding: 12,
      justifyContent: 'space-between',
    },
    listBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 2,
    },
    listCategoryBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.accentSub,
      borderWidth: 0.5,
      borderColor: theme.accent,
      paddingVertical: 2,
      paddingHorizontal: 8,
      borderRadius: 20,
    },
    listCategoryBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    listCardTitle: {
      fontSize: 14,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.text,
    },
    listCardUsername: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    listCardMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    listCardMetaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    listCardMetaText: {
      fontSize: 11,
      fontFamily: 'SpaceMono-Regular',
      color: theme.textSecondary,
    },
    listCardMetaDivider: {
      fontSize: 11,
      color: theme.textTertiary,
    },
  });
