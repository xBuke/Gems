import { requireAuth } from '@/lib/authGuard'
import { CATEGORIES } from '@/lib/categories'
import { canJoinMoreCommunities, getCommunityMemberCount } from '@/lib/communities'
import { hapticLight } from '@/lib/haptics'
import { useTheme } from '@/lib/ThemeContext'
import type { Theme } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const IMAGE_PLACEHOLDER = '#1A5C3A'
const SCREEN_WIDTH = Dimensions.get('window').width
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH * 0.75

type DetailTab = 'feed' | 'chat'

type Community = {
  id: string
  name: string
  description?: string | null
  location_focus?: string | null
  category?: string | null
  icon: string
  color: string
  creator_id: string
  creator?: { username: string } | null
}

type Gem = {
  id: string
  title: string
  category: string
  image_url: string | null
  profiles: { username: string } | null
}

type CommunityMessage = {
  id: string
  community_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: { username: string } | null
}

type ChatItem =
  | { type: 'message'; id: string; data: CommunityMessage }
  | { type: 'date'; id: string; label: string }

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatDateLabel = (dateString: string) => {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const buildChatItems = (messages: CommunityMessage[]): ChatItem[] => {
  const items: ChatItem[] = []
  let lastDate: string | null = null

  for (const message of messages) {
    const dateKey = new Date(message.created_at).toDateString()
    if (dateKey !== lastDate) {
      items.push({
        type: 'date',
        id: `date-${dateKey}`,
        label: formatDateLabel(message.created_at),
      })
      lastDate = dateKey
    }
    items.push({ type: 'message', id: message.id, data: message })
  }

  return items.reverse()
}

export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { theme } = useTheme()
  const styles = useMemo(() => createStyles(theme), [theme])

  const [loading, setLoading] = useState(true)
  const [loadingFeed, setLoadingFeed] = useState(true)
  const [loadingChat, setLoadingChat] = useState(true)
  const [community, setCommunity] = useState<Community | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [isMember, setIsMember] = useState(false)
  const [myId, setMyId] = useState<string | null>(null)
  const [gems, setGems] = useState<Gem[]>([])
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [messages, setMessages] = useState<CommunityMessage[]>([])
  const [activeTab, setActiveTab] = useState<DetailTab>('feed')
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const listRef = useRef<FlatList>(null)
  const chatItems = useMemo(() => buildChatItems(messages), [messages])
  const isCreator = myId != null && community?.creator_id === myId

  const categoryLabel = useMemo(() => {
    if (!community?.category) return null
    return CATEGORIES.find((c) => c.id === community.category)?.name ?? community.category
  }, [community?.category])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true })
    }, 100)
  }, [])

  const fetchLikeCounts = useCallback(async (gemList: Gem[]) => {
    if (gemList.length === 0) {
      setLikeCounts({})
      return
    }

    const gemIds = gemList.map((gem) => gem.id)
    const { data } = await supabase.from('gem_likes').select('gem_id').in('gem_id', gemIds)

    const counts: Record<string, number> = {}
    for (const gemId of gemIds) counts[gemId] = 0
    if (data) {
      for (const row of data) {
        counts[row.gem_id] = (counts[row.gem_id] ?? 0) + 1
      }
    }
    setLikeCounts(counts)
  }, [])

  const loadData = useCallback(async () => {
    if (!id) return

    setLoading(true)
    setLoadingFeed(true)
    setLoadingChat(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    setMyId(user?.id ?? null)

    const { data: communityData } = await supabase
      .from('communities')
      .select('*, creator:profiles!communities_creator_id_fkey(username)')
      .eq('id', id)
      .single()

    if (!communityData) {
      setLoadingFeed(false)
      setLoadingChat(false)
      setLoading(false)
      return
    }

    setCommunity(communityData as Community)

    const count = await getCommunityMemberCount(id)
    setMemberCount(count)

    if (user) {
      const { data: membership } = await supabase
        .from('community_members')
        .select('id')
        .eq('community_id', id)
        .eq('user_id', user.id)
        .maybeSingle()

      setIsMember(!!membership)
    } else {
      setIsMember(false)
    }

    const { data: gemsData } = await supabase
      .from('gems')
      .select('*, profiles!gems_user_id_fkey(username)')
      .eq('community_id', id)
      .order('created_at', { ascending: false })

    const gemList = (gemsData ?? []) as Gem[]
    setGems(gemList)
    await fetchLikeCounts(gemList)
    setLoadingFeed(false)

    const { data: messagesData } = await supabase
      .from('community_messages')
      .select('*, profiles!community_messages_user_id_fkey(username)')
      .eq('community_id', id)
      .order('created_at', { ascending: true })

    setMessages((messagesData ?? []) as CommunityMessage[])
    setLoadingChat(false)
    setLoading(false)
  }, [id, fetchLikeCounts])

  useEffect(() => {
    loadData()
  }, [loadData])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData]),
  )

  useEffect(() => {
    if (!id) return

    let channel: any = null

    const setupChat = async () => {
      channel = supabase
        .channel('community-chat-' + id)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'community_messages',
            filter: `community_id=eq.${id}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as CommunityMessage])
          },
        )
        .subscribe()
    }

    setupChat()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [id])

  useEffect(() => {
    if (messages.length > 0 && activeTab === 'chat') {
      scrollToBottom()
    }
  }, [messages.length, activeTab, scrollToBottom])

  const handleJoin = async () => {
    if (!id) return

    let userId = myId
    if (!userId) {
      const proceed = await requireAuth('/community/' + id)
      if (!proceed) return
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      userId = user.id
      setMyId(user.id)
    }

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

    setJoining(true)
    try {
      const { error } = await supabase.from('community_members').insert({
        user_id: userId,
        community_id: id,
      })

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      setIsMember(true)
      setMemberCount((prev) => prev + 1)
    } finally {
      setJoining(false)
    }
  }

  const handleLeave = () => {
    if (!myId || !id) return

    Alert.alert('Leave Community?', 'You will lose access to the group chat and community feed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setLeaving(true)
          try {
            const { error } = await supabase
              .from('community_members')
              .delete()
              .eq('community_id', id)
              .eq('user_id', myId)

            if (error) {
              Alert.alert('Error', error.message)
              return
            }

            setIsMember(false)
            setMemberCount((prev) => Math.max(0, prev - 1))
            if (activeTab === 'chat') setActiveTab('feed')
          } finally {
            setLeaving(false)
          }
        },
      },
    ])
  }

  const handleDeleteCommunity = () => {
    Alert.alert('Delete Community?', 'This will permanently delete the community and all its content.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('communities').delete().eq('id', id)
          if (error) {
            Alert.alert('Error', error.message)
            return
          }
          router.replace('/communities')
        },
      },
    ])
  }

  const handleSettingsPress = () => {
    Alert.alert('Community Options', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Community', style: 'destructive', onPress: handleDeleteCommunity },
    ])
  }

  const handleAddGem = async () => {
    const proceed = await requireAuth('/community/' + id)
    if (!proceed) return

    if (!isMember) {
      Alert.alert('Join first', 'You need to join this community before posting gems.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Join', onPress: handleJoin },
      ])
      return
    }

    router.push({ pathname: '/add-gem', params: { communityId: id } })
  }

  const handleSend = async () => {
    const text = inputText.trim()
    if (!text || !myId || !id || sending) return

    setSending(true)
    setInputText('')

    const { data, error } = await supabase
      .from('community_messages')
      .insert({ community_id: id, user_id: myId, content: text })
      .select('*, profiles!community_messages_user_id_fkey(username)')
      .single()

    setSending(false)

    if (!error && data) {
      hapticLight()
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev
        return [...prev, data as CommunityMessage]
      })
    }
  }

  const renderGemCard = (gem: Gem) => {
    const username = gem.profiles?.username ?? 'unknown'

    return (
      <TouchableOpacity
        key={gem.id}
        style={styles.listCard}
        onPress={() => router.push('/gem/' + gem.id)}
        activeOpacity={0.7}>
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
            <Text style={styles.listCategoryBadgeText}>{gem.category}</Text>
          </View>
          <Text style={styles.listCardTitle} numberOfLines={1}>
            {gem.title}
          </Text>
          <Text style={styles.listCardUsername}>@{username}</Text>
          <View style={styles.listCardMetaRow}>
            <View style={styles.listCardMetaItem}>
              <Ionicons name="heart-outline" size={12} color={theme.textSecondary} />
              <Text style={styles.listCardMetaText}>{likeCounts[gem.id] ?? 0}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderMessage = (item: CommunityMessage) => {
    const isMine = item.user_id === myId
    const username = item.profiles?.username ?? 'unknown'

    return (
      <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowTheirs]}>
        <View style={styles.messageBlock}>
          {!isMine && <Text style={styles.senderName}>@{username}</Text>}
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
            <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
              {item.content}
            </Text>
          </View>
          <Text style={[styles.timestamp, isMine && styles.timestampMine]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    )
  }

  const renderChatItem = ({ item }: { item: ChatItem }) => {
    if (item.type === 'date') {
      return (
        <View style={styles.dateSeparatorWrap}>
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{item.label}</Text>
          </View>
        </View>
      )
    }

    return renderMessage(item.data)
  }

  const renderFeed = () => {
    if (loadingFeed) {
      return (
        <View style={styles.tabLoading}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )
    }

    return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.feedContent}>
      <TouchableOpacity style={styles.addGemButton} onPress={handleAddGem} activeOpacity={0.8}>
        <Ionicons name="add-circle-outline" size={18} color={theme.accentText} />
        <Text style={styles.addGemButtonText}>Add Gem to Community</Text>
      </TouchableOpacity>

      {gems.length === 0 ? (
        <Text style={styles.emptyText}>No gems in this community yet. Be the first!</Text>
      ) : (
        gems.map(renderGemCard)
      )}
    </ScrollView>
    )
  }

  const renderChat = () => {
    if (loadingChat) {
      return (
        <View style={styles.tabLoading}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )
    }

    if (!isMember) {
      return (
        <View style={styles.chatGate}>
          <Ionicons name="chatbubbles-outline" size={48} color={theme.textTertiary} />
          <Text style={styles.chatGateTitle}>Join to chat</Text>
          <Text style={styles.chatGateSubtitle}>
            Become a member to participate in the group conversation
          </Text>
          <TouchableOpacity
            style={styles.chatGateButton}
            onPress={handleJoin}
            disabled={joining}
            activeOpacity={0.8}>
            {joining ? (
              <ActivityIndicator color={theme.accentText} />
            ) : (
              <Text style={styles.chatGateButtonText}>Join Community</Text>
            )}
          </TouchableOpacity>
        </View>
      )
    }

    const canSend = inputText.trim().length > 0 && !sending

    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <FlatList
          ref={listRef}
          data={chatItems}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          inverted
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        />

        <SafeAreaView edges={['bottom']} style={styles.inputArea}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor={theme.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
              onPress={handleSend}
              activeOpacity={0.8}
              disabled={!canSend}>
              <Ionicons
                name="send"
                size={18}
                color={canSend ? theme.background : theme.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    )
  }

  if (loading && !community) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.centered, { paddingTop: 60 }]}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    )
  }

  if (!community) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Community</Text>
          <View style={styles.headerSide} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Community not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: community.color }]}>
            <Ionicons
              name={community.icon as keyof typeof Ionicons.glyphMap}
              size={18}
              color="#FFFFFF"
            />
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {community.name}
          </Text>
        </View>

        {isCreator ? (
          <TouchableOpacity onPress={handleSettingsPress} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSide} />
        )}
      </View>

      <View style={styles.infoSection}>
        {community.description ? (
          <Text style={styles.description}>{community.description}</Text>
        ) : null}

        <View style={styles.chipsRow}>
          <View style={styles.chip}>
            <Ionicons name="people" size={12} color={theme.textSecondary} />
            <Text style={styles.chipText}>{memberCount}</Text>
          </View>
          {community.location_focus ? (
            <View style={styles.chip}>
              <Ionicons name="location" size={12} color={theme.accent} />
              <Text style={[styles.chipText, styles.chipTextAccent]} numberOfLines={1}>
                {community.location_focus}
              </Text>
            </View>
          ) : null}
          {categoryLabel ? (
            <View style={[styles.chip, styles.categoryChip]}>
              <Text style={styles.categoryChipText}>{categoryLabel}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.membershipButton, isMember && styles.leaveButton]}
          onPress={isMember ? handleLeave : handleJoin}
          disabled={joining || leaving}
          activeOpacity={0.8}>
          {joining || leaving ? (
            <ActivityIndicator size="small" color={isMember ? theme.danger : theme.accentText} />
          ) : (
            <Text style={[styles.membershipButtonText, isMember && styles.leaveButtonText]}>
              {isMember ? 'Leave' : 'Join'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.tabActive]}
          onPress={() => setActiveTab('feed')}
          activeOpacity={0.8}>
          <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
          onPress={() => setActiveTab('chat')}
          activeOpacity={0.8}>
          <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>Chat</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContent}>{activeTab === 'feed' ? renderFeed() : renderChat()}</View>
    </SafeAreaView>
  )
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    flex: {
      flex: 1,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.border,
    },
    headerSide: {
      width: 40,
      alignItems: 'center',
    },
    headerCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 8,
    },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.text,
      flexShrink: 1,
    },
    infoSection: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.border,
      gap: 10,
    },
    description: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    chipText: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 11,
      color: theme.textSecondary,
    },
    chipTextAccent: {
      color: theme.accent,
      maxWidth: 120,
    },
    categoryChip: {
      backgroundColor: theme.accentSubtle,
      borderColor: theme.accent,
    },
    categoryChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.accent,
    },
    membershipButton: {
      alignSelf: 'flex-start',
      backgroundColor: theme.accent,
      borderRadius: 8,
      paddingHorizontal: 20,
      paddingVertical: 8,
      minWidth: 80,
      alignItems: 'center',
    },
    membershipButtonText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 14,
      color: theme.accentText,
    },
    leaveButton: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.danger,
    },
    leaveButtonText: {
      color: theme.danger,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: theme.card,
      borderRadius: 10,
      padding: 4,
      marginHorizontal: 16,
      marginVertical: 12,
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
    tabContent: {
      flex: 1,
    },
    tabLoading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 60,
    },
    feedContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    addGemButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.accent,
      borderRadius: 10,
      paddingVertical: 12,
      marginBottom: 16,
    },
    addGemButtonText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 14,
      color: theme.accentText,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      paddingVertical: 32,
    },
    listCard: {
      flexDirection: 'row',
      height: 90,
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 10,
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
      backgroundColor: theme.accentSubtle,
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
      color: theme.accent,
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
    chatGate: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 10,
    },
    chatGateTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 18,
      color: theme.text,
      marginTop: 8,
    },
    chatGateSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    chatGateButton: {
      backgroundColor: theme.accent,
      borderRadius: 10,
      paddingHorizontal: 24,
      paddingVertical: 12,
      marginTop: 8,
      minWidth: 160,
      alignItems: 'center',
    },
    chatGateButtonText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 14,
      color: theme.accentText,
    },
    messagesList: {
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    messageRow: {
      marginBottom: 12,
    },
    messageRowMine: {
      alignItems: 'flex-end',
    },
    messageRowTheirs: {
      alignItems: 'flex-start',
    },
    messageBlock: {
      maxWidth: BUBBLE_MAX_WIDTH,
    },
    senderName: {
      fontSize: 11,
      color: theme.textSecondary,
      marginBottom: 4,
      marginLeft: 4,
    },
    bubble: {
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleMine: {
      backgroundColor: theme.accent,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomRightRadius: 4,
      borderBottomLeftRadius: 18,
    },
    bubbleTheirs: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 18,
    },
    bubbleText: {
      fontSize: 15,
      lineHeight: 20,
    },
    bubbleTextMine: {
      color: theme.background,
    },
    bubbleTextTheirs: {
      color: theme.text,
    },
    timestamp: {
      fontSize: 11,
      color: theme.textTertiary,
      marginTop: 4,
    },
    timestampMine: {
      textAlign: 'right',
    },
    dateSeparatorWrap: {
      alignItems: 'center',
      marginVertical: 12,
    },
    dateSeparator: {
      backgroundColor: theme.card,
      borderRadius: 10,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    dateSeparatorText: {
      fontSize: 12,
      color: theme.textTertiary,
    },
    inputArea: {
      backgroundColor: theme.background,
      borderTopWidth: 0.5,
      borderTopColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    input: {
      flex: 1,
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.text,
      maxHeight: 100,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: theme.border,
    },
  })
