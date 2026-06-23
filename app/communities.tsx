import { EmptyState } from '@/components/EmptyState'
import { PressableScale } from '@/components/PressableScale'
import { SegmentedPill } from '@/components/SegmentedPill'
import { CommunityListSkeleton } from '@/components/SkeletonCard'
import {
  canJoinMoreCommunities,
  fetchCommunities,
  fetchMyCommunities,
  getCommunityMemberCount,
} from '@/lib/communities'
import { hapticLight } from '@/lib/haptics'
import { checkIsPremium } from '@/lib/paywall'
import { useTheme } from '@/lib/ThemeContext'
import type { Theme } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type CommunityTab = 'discover' | 'mine'

type Community = {
  id: string
  name: string
  description?: string | null
  location_focus?: string | null
  icon: string
  color: string
  creator?: { username: string } | null
}

export default function CommunitiesScreen() {
  const { theme } = useTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<CommunityTab>('discover')
  const [discoverCommunities, setDiscoverCommunities] = useState<Community[]>([])
  const [myCommunities, setMyCommunities] = useState<Community[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)

    const premium = await checkIsPremium()
    setIsPremium(premium)

    const [discover, mine] = await Promise.all([
      fetchCommunities(),
      user ? fetchMyCommunities(user.id) : Promise.resolve([]),
    ])

    setDiscoverCommunities(discover as Community[])
    setMyCommunities(mine as Community[])
    setJoinedIds(new Set((mine as Community[]).map((c) => c.id)))

    const allIds = [...new Set([...(discover as Community[]).map((c) => c.id), ...(mine as Community[]).map((c) => c.id)])]
    const counts: Record<string, number> = {}
    await Promise.all(
      allIds.map(async (id) => {
        counts[id] = await getCommunityMemberCount(id)
      }),
    )
    setMemberCounts(counts)
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData]),
  )

  const handleCreatePress = async () => {
    const premium = await checkIsPremium()
    if (!premium) {
      router.push('/paywall')
      return
    }
    router.push('/create-community')
  }

  const handleJoin = async (communityId: string) => {
    if (!userId || joinedIds.has(communityId)) return

    const allowed = await canJoinMoreCommunities(userId)
    if (!allowed) {
      Alert.alert(
        'Community limit reached',
        'Free users can join 1 community. Upgrade for unlimited!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/paywall') },
        ],
      )
      return
    }

    setJoiningId(communityId)
    hapticLight()
    try {
      const { error } = await supabase.from('community_members').insert({
        user_id: userId,
        community_id: communityId,
      })

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      setJoinedIds((prev) => new Set(prev).add(communityId))
      setMemberCounts((prev) => ({
        ...prev,
        [communityId]: (prev[communityId] ?? 0) + 1,
      }))
    } finally {
      setJoiningId(null)
    }
  }

  const renderCommunityCard = (community: Community, showJoinButton: boolean) => {
    const isJoined = joinedIds.has(community.id)
    const count = memberCounts[community.id] ?? 0

    return (
      <TouchableOpacity
        key={community.id}
        style={styles.card}
        onPress={() => router.push('/community/' + community.id)}
        activeOpacity={0.85}>
        <View style={styles.cardTop}>
          <View style={[styles.iconCircle, { backgroundColor: community.color }]}>
            <Ionicons
              name={community.icon as keyof typeof Ionicons.glyphMap}
              size={22}
              color="#FFFFFF"
            />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>
              {community.name}
            </Text>
            {community.description ? (
              <Text style={styles.cardDescription} numberOfLines={2}>
                {community.description}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.cardBottom}>
          <View style={styles.cardMeta}>
            <View style={styles.memberCount}>
              <Ionicons name="people" size={14} color={theme.textSecondary} />
              <Text style={styles.memberCountText}>{count}</Text>
            </View>
            {community.location_focus ? (
              <View style={styles.locationTag}>
                <Ionicons name="location" size={12} color={theme.accent} />
                <Text style={styles.locationTagText} numberOfLines={1}>
                  {community.location_focus}
                </Text>
              </View>
            ) : null}
          </View>

          {showJoinButton && (
            <PressableScale
              style={[styles.joinButton, isJoined && styles.joinedButton]}
              onPress={() => {
                if (!isJoined) handleJoin(community.id)
              }}
              disabled={isJoined || joiningId === community.id}>
              {joiningId === community.id ? (
                <ActivityIndicator size="small" color={isJoined ? theme.accent : theme.accentText} />
              ) : (
                <Text style={[styles.joinButtonText, isJoined && styles.joinedButtonText]}>
                  {isJoined ? 'Joined' : 'Join'}
                </Text>
              )}
            </PressableScale>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmptyMine = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={48} color={theme.textTertiary} />
      <Text style={styles.emptyText}>You haven't joined any communities yet</Text>
      <PressableScale style={styles.emptyButton} onPress={() => setActiveTab('discover')}>
        <Text style={styles.emptyButtonText}>Browse Communities</Text>
      </PressableScale>
    </View>
  )

  const listData = activeTab === 'discover' ? discoverCommunities : myCommunities

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Communities</Text>
        <PressableScale
          onPress={handleCreatePress}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.createButton}>
          <Text style={styles.createButtonText}>+ Create</Text>
          <Text style={styles.createButtonGem}>💎</Text>
        </PressableScale>
      </View>

      <View style={styles.pillWrapper}>
        <SegmentedPill
          tabs={[
            { key: 'discover', label: 'Discover' },
            { key: 'mine', label: `Mine (${myCommunities.length})` },
          ]}
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'discover' | 'mine')}
          theme={theme}
          width={250}
        />
      </View>

      {loading ? (
        <CommunityListSkeleton />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            listData.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => renderCommunityCard(item, activeTab === 'discover')}
          ListEmptyComponent={
            activeTab === 'mine' ? (
              renderEmptyMine()
            ) : (
              <EmptyState
                icon="people-circle-outline"
                title="No communities found"
                subtitle="Check back later as new communities are created"
              />
            )
          }
        />
      )}
    </SafeAreaView>
  )
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerSide: {
      width: 80,
      alignItems: 'flex-start',
    },
    headerTitle: {
      flex: 1,
      fontSize: 17,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.text,
      textAlign: 'center',
    },
    createButton: {
      width: 80,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 2,
    },
    createButtonText: {
      fontSize: 13,
      fontFamily: 'SpaceGrotesk-Bold',
      fontWeight: '700',
      color: theme.accent,
    },
    createButtonGem: {
      fontSize: 11,
    },
    pillWrapper: {
      alignItems: 'center',
      marginBottom: 14,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    listContentEmpty: {
      flexGrow: 1,
    },
    card: {
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
    },
    cardTop: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardInfo: {
      flex: 1,
    },
    cardName: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 15,
      color: theme.text,
      marginBottom: 4,
    },
    cardDescription: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 17,
    },
    cardBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardMeta: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginRight: 8,
    },
    memberCount: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    memberCountText: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 12,
      color: theme.textSecondary,
    },
    locationTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: theme.accentSub,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
      maxWidth: 140,
    },
    locationTagText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    joinButton: {
      backgroundColor: theme.accent,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 6,
      minWidth: 64,
      alignItems: 'center',
    },
    joinedButton: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    joinButtonText: {
      fontSize: 13,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.accentText,
    },
    joinedButtonText: {
      color: theme.accent,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      gap: 12,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    emptyButton: {
      backgroundColor: theme.accent,
      borderRadius: 10,
      paddingHorizontal: 20,
      paddingVertical: 12,
      marginTop: 8,
    },
    emptyButtonText: {
      fontSize: 14,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.accentText,
    },
  })
