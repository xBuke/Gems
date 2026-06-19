import {
  canJoinMoreCommunities,
  fetchCommunities,
  fetchMyCommunities,
  getCommunityMemberCount,
} from '@/lib/communities'
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
        activeOpacity={0.7}>
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
            <TouchableOpacity
              style={[styles.joinButton, isJoined && styles.joinedButton]}
              onPress={() => {
                if (!isJoined) handleJoin(community.id)
              }}
              disabled={isJoined || joiningId === community.id}
              activeOpacity={0.8}>
              {joiningId === community.id ? (
                <ActivityIndicator size="small" color={isJoined ? theme.accent : theme.accentText} />
              ) : (
                <Text style={[styles.joinButtonText, isJoined && styles.joinedButtonText]}>
                  {isJoined ? 'Joined' : 'Join'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmptyMine = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={48} color={theme.textTertiary} />
      <Text style={styles.emptyText}>You haven't joined any communities yet</Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => setActiveTab('discover')}
        activeOpacity={0.8}>
        <Text style={styles.emptyButtonText}>Browse Communities</Text>
      </TouchableOpacity>
    </View>
  )

  const listData = activeTab === 'discover' ? discoverCommunities : myCommunities

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Communities</Text>
        <TouchableOpacity onPress={handleCreatePress} activeOpacity={0.7} style={styles.createButton}>
          {isPremium ? (
            <Text style={styles.createButtonText}>+ Create</Text>
          ) : (
            <Ionicons name="lock-closed" size={20} color={theme.textSecondary} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
          onPress={() => setActiveTab('discover')}
          activeOpacity={0.8}>
          <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
            Discover
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'mine' && styles.tabActive]}
          onPress={() => setActiveTab('mine')}
          activeOpacity={0.8}>
          <Text style={[styles.tabText, activeTab === 'mine' && styles.tabTextActive]}>
            My Communities
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
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
          ListEmptyComponent={activeTab === 'mine' ? renderEmptyMine : undefined}
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
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerSide: {
      width: 60,
      alignItems: 'flex-start',
    },
    headerTitle: {
      fontSize: 17,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.text,
    },
    createButton: {
      width: 60,
      alignItems: 'flex-end',
    },
    createButtonText: {
      fontSize: 14,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.accent,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: theme.card,
      borderRadius: 10,
      padding: 4,
      marginHorizontal: 16,
      marginBottom: 16,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 8,
    },
    tabActive: {
      backgroundColor: theme.accent,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    tabTextActive: {
      color: theme.background,
      fontWeight: '600',
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
      backgroundColor: theme.accentSubtle,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
      maxWidth: 140,
    },
    locationTagText: {
      fontSize: 11,
      color: theme.accent,
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
