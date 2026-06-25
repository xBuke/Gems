import { EmptyState } from '@/components/EmptyState'
import { getMyBlockedUsers, getMyMutedUsers, unblockUser, unmuteUser } from '@/lib/safety'
import { useTheme } from '@/lib/ThemeContext'
import type { Theme } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type BlockedUser = {
  id: string
  blocked_id: string
  blocked: { username: string } | null
}

type MutedUser = {
  id: string
  muted_id: string
  muted: { username: string } | null
}

type TabKey = 'blocked' | 'muted'

export default function BlockedUsersScreen() {
  const router = useRouter()
  const { theme } = useTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const [activeTab, setActiveTab] = useState<TabKey>('blocked')
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const fetchLists = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setBlockedUsers([])
      setMutedUsers([])
      setLoading(false)
      return
    }

    setUserId(user.id)
    const [blocked, muted] = await Promise.all([
      getMyBlockedUsers(user.id),
      getMyMutedUsers(user.id),
    ])
    setBlockedUsers(blocked as BlockedUser[])
    setMutedUsers(muted as MutedUser[])
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      fetchLists()
    }, [fetchLists]),
  )

  const handleUnblock = async (blockedId: string) => {
    if (!userId) return
    await unblockUser(userId, blockedId)
    setBlockedUsers((prev) => prev.filter((b) => b.blocked_id !== blockedId))
  }

  const handleUnmute = async (mutedId: string) => {
    if (!userId) return
    await unmuteUser(userId, mutedId)
    setMutedUsers((prev) => prev.filter((m) => m.muted_id !== mutedId))
  }

  const renderBlockedItem = ({ item }: { item: BlockedUser }) => {
    const username = item.blocked?.username ?? 'Unknown'
    const initial = username.charAt(0).toUpperCase()

    return (
      <View style={styles.userRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.username} numberOfLines={1}>
          @{username}
        </Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleUnblock(item.blocked_id)}
          activeOpacity={0.8}>
          <Text style={styles.actionText}>Unblock</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const renderMutedItem = ({ item }: { item: MutedUser }) => {
    const username = item.muted?.username ?? 'Unknown'
    const initial = username.charAt(0).toUpperCase()

    return (
      <View style={styles.userRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.username} numberOfLines={1}>
          @{username}
        </Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleUnmute(item.muted_id)}
          activeOpacity={0.8}>
          <Text style={styles.actionText}>Unmute</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const listData = activeTab === 'blocked' ? blockedUsers : mutedUsers
  const isEmpty = !loading && listData.length === 0

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked & Muted</Text>
        <View style={styles.headerSide} />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'blocked' && styles.tabActive]}
          onPress={() => setActiveTab('blocked')}
          activeOpacity={0.8}>
          <Text style={[styles.tabText, activeTab === 'blocked' && styles.tabTextActive]}>
            Blocked
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'muted' && styles.tabActive]}
          onPress={() => setActiveTab('muted')}
          activeOpacity={0.8}>
          <Text style={[styles.tabText, activeTab === 'muted' && styles.tabTextActive]}>
            Muted
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : isEmpty ? (
        <EmptyState
          icon={activeTab === 'blocked' ? 'shield-checkmark-outline' : 'volume-mute-outline'}
          title={activeTab === 'blocked' ? 'No blocked users' : 'No muted users'}
          subtitle={
            activeTab === 'blocked'
              ? "You haven't blocked anyone"
              : "You haven't muted anyone"
          }
        />
      ) : (
        <FlatList
          key={activeTab}
          data={listData}
          keyExtractor={(item) =>
            activeTab === 'blocked'
              ? (item as BlockedUser).blocked_id
              : (item as MutedUser).muted_id
          }
          renderItem={activeTab === 'blocked' ? renderBlockedItem : renderMutedItem}
          showsVerticalScrollIndicator={false}
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerSide: {
      width: 22,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.text,
    },
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 10,
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      padding: 4,
      gap: 4,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 8,
    },
    tabActive: {
      backgroundColor: theme.background,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    tabTextActive: {
      color: theme.text,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 40,
      paddingTop: 60,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.border,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.background,
    },
    username: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    actionButton: {
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 14,
      backgroundColor: theme.card,
    },
    actionText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
  })
