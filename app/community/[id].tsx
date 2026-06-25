import { AppBottomSheetModal } from '@/components/AppBottomSheetModal'
import { CommunityPostCommentThread } from '@/components/CommunityPostCommentThread'
import { CommunityPostReactionBar } from '@/components/CommunityPostReactionBar'
import { EmptyState } from '@/components/EmptyState'
import { GemListCard } from '@/components/GemListCard'
import { requireAuth } from '@/lib/authGuard'
import { CATEGORIES } from '@/lib/categories'
import {
  canJoinMoreCommunities,
  getCommunityMemberCount,
  type CommunityJoinType,
  type CommunityMemberRole,
  type CommunityMemberStatus,
} from '@/lib/communities'
import {
  buildReactionSummary,
  formatPostTimeAgo,
  togglePostReaction,
  type CommunityPost,
  type PostGem,
  type ReactionRow,
  type ReactionSummary,
  type ReactionType,
} from '@/lib/communityPosts'
import { hapticLight, hapticSuccess } from '@/lib/haptics'
import { blockUser } from '@/lib/safety'
import { useToast } from '@/lib/ToastContext'
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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

const SCREEN_WIDTH = Dimensions.get('window').width
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH * 0.75
// Heights of UI above the chat-tab KeyboardAvoidingView (always visible when chat is active).
// Tune after visual testing on device — INFO_SECTION_HEIGHT varies with description length.
const COMMUNITY_HEADER_HEIGHT = 56
const INFO_SECTION_HEIGHT = 80
const TAB_BAR_HEIGHT = 44

type DetailTab = 'feed' | 'chat' | 'manage'

type Community = {
  id: string
  name: string
  description?: string | null
  location_focus?: string | null
  category?: string | null
  icon: string
  color: string
  creator_id: string
  join_type?: CommunityJoinType | null
  creator?: { username: string } | null
}

type PendingRequest = {
  id: string
  user_id: string
  created_at: string
  profiles?: { username: string; avatar_url: string | null } | null
}

type AcceptedMember = {
  id: string
  user_id: string
  role: CommunityMemberRole
  created_at: string
  profiles?: { username: string; avatar_url: string | null } | null
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
  const { showToast } = useToast()
  const styles = useMemo(() => createStyles(theme), [theme])
  const insets = useSafeAreaInsets()

  const [loading, setLoading] = useState(true)
  const [loadingFeed, setLoadingFeed] = useState(true)
  const [loadingChat, setLoadingChat] = useState(true)
  const [loadingManage, setLoadingManage] = useState(true)
  const [community, setCommunity] = useState<Community | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [membershipStatus, setMembershipStatus] = useState<CommunityMemberStatus | null>(null)
  const [myRole, setMyRole] = useState<CommunityMemberRole | null>(null)
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [acceptedMembers, setAcceptedMembers] = useState<AcceptedMember[]>([])
  const [actingOnRequestId, setActingOnRequestId] = useState<string | null>(null)
  const [actingOnMemberId, setActingOnMemberId] = useState<string | null>(null)
  const [memberActionTarget, setMemberActionTarget] = useState<AcceptedMember | null>(null)
  const [memberSheetVisible, setMemberSheetVisible] = useState(false)
  const [myId, setMyId] = useState<string | null>(null)
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [reactions, setReactions] = useState<ReactionRow[]>([])
  const [gemLikeCounts, setGemLikeCounts] = useState<Record<string, number>>({})
  const [messages, setMessages] = useState<CommunityMessage[]>([])
  const [activeTab, setActiveTab] = useState<DetailTab>('feed')
  const [postText, setPostText] = useState('')
  const [postingText, setPostingText] = useState(false)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const listRef = useRef<FlatList>(null)
  const chatItems = useMemo(() => buildChatItems(messages), [messages])
  const isCreator = myId != null && community?.creator_id === myId
  const isModerator = myRole === 'moderator' && membershipStatus === 'accepted'
  const canManage = isCreator || isModerator
  const isMember = membershipStatus === 'accepted'
  const isPending = membershipStatus === 'pending'
  const isInviteOnly = community?.join_type === 'invite_only'
  const pinnedPosts = useMemo(() => posts.filter((post) => post.is_pinned), [posts])

  const categoryLabel = useMemo(() => {
    if (!community?.category) return null
    return CATEGORIES.find((c) => c.id === community.category)?.name ?? community.category
  }, [community?.category])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true })
    }, 100)
  }, [])

  const fetchGemLikeCounts = useCallback(async (gemIds: string[]) => {
    if (gemIds.length === 0) {
      setGemLikeCounts({})
      return
    }

    const { data } = await supabase.from('gem_likes').select('gem_id').in('gem_id', gemIds)

    const counts: Record<string, number> = {}
    for (const gemId of gemIds) counts[gemId] = 0
    if (data) {
      for (const row of data) {
        counts[row.gem_id] = (counts[row.gem_id] ?? 0) + 1
      }
    }
    setGemLikeCounts(counts)
  }, [])

  const fetchPosts = useCallback(async () => {
    if (!id) return

    const { data: postsData } = await supabase
      .from('community_posts')
      .select('*, author:profiles!community_posts_author_id_fkey(username, avatar_url)')
      .eq('community_id', id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    const rawPosts = (postsData ?? []) as (Omit<CommunityPost, 'gem'> & {
      author: CommunityPost['author']
    })[]

    const gemIds = rawPosts
      .filter((post) => post.post_type === 'gem_share' && post.gem_id)
      .map((post) => post.gem_id as string)

    let gemsMap: Record<string, PostGem> = {}
    if (gemIds.length > 0) {
      const { data: gemsData } = await supabase
        .from('gems')
        .select('id, title, category, image_url, latitude, longitude, profiles!gems_user_id_fkey(username)')
        .in('id', gemIds)

      gemsMap = ((gemsData ?? []) as PostGem[]).reduce<Record<string, PostGem>>((acc, gem) => {
        acc[gem.id] = gem
        return acc
      }, {})
    }

    const enrichedPosts: CommunityPost[] = rawPosts.map((post) => ({
      ...post,
      gem: post.gem_id ? gemsMap[post.gem_id] ?? null : null,
    }))

    setPosts(enrichedPosts)

    const postIds = enrichedPosts.map((post) => post.id)
    if (postIds.length === 0) {
      setReactions([])
    } else {
      const { data: reactionsData } = await supabase
        .from('community_post_reactions')
        .select('id, post_id, user_id, reaction_type')
        .in('post_id', postIds)

      setReactions((reactionsData ?? []) as ReactionRow[])
    }

    await fetchGemLikeCounts(gemIds)
  }, [id, fetchGemLikeCounts])

  const loadData = useCallback(async () => {
    if (!id) return

    setLoading(true)
    setLoadingFeed(true)
    setLoadingChat(true)
    setLoadingManage(true)

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
      setLoadingManage(false)
      setLoading(false)
      return
    }

    setCommunity(communityData as Community)

    const count = await getCommunityMemberCount(id)
    setMemberCount(count)

    let membershipStatusValue: CommunityMemberStatus | null = null
    let membershipRole: CommunityMemberRole | null = null
    if (user) {
      const { data: membership } = await supabase
        .from('community_members')
        .select('id, status, role')
        .eq('community_id', id)
        .eq('user_id', user.id)
        .maybeSingle()

      membershipStatusValue = (membership?.status as CommunityMemberStatus | undefined) ?? null
      membershipRole = (membership?.role as CommunityMemberRole | undefined) ?? null
      setMembershipStatus(membershipStatusValue)
      setMyRole(membershipRole)
    } else {
      setMembershipStatus(null)
      setMyRole(null)
    }

    const communityRecord = communityData as Community
    const userCanManage =
      !!user &&
      (communityRecord.creator_id === user.id ||
        (membershipRole === 'moderator' && membershipStatusValue === 'accepted'))

    if (userCanManage && communityRecord.join_type === 'invite_only') {
      const { data: pendingData } = await supabase
        .from('community_members')
        .select('id, user_id, created_at, profiles!community_members_user_id_fkey(username, avatar_url)')
        .eq('community_id', id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      setPendingRequests((pendingData ?? []) as PendingRequest[])
    } else {
      setPendingRequests([])
    }

    if (userCanManage) {
      const { data: membersData } = await supabase
        .from('community_members')
        .select('id, user_id, role, created_at, profiles!community_members_user_id_fkey(username, avatar_url)')
        .eq('community_id', id)
        .eq('status', 'accepted')
        .order('created_at', { ascending: true })

      setAcceptedMembers((membersData ?? []) as AcceptedMember[])
    } else {
      setAcceptedMembers([])
    }
    setLoadingManage(false)

    await fetchPosts()
    setLoadingFeed(false)

    const { data: messagesData } = await supabase
      .from('community_messages')
      .select('*, profiles!community_messages_user_id_fkey(username)')
      .eq('community_id', id)
      .order('created_at', { ascending: true })

    setMessages((messagesData ?? []) as CommunityMessage[])
    setLoadingChat(false)
    setLoading(false)
  }, [id, fetchPosts])

  useEffect(() => {
    loadData()
  }, [loadData])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData]),
  )

  useEffect(() => {
    if (!canManage && activeTab === 'manage') {
      setActiveTab('feed')
    }
  }, [canManage, activeTab])

  useEffect(() => {
    if (!id) return

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const setupChat = async () => {
      const channelName = 'community-chat-' + id
      const existing = supabase
        .getChannels()
        .find((ch) => ch.topic === 'realtime:' + channelName)
      if (existing) {
        await supabase.removeChannel(existing)
      }

      if (cancelled) return

      channel = supabase
        .channel(channelName)
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

    void setupChat()

    return () => {
      cancelled = true
      const channelName = 'community-chat-' + id
      const existing = supabase
        .getChannels()
        .find((ch) => ch.topic === 'realtime:' + channelName)
      if (existing) {
        void supabase.removeChannel(existing)
      }
      channel = null
    }
  }, [id])

  useEffect(() => {
    if (messages.length > 0 && activeTab === 'chat') {
      scrollToBottom()
    }
  }, [messages.length, activeTab, scrollToBottom])

  const handleJoin = async () => {
    if (!id || membershipStatus === 'pending' || membershipStatus === 'accepted') return

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
      const memberStatus: CommunityMemberStatus = isInviteOnly ? 'pending' : 'accepted'
      const { error } = await supabase.from('community_members').insert({
        user_id: userId,
        community_id: id,
        status: memberStatus,
      })

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      hapticSuccess()
      setMembershipStatus(memberStatus)
      if (memberStatus === 'accepted') {
        setMemberCount((prev) => prev + 1)
      }
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

            setMembershipStatus(null)
            setMyRole(null)
            setMemberCount((prev) => Math.max(0, prev - 1))
            if (activeTab === 'chat' || activeTab === 'manage') setActiveTab('feed')
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

  const handleApproveRequest = async (request: PendingRequest) => {
    setActingOnRequestId(request.id)
    try {
      const { error } = await supabase
        .from('community_members')
        .update({ status: 'accepted' })
        .eq('id', request.id)

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      hapticSuccess()
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id))
      setMemberCount((prev) => prev + 1)
    } finally {
      setActingOnRequestId(null)
    }
  }

  const handleDeclineRequest = async (request: PendingRequest) => {
    setActingOnRequestId(request.id)
    try {
      const { error } = await supabase.from('community_members').delete().eq('id', request.id)

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      hapticLight()
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id))
    } finally {
      setActingOnRequestId(null)
    }
  }

  const renderPendingRequest = (request: PendingRequest) => {
    const username = request.profiles?.username ?? 'unknown'
    const avatarUrl = request.profiles?.avatar_url
    const isActing = actingOnRequestId === request.id

    return (
      <View key={request.id} style={styles.pendingRequestRow}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.pendingRequestAvatar} contentFit="cover" />
        ) : (
          <View style={styles.pendingRequestAvatarPlaceholder}>
            <Text style={styles.pendingRequestAvatarText}>{username[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        )}
        <View style={styles.pendingRequestInfo}>
          <Text style={styles.pendingRequestUsername} numberOfLines={1}>
            @{username}
          </Text>
          <Text style={styles.pendingRequestTime}>
            Requested {formatPostTimeAgo(request.created_at)}
          </Text>
        </View>
        <View style={styles.pendingRequestActions}>
          <TouchableOpacity
            style={styles.declineRequestButton}
            onPress={() => handleDeclineRequest(request)}
            disabled={isActing}
            activeOpacity={0.8}>
            <Text style={styles.declineRequestButtonText}>Deny</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.approveRequestButton}
            onPress={() => handleApproveRequest(request)}
            disabled={isActing}
            activeOpacity={0.8}>
            {isActing ? (
              <ActivityIndicator size="small" color={theme.accentText} />
            ) : (
              <Text style={styles.approveRequestButtonText}>Approve</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const handleSettingsPress = () => {
    if (!community) return
    router.push({ pathname: '/create-community', params: { communityId: community.id } })
  }

  const canPromoteMember = (member: AcceptedMember) =>
    isCreator && member.user_id !== myId && member.role !== 'moderator'

  const canRemoveMember = (member: AcceptedMember) => {
    if (!community || member.user_id === myId) return false
    if (member.user_id === community.creator_id) return false
    if (isCreator) return true
    if (isModerator && member.role === 'member') return true
    return false
  }

  const openMemberActions = (member: AcceptedMember) => {
    setMemberActionTarget(member)
    setMemberSheetVisible(true)
  }

  const closeMemberActions = () => {
    setMemberSheetVisible(false)
    setMemberActionTarget(null)
  }

  const handlePromoteMember = async (member: AcceptedMember) => {
    closeMemberActions()
    setActingOnMemberId(member.id)
    try {
      const { error } = await supabase
        .from('community_members')
        .update({ role: 'moderator' })
        .eq('id', member.id)

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      hapticSuccess()
      setAcceptedMembers((prev) =>
        prev.map((row) => (row.id === member.id ? { ...row, role: 'moderator' } : row)),
      )
      showToast({ type: 'success', title: `@${member.profiles?.username ?? 'user'} is now a moderator` })
    } finally {
      setActingOnMemberId(null)
    }
  }

  const handleRemoveMember = (member: AcceptedMember) => {
    const username = member.profiles?.username ?? 'user'
    closeMemberActions()
    Alert.alert(`Remove @${username} from this community?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setActingOnMemberId(member.id)
          try {
            const { error } = await supabase.from('community_members').delete().eq('id', member.id)

            if (error) {
              Alert.alert('Error', error.message)
              return
            }

            hapticLight()
            setAcceptedMembers((prev) => prev.filter((row) => row.id !== member.id))
            setMemberCount((prev) => Math.max(0, prev - 1))
            showToast({ type: 'success', title: `@${username} was removed` })
          } finally {
            setActingOnMemberId(null)
          }
        },
      },
    ])
  }

  const handleBlockMember = (member: AcceptedMember) => {
    if (!myId) return
    const username = member.profiles?.username ?? 'user'
    closeMemberActions()
    Alert.alert(
      `Block @${username}?`,
      "They won't be able to see your content and you won't see theirs.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const { error } = await blockUser(myId, member.user_id)
            if (error) {
              Alert.alert('Error', error.message)
              return
            }
            showToast({ type: 'success', title: `@${username} blocked` })
          },
        },
      ],
    )
  }

  const handleAddGem = async () => {
    const proceed = await requireAuth('/community/' + id)
    if (!proceed) return

    if (!isMember) {
      Alert.alert('Join first', 'You need to join this community before posting gems.', [
        { text: 'Cancel', style: 'cancel' },
        { text: isInviteOnly ? 'Request to join' : 'Join', onPress: handleJoin },
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

  const handleCreateTextPost = async () => {
    const text = postText.trim()
    if (!text || !myId || !id || postingText) return

    if (!isMember) {
      Alert.alert('Join first', 'You need to join this community before posting.', [
        { text: 'Cancel', style: 'cancel' },
        { text: isInviteOnly ? 'Request to join' : 'Join', onPress: handleJoin },
      ])
      return
    }

    setPostingText(true)
    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        community_id: id,
        author_id: myId,
        post_type: 'text',
        content: text,
      })
      .select('*, author:profiles!community_posts_author_id_fkey(username, avatar_url)')
      .single()

    setPostingText(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    hapticSuccess()
    setPostText('')
    if (data) {
      const newPost = { ...(data as CommunityPost), gem: null }
      setPosts((prev) => {
        const next = [newPost, ...prev]
        next.sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        return next
      })
    }
  }

  const handleTogglePin = async (post: CommunityPost, asManager = false) => {
    if (!myId) return
    if (!asManager && post.author_id !== myId) return
    if (asManager && !canManage) return

    const nextPinned = !post.is_pinned
    const { error } = await supabase
      .from('community_posts')
      .update({ is_pinned: nextPinned })
      .eq('id', post.id)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    hapticLight()
    setPosts((prev) => {
      const next = prev.map((item) =>
        item.id === post.id ? { ...item, is_pinned: nextPinned } : item,
      )
      next.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      return next
    })
  }

  const getMyReaction = (postId: string): ReactionType | null => {
    if (!myId) return null
    const row = reactions.find((r) => r.post_id === postId && r.user_id === myId)
    return row?.reaction_type ?? null
  }

  const getReactionSummary = (postId: string): ReactionSummary =>
    buildReactionSummary(reactions, postId)

  const handleReaction = async (postId: string, reactionType: ReactionType) => {
    if (!myId) {
      await requireAuth('/community/' + id)
      return
    }

    const current = getMyReaction(postId)
    const { error } = await togglePostReaction(postId, myId, reactionType, current)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    setReactions((prev) => {
      const existing = prev.find((r) => r.post_id === postId && r.user_id === myId)
      if (current === reactionType) {
        return prev.filter((r) => r.id !== existing?.id)
      }
      if (existing) {
        return prev.map((r) =>
          r.id === existing.id ? { ...r, reaction_type: reactionType } : r,
        )
      }
      return [
        ...prev,
        {
          id: `temp-${postId}-${myId}`,
          post_id: postId,
          user_id: myId,
          reaction_type: reactionType,
        },
      ]
    })
  }

  const renderAuthorAvatar = (username: string, avatarUrl?: string | null) => {
    if (avatarUrl) {
      return (
        <Image
          source={{ uri: avatarUrl }}
          style={styles.authorAvatar}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      )
    }

    return (
      <View style={styles.authorAvatarPlaceholder}>
        <Text style={styles.authorAvatarText}>{username[0]?.toUpperCase() ?? '?'}</Text>
      </View>
    )
  }

  const renderPost = (post: CommunityPost) => {
    const username = post.author?.username ?? 'unknown'
    const isOwnPost = myId != null && post.author_id === myId
    const summary = getReactionSummary(post.id)
    const myReaction = getMyReaction(post.id)

    return (
      <View key={post.id} style={styles.postCard}>
        <View style={styles.postHeader}>
          {renderAuthorAvatar(username, post.author?.avatar_url)}
          <View style={styles.postHeaderText}>
            <View style={styles.postAuthorRow}>
              <Text style={styles.postUsername}>@{username}</Text>
              {post.post_type === 'gem_share' ? (
                <Text style={styles.postActionText}> shared a gem</Text>
              ) : null}
            </View>
            <Text style={styles.postTimestamp}>{formatPostTimeAgo(post.created_at)}</Text>
          </View>
          {isOwnPost ? (
            <TouchableOpacity
              onPress={() => handleTogglePin(post)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              style={styles.pinButton}>
              <Ionicons
                name={post.is_pinned ? 'pin' : 'pin-outline'}
                size={16}
                color={post.is_pinned ? theme.accent : theme.textTertiary}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {post.is_pinned ? (
          <View style={styles.pinnedBadge}>
            <Text style={styles.pinnedBadgeText}>📌 PINNED</Text>
          </View>
        ) : null}

        {post.post_type === 'text' ? (
          <Text style={styles.postContent}>{post.content}</Text>
        ) : null}

        {post.post_type === 'gem_share' && post.gem ? (
          <GemListCard
            gem={post.gem}
            likeCount={gemLikeCounts[post.gem.id] ?? 0}
            locationLabel={community?.location_focus ?? null}
            onPress={() => router.push('/gem/' + post.gem!.id)}
          />
        ) : null}

        <CommunityPostReactionBar
          summary={summary}
          myReaction={myReaction}
          onReact={(type) => handleReaction(post.id, type)}
        />

        <CommunityPostCommentThread
          postId={post.id}
          myId={myId}
          isMember={isMember}
          onJoinPress={handleJoin}
        />
      </View>
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

  const renderManageMember = (member: AcceptedMember) => {
    const username = member.profiles?.username ?? 'unknown'
    const avatarUrl = member.profiles?.avatar_url
    const isCommunityCreator = member.user_id === community?.creator_id
    const isActing = actingOnMemberId === member.id

    return (
      <View key={member.id} style={styles.manageMemberRow}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.manageMemberAvatar} contentFit="cover" />
        ) : (
          <View style={styles.manageMemberAvatarPlaceholder}>
            <Text style={styles.manageMemberAvatarText}>{username[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        )}
        <View style={styles.manageMemberInfo}>
          <View style={styles.manageMemberNameRow}>
            <Text style={styles.manageMemberUsername} numberOfLines={1}>
              @{username}
            </Text>
            {member.role === 'moderator' ? (
              <Text style={styles.modBadge}>MOD</Text>
            ) : null}
            {isCommunityCreator ? (
              <View style={styles.creatorBadgeSmall}>
                <Ionicons name="diamond" size={8} color={theme.accent} />
                <Text style={styles.creatorBadgeSmallText}>CREATOR</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.manageMemberJoined}>Joined {formatPostTimeAgo(member.created_at)}</Text>
        </View>
        {member.user_id !== myId ? (
          <TouchableOpacity
            onPress={() => openMemberActions(member)}
            disabled={isActing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            style={styles.manageMemberMenuButton}>
            {isActing ? (
              <ActivityIndicator size="small" color={theme.textSecondary} />
            ) : (
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.textSecondary} />
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    )
  }

  const renderPinnedPostSummary = (post: CommunityPost) => {
    const username = post.author?.username ?? 'unknown'
    const preview =
      post.post_type === 'text'
        ? post.content?.trim() || 'Text post'
        : post.gem?.title
          ? `Shared gem: ${post.gem.title}`
          : 'Shared a gem'

    return (
      <View key={post.id} style={styles.pinnedPostCard}>
        <View style={styles.pinnedPostInfo}>
          <Text style={styles.pinnedPostAuthor}>@{username}</Text>
          <Text style={styles.pinnedPostPreview} numberOfLines={2}>
            {preview}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.unpinButton}
          onPress={() => handleTogglePin(post, true)}
          activeOpacity={0.8}>
          <Text style={styles.unpinButtonText}>Unpin</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const renderManage = () => {
    if (loadingManage) {
      return (
        <View style={styles.tabLoading}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.manageContent}
        keyboardShouldPersistTaps="handled">
        {isInviteOnly ? (
          <View style={styles.manageSection}>
            <Text style={styles.manageSectionTitle}>
              Join requests{pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}
            </Text>
            {pendingRequests.length === 0 ? (
              <Text style={styles.manageSectionEmpty}>No pending requests</Text>
            ) : (
              pendingRequests.map(renderPendingRequest)
            )}
          </View>
        ) : null}

        <View style={styles.manageSection}>
          <Text style={styles.manageSectionTitle}>Pinned post</Text>
          {pinnedPosts.length === 0 ? (
            <Text style={styles.manageSectionEmpty}>No pinned posts</Text>
          ) : (
            pinnedPosts.map(renderPinnedPostSummary)
          )}
        </View>

        <View style={styles.manageSection}>
          <Text style={styles.manageSectionTitle}>Members ({acceptedMembers.length})</Text>
          {acceptedMembers.length === 0 ? (
            <Text style={styles.manageSectionEmpty}>No members yet</Text>
          ) : (
            acceptedMembers.map(renderManageMember)
          )}
        </View>

        {isCreator ? (
          <View style={styles.manageSection}>
            <Text style={styles.manageSectionTitle}>Community settings</Text>
            <TouchableOpacity
              style={styles.manageSettingsRow}
              onPress={handleSettingsPress}
              activeOpacity={0.7}>
              <Text style={styles.manageSettingsRowText}>Edit community info</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.manageSettingsRow}
              onPress={handleDeleteCommunity}
              activeOpacity={0.7}>
              <Text style={styles.manageSettingsRowDanger}>Delete community</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.danger} />
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    )
  }

  const renderMemberActionSheet = () => {
    if (!memberActionTarget) return null
    const username = memberActionTarget.profiles?.username ?? 'user'
    const showPromote = canPromoteMember(memberActionTarget)
    const showRemove = canRemoveMember(memberActionTarget)
    const showBlock = memberActionTarget.user_id !== myId

    return (
      <AppBottomSheetModal
        visible={memberSheetVisible}
        onClose={closeMemberActions}
        snapPoints={showPromote ? ['34%'] : ['28%']}>
        <View style={styles.memberSheetContent}>
          {showPromote ? (
            <TouchableOpacity
              style={styles.memberSheetRow}
              onPress={() => handlePromoteMember(memberActionTarget)}
              activeOpacity={0.7}>
              <Ionicons name="shield-outline" size={20} color={theme.text} />
              <Text style={styles.memberSheetRowText}>Promote to moderator</Text>
            </TouchableOpacity>
          ) : null}
          {showRemove ? (
            <TouchableOpacity
              style={styles.memberSheetRow}
              onPress={() => handleRemoveMember(memberActionTarget)}
              activeOpacity={0.7}>
              <Ionicons name="person-remove-outline" size={20} color={theme.danger} />
              <Text style={[styles.memberSheetRowText, styles.memberSheetRowDanger]}>
                Remove from community
              </Text>
            </TouchableOpacity>
          ) : null}
          {showBlock ? (
            <TouchableOpacity
              style={styles.memberSheetRow}
              onPress={() => handleBlockMember(memberActionTarget)}
              activeOpacity={0.7}>
              <Ionicons name="ban-outline" size={20} color={theme.danger} />
              <Text style={[styles.memberSheetRowText, styles.memberSheetRowDanger]}>
                Block @{username}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.memberSheetCancel}
            onPress={closeMemberActions}
            activeOpacity={0.7}>
            <Text style={styles.memberSheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </AppBottomSheetModal>
    )
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
      contentContainerStyle={styles.feedContent}
      keyboardShouldPersistTaps="handled">
      <View style={styles.composerCard}>
        <TextInput
          style={styles.composerInput}
          placeholder="Share something with the community..."
          placeholderTextColor={theme.textTertiary}
          value={postText}
          onChangeText={setPostText}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.composerPostButton, (!postText.trim() || postingText) && styles.composerPostButtonDisabled]}
          onPress={handleCreateTextPost}
          disabled={!postText.trim() || postingText}
          activeOpacity={0.8}>
          {postingText ? (
            <ActivityIndicator size="small" color={theme.accentText} />
          ) : (
            <Text style={styles.composerPostButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.addGemButton} onPress={handleAddGem} activeOpacity={0.8}>
        <Ionicons name="add-circle-outline" size={18} color={theme.accentText} />
        <Text style={styles.addGemButtonText}>Add Gem to Community</Text>
      </TouchableOpacity>

      {posts.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="No posts yet"
          subtitle="Start the conversation or share a gem!"
        />
      ) : (
        posts.map(renderPost)
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
      const joinLabel = isPending ? 'Waiting for approval' : isInviteOnly ? 'Request to join' : 'Join Community'
      return (
        <View style={styles.chatGate}>
          <Ionicons name="chatbubbles-outline" size={48} color={theme.textTertiary} />
          <Text style={styles.chatGateTitle}>
            {isPending ? 'Request pending' : 'Join to chat'}
          </Text>
          <Text style={styles.chatGateSubtitle}>
            {isPending
              ? 'The community creator will review your request'
              : 'Become a member to participate in the group conversation'}
          </Text>
          {!isPending ? (
            <TouchableOpacity
              style={styles.chatGateButton}
              onPress={handleJoin}
              disabled={joining}
              activeOpacity={0.8}>
              {joining ? (
                <ActivityIndicator color={theme.accentText} />
              ) : (
                <Text style={styles.chatGateButtonText}>{joinLabel}</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.requestedBadge}>
              <Text style={styles.requestedBadgeText}>Requested</Text>
            </View>
          )}
        </View>
      )
    }

    const canSend = inputText.trim().length > 0 && !sending
    // Offset = distance from screen top to this KAV: safe area + header + info/join block + tab row.
    const chatKeyboardOffset =
      insets.top + COMMUNITY_HEADER_HEIGHT + INFO_SECTION_HEIGHT + TAB_BAR_HEIGHT

    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? chatKeyboardOffset : 0}>
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
            <Pressable
              style={({ pressed }) => [
                styles.sendButton,
                !canSend && styles.sendButtonDisabled,
                pressed && canSend && Platform.OS !== 'android' && { opacity: 0.8 },
              ]}
              onPress={handleSend}
              disabled={!canSend}
              android_ripple={
                canSend ? { color: theme.accentSub, borderless: false } : undefined
              }>
              <Ionicons
                name="send"
                size={18}
                color={canSend ? theme.background : theme.textTertiary}
              />
            </Pressable>
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
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
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
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
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

        <View style={styles.headerSide} />
      </View>

      <View style={styles.infoSection}>
        {community.description ? (
          <Text style={styles.description} numberOfLines={3} ellipsizeMode="tail">
            {community.description}
          </Text>
        ) : null}

        <View style={styles.chipsRow}>
          <View style={styles.chip}>
            <Ionicons name="people" size={12} color={theme.textSecondary} />
            <Text style={styles.chipText}>{memberCount}</Text>
          </View>
          {community.creator?.username ? (
            <View style={styles.creatorChip}>
              <Text style={styles.creatorChipUsername}>@{community.creator.username}</Text>
              <View style={styles.creatorBadge}>
                <Ionicons name="diamond" size={10} color={theme.accent} />
                <Text style={styles.creatorBadgeText}>CREATOR</Text>
              </View>
            </View>
          ) : null}
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
          style={[
            styles.membershipButton,
            isMember && styles.leaveButton,
            isPending && styles.requestedButton,
          ]}
          onPress={isMember ? handleLeave : isPending ? undefined : handleJoin}
          disabled={joining || leaving || isPending}
          activeOpacity={isPending ? 1 : 0.8}>
          {joining || leaving ? (
            <ActivityIndicator size="small" color={isMember ? theme.danger : theme.accentText} />
          ) : (
            <Text
              style={[
                styles.membershipButtonText,
                isMember && styles.leaveButtonText,
                isPending && styles.requestedButtonText,
              ]}>
              {isMember ? 'Leave' : isPending ? 'Requested' : isInviteOnly ? 'Request to join' : 'Join'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.tabActive, canManage && styles.tabCompact]}
          onPress={() => setActiveTab('feed')}
          activeOpacity={0.8}>
          <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.tabActive, canManage && styles.tabCompact]}
          onPress={() => setActiveTab('chat')}
          activeOpacity={0.8}>
          <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>Chat</Text>
        </TouchableOpacity>
        {canManage ? (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'manage' && styles.tabActive, styles.tabCompact]}
            onPress={() => setActiveTab('manage')}
            activeOpacity={0.8}>
            <Text style={[styles.tabText, activeTab === 'manage' && styles.tabTextActive]}>Manage</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.tabContent}>
        {activeTab === 'feed' ? renderFeed() : activeTab === 'chat' ? renderChat() : renderManage()}
      </View>
      {renderMemberActionSheet()}
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
      color: theme.textSecondary,
      maxWidth: 120,
    },
    creatorChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.accentSub,
      borderWidth: 0.5,
      borderColor: theme.accent,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
      maxWidth: '100%',
    },
    creatorChipUsername: {
      fontFamily: 'SpaceGrotesk-SemiBold',
      fontSize: 11,
      color: theme.textSecondary,
      flexShrink: 1,
    },
    creatorBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: theme.accent + '25',
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    creatorBadgeText: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 8,
      color: theme.accent,
      letterSpacing: 0.5,
    },
    creatorBadgeSmall: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: theme.accent + '25',
      borderRadius: 6,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    creatorBadgeSmallText: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 8,
      color: theme.accent,
      letterSpacing: 0.5,
    },
    modBadge: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 8,
      color: theme.accent,
      letterSpacing: 0.5,
    },
    categoryChip: {
      backgroundColor: theme.accentSub,
      borderColor: theme.accent,
    },
    categoryChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
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
    requestedButton: {
      backgroundColor: theme.bgTertiary,
      borderWidth: 0,
    },
    requestedButtonText: {
      color: theme.textSecondary,
    },
    pendingRequestsSection: {
      marginHorizontal: 16,
      marginBottom: 4,
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    pendingRequestsTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 13,
      color: theme.text,
    },
    pendingRequestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    pendingRequestInfo: {
      flex: 1,
      gap: 2,
    },
    pendingRequestAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    pendingRequestAvatarPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.bgTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingRequestAvatarText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 14,
      color: theme.textSecondary,
    },
    pendingRequestUsername: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 13,
      color: theme.text,
    },
    pendingRequestTime: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: theme.textTertiary,
    },
    pendingRequestActions: {
      flexDirection: 'row',
      gap: 8,
    },
    declineRequestButton: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    declineRequestButtonText: {
      fontFamily: 'SpaceGrotesk-SemiBold',
      fontSize: 12,
      color: theme.textSecondary,
    },
    approveRequestButton: {
      backgroundColor: theme.accent,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      minWidth: 72,
      alignItems: 'center',
    },
    approveRequestButtonText: {
      fontFamily: 'SpaceGrotesk-SemiBold',
      fontSize: 12,
      color: theme.accentText,
    },
    requestedBadge: {
      backgroundColor: theme.bgTertiary,
      borderRadius: 10,
      paddingHorizontal: 24,
      paddingVertical: 12,
      marginTop: 8,
    },
    requestedBadgeText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 14,
      color: theme.textSecondary,
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
    tabCompact: {
      paddingVertical: 8,
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
    manageContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
      gap: 16,
    },
    manageSection: {
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    manageSectionTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 13,
      color: theme.text,
    },
    manageSectionEmpty: {
      fontSize: 13,
      color: theme.textTertiary,
    },
    pinnedPostCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.bgTertiary,
      borderRadius: 10,
      padding: 10,
    },
    pinnedPostInfo: {
      flex: 1,
      gap: 4,
    },
    pinnedPostAuthor: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 12,
      color: theme.text,
    },
    pinnedPostPreview: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 17,
    },
    unpinButton: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    unpinButtonText: {
      fontFamily: 'SpaceGrotesk-SemiBold',
      fontSize: 12,
      color: theme.textSecondary,
    },
    manageMemberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 4,
    },
    manageMemberAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    manageMemberAvatarPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.bgTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    manageMemberAvatarText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 14,
      color: theme.textSecondary,
    },
    manageMemberInfo: {
      flex: 1,
      gap: 2,
    },
    manageMemberNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    manageMemberUsername: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 13,
      color: theme.text,
      flexShrink: 1,
    },
    manageMemberJoined: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: theme.textTertiary,
    },
    manageMemberMenuButton: {
      width: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    manageSettingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderTopWidth: 0.5,
      borderTopColor: theme.border,
    },
    manageSettingsRowText: {
      fontSize: 15,
      color: theme.text,
      fontWeight: '500',
    },
    manageSettingsRowDanger: {
      fontSize: 15,
      color: theme.danger,
      fontWeight: '500',
    },
    memberSheetContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    memberSheetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.border,
    },
    memberSheetRowText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
    },
    memberSheetRowDanger: {
      color: theme.danger,
    },
    memberSheetCancel: {
      alignItems: 'center',
      paddingVertical: 16,
      marginTop: 4,
    },
    memberSheetCancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textSecondary,
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
    composerCard: {
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      gap: 10,
    },
    composerInput: {
      fontSize: 14,
      fontFamily: 'SpaceGrotesk-Regular',
      color: theme.text,
      minHeight: 44,
      maxHeight: 120,
    },
    composerPostButton: {
      alignSelf: 'flex-end',
      backgroundColor: theme.accent,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      minWidth: 72,
      alignItems: 'center',
    },
    composerPostButtonDisabled: {
      opacity: 0.5,
    },
    composerPostButtonText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 13,
      color: theme.accentText,
    },
    postCard: {
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      gap: 10,
    },
    postHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    authorAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    authorAvatarPlaceholder: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.bgTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    authorAvatarText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 13,
      color: theme.textSecondary,
    },
    postHeaderText: {
      flex: 1,
      gap: 2,
    },
    postAuthorRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    postUsername: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 13,
      color: theme.text,
    },
    postActionText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    postTimestamp: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: theme.textTertiary,
    },
    pinButton: {
      padding: 4,
    },
    pinnedBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.bgTertiary,
      borderRadius: 6,
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    pinnedBadgeText: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 8,
      color: theme.textTertiary,
    },
    postContent: {
      fontFamily: 'SpaceGrotesk-Regular',
      fontSize: 13,
      color: theme.text,
      lineHeight: 19,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      paddingVertical: 32,
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
      backgroundColor: theme.accentSub,
      borderWidth: 0.5,
      borderColor: theme.accent,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      borderBottomRightRadius: 4,
      borderBottomLeftRadius: 14,
    },
    bubbleTheirs: {
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 14,
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
