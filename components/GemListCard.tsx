import { CATEGORIES } from '@/lib/categories'
import { formatCoordinates } from '@/lib/coordinates'
import { useTheme } from '@/lib/ThemeContext'
import type { Theme } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

const IMAGE_PLACEHOLDER = '#1A5C3A'

export type GemListCardGem = {
  id: string
  title: string
  category: string
  image_url: string | null
  latitude?: number
  longitude?: number
  profiles?: { username: string } | null
}

type GemListCardProps = {
  gem: GemListCardGem
  likeCount?: number
  locationLabel?: string | null
  onPress?: () => void
}

const getCategoryName = (categoryId: string) =>
  CATEGORIES.find((c) => c.id === categoryId)?.name ?? categoryId

export function GemListCard({ gem, likeCount = 0, locationLabel, onPress }: GemListCardProps) {
  const { theme } = useTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const username = gem.profiles?.username ?? 'unknown'
  const location =
    locationLabel ??
    (gem.latitude != null && gem.longitude != null
      ? formatCoordinates(gem.latitude, gem.longitude)
      : null)

  return (
    <TouchableOpacity
      style={styles.listCard}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}>
      <View style={styles.listCardImageWrap}>
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
        <View style={styles.listCategoryBadge}>
          <Text style={styles.listCategoryBadgeText}>{getCategoryName(gem.category)}</Text>
        </View>
        <Text style={styles.listCardTitle} numberOfLines={1}>
          {gem.title}
        </Text>
        <Text style={styles.listCardUsername}>@{username}</Text>
        <View style={styles.listCardMetaRow}>
          <View style={styles.listCardMetaItem}>
            <Ionicons name="heart-outline" size={12} color={theme.textSecondary} />
            <Text style={styles.listCardMetaText}>{likeCount}</Text>
          </View>
          {location ? (
            <>
              <Text style={styles.listCardMetaDivider}>|</Text>
              <View style={styles.listCardMetaItem}>
                <Ionicons name="location-outline" size={12} color={theme.textSecondary} />
                <Text style={styles.listCardMetaText} numberOfLines={1}>
                  {location}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  )
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
      backgroundColor: IMAGE_PLACEHOLDER,
    },
    listCardContent: {
      flex: 1,
      padding: 12,
      justifyContent: 'space-between',
    },
    listCategoryBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.accentSub,
      borderWidth: 0.5,
      borderColor: theme.accent,
      paddingVertical: 2,
      paddingHorizontal: 8,
      borderRadius: 20,
      marginBottom: 2,
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
      flexShrink: 1,
    },
    listCardMetaText: {
      fontSize: 11,
      fontFamily: 'SpaceMono-Regular',
      color: theme.textSecondary,
      flexShrink: 1,
    },
    listCardMetaDivider: {
      fontSize: 11,
      color: theme.textTertiary,
    },
  })
