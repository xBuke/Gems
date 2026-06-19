import { getMyBlockedUsers, unblockUser } from '@/lib/safety'
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

export default function BlockedUsersScreen() {
  const router = useRouter()
  const { theme } = useTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const fetchBlocked = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setBlockedUsers([])
      setLoading(false)
      return
    }

    setUserId(user.id)
    const data = await getMyBlockedUsers(user.id)
    setBlockedUsers(data as BlockedUser[])
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      fetchBlocked()
    }, [fetchBlocked]),
  )

  const handleUnblock = async (blockedId: string) => {
    if (!userId) return
    await unblockUser(userId, blockedId)
    setBlockedUsers((prev) => prev.filter((b) => b.blocked_id !== blockedId))
  }

  const renderItem = ({ item }: { item: BlockedUser }) => {
    const username = item.blocked?.username ?? 'Unknown'
    const initial = username.charAt(0).toUpperCase()

    return (
      <View style={styles.userRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.username} numberOfLines={1}>
          {username}
        </Text>
        <TouchableOpacity
          style={styles.unblockButton}
          onPress={() => handleUnblock(item.blocked_id)}
          activeOpacity={0.8}>
          <Text style={styles.unblockText}>Unblock</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Users</Text>
        <View style={styles.headerSide} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="ban-outline" size={56} color={theme.textTertiary} />
          <Text style={styles.emptyText}>You haven&apos;t blocked anyone</Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 40,
    },
    emptyText: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
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
    unblockButton: {
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 14,
      backgroundColor: theme.card,
    },
    unblockText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
  })
