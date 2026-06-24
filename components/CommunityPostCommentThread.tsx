import { requireAuth } from '@/lib/authGuard'
import { formatPostTimeAgo, type PostAuthor } from '@/lib/communityPosts'
import { hapticLight, hapticSuccess } from '@/lib/haptics'
import { useTheme } from '@/lib/ThemeContext'
import type { Theme } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

export type PostComment = {
  id: string
  post_id: string
  author_id: string
  parent_comment_id: string | null
  content: string
  created_at: string
  author: PostAuthor | null
}

type CommentLikeState = {
  count: number
  likedByMe: boolean
}

type CommunityPostCommentThreadProps = {
  postId: string
  myId: string | null
  isMember: boolean
  onJoinPress: () => void
}

export function CommunityPostCommentThread({
  postId,
  myId,
  isMember,
  onJoinPress,
}: CommunityPostCommentThreadProps) {
  const { theme } = useTheme()
  const styles = useMemo(() => createStyles(theme), [theme])

  const [expanded, setExpanded] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const [comments, setComments] = useState<PostComment[]>([])
  const [commentLikes, setCommentLikes] = useState<Record<string, CommentLikeState>>({})
  const [loading, setLoading] = useState(false)
  const [topLevelText, setTopLevelText] = useState('')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchCommentCount = useCallback(async () => {
    const { count } = await supabase
      .from('community_post_comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId)

    setCommentCount(count ?? 0)
  }, [postId])

  const fetchCommentLikes = useCallback(
    async (commentIds: string[]) => {
      if (commentIds.length === 0) {
        setCommentLikes({})
        return
      }

      const { data: likesData } = await supabase
        .from('community_post_comment_likes')
        .select('comment_id, user_id')
        .in('comment_id', commentIds)

      const likesMap: Record<string, CommentLikeState> = {}
      for (const commentId of commentIds) {
        const rows = (likesData ?? []).filter((row) => row.comment_id === commentId)
        likesMap[commentId] = {
          count: rows.length,
          likedByMe: myId ? rows.some((row) => row.user_id === myId) : false,
        }
      }
      setCommentLikes(likesMap)
    },
    [myId],
  )

  const fetchComments = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('community_post_comments')
      .select('*, author:profiles!community_post_comments_author_id_fkey(username, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    const rows = (data ?? []) as PostComment[]
    setComments(rows)
    await fetchCommentLikes(rows.map((comment) => comment.id))
    setCommentCount(rows.length)
    setLoading(false)
  }, [postId, fetchCommentLikes])

  useEffect(() => {
    void fetchCommentCount()
  }, [fetchCommentCount])

  useEffect(() => {
    if (expanded) {
      void fetchComments()
    }
  }, [expanded, fetchComments])

  const ensureCanComment = async () => {
    if (!isMember) {
      Alert.alert('Join first', 'You need to join this community before commenting.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Join', onPress: onJoinPress },
      ])
      return false
    }

    const proceed = await requireAuth()
    return proceed
  }

  const handleToggleExpanded = () => {
    setExpanded((open) => !open)
    if (expanded) {
      setReplyingToId(null)
      setReplyText('')
    }
  }

  const handleSubmitTopLevel = async () => {
    const text = topLevelText.trim()
    if (!text || submitting) return

    const allowed = await ensureCanComment()
    if (!allowed) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSubmitting(true)
    const { data, error } = await supabase
      .from('community_post_comments')
      .insert({
        post_id: postId,
        author_id: user.id,
        parent_comment_id: null,
        content: text,
      })
      .select('*, author:profiles!community_post_comments_author_id_fkey(username, avatar_url)')
      .single()

    setSubmitting(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    hapticSuccess()
    setTopLevelText('')
    if (data) {
      const newComment = data as PostComment
      setComments((prev) => [...prev, newComment])
      setCommentCount((prev) => prev + 1)
      setCommentLikes((prev) => ({
        ...prev,
        [newComment.id]: { count: 0, likedByMe: false },
      }))
    }
  }

  const handleSubmitReply = async (parentId: string) => {
    const text = replyText.trim()
    if (!text || submitting) return

    const allowed = await ensureCanComment()
    if (!allowed) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSubmitting(true)
    const { data, error } = await supabase
      .from('community_post_comments')
      .insert({
        post_id: postId,
        author_id: user.id,
        parent_comment_id: parentId,
        content: text,
      })
      .select('*, author:profiles!community_post_comments_author_id_fkey(username, avatar_url)')
      .single()

    setSubmitting(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    hapticSuccess()
    setReplyText('')
    setReplyingToId(null)
    if (data) {
      const newComment = data as PostComment
      setComments((prev) => [...prev, newComment])
      setCommentCount((prev) => prev + 1)
      setCommentLikes((prev) => ({
        ...prev,
        [newComment.id]: { count: 0, likedByMe: false },
      }))
    }
  }

  const handleToggleLike = async (commentId: string) => {
    const proceed = await requireAuth()
    if (!proceed) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    hapticLight()
    const current = commentLikes[commentId]
    if (current?.likedByMe) {
      await supabase
        .from('community_post_comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
      setCommentLikes((prev) => ({
        ...prev,
        [commentId]: {
          count: Math.max(0, (prev[commentId]?.count ?? 1) - 1),
          likedByMe: false,
        },
      }))
    } else {
      await supabase
        .from('community_post_comment_likes')
        .insert({ comment_id: commentId, user_id: user.id })
      setCommentLikes((prev) => ({
        ...prev,
        [commentId]: {
          count: (prev[commentId]?.count ?? 0) + 1,
          likedByMe: true,
        },
      }))
    }
  }

  const renderAvatar = (
    username: string,
    avatarUrl: string | null | undefined,
    size: 'top' | 'reply',
  ) => {
    const dimension = size === 'top' ? 28 : 24
    const style = size === 'top' ? styles.avatarTop : styles.avatarReply

    if (avatarUrl) {
      return (
        <Image
          source={{ uri: avatarUrl }}
          style={[style, { width: dimension, height: dimension, borderRadius: dimension / 2 }]}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      )
    }

    return (
      <View
        style={[
          styles.avatarPlaceholder,
          { width: dimension, height: dimension, borderRadius: dimension / 2 },
        ]}>
        <Text style={[styles.avatarText, size === 'reply' && styles.avatarTextSmall]}>
          {username[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>
    )
  }

  const renderLikeButton = (commentId: string) => {
    const likeState = commentLikes[commentId] ?? { count: 0, likedByMe: false }

    return (
      <TouchableOpacity
        style={styles.likeButton}
        onPress={() => handleToggleLike(commentId)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
        <Ionicons
          name={likeState.likedByMe ? 'heart' : 'heart-outline'}
          size={13}
          color={likeState.likedByMe ? theme.coral : theme.textTertiary}
        />
        {likeState.count > 0 ? (
          <Text style={styles.likeCount}>{likeState.count}</Text>
        ) : null}
      </TouchableOpacity>
    )
  }

  const renderCommentBody = (comment: PostComment, isReply: boolean) => {
    const username = comment.author?.username ?? 'unknown'

    return (
      <View style={[styles.commentRow, isReply && styles.replyRow]}>
        {renderAvatar(username, comment.author?.avatar_url, isReply ? 'reply' : 'top')}
        <View style={styles.commentBody}>
          <Text style={styles.commentUsername}>@{username}</Text>
          <Text style={styles.commentContent}>{comment.content}</Text>
          <View style={styles.commentMetaRow}>
            <Text style={styles.commentTimestamp}>{formatPostTimeAgo(comment.created_at)}</Text>
            {renderLikeButton(comment.id)}
            {!isReply ? (
              <TouchableOpacity
                onPress={() => {
                  setReplyingToId((current) => (current === comment.id ? null : comment.id))
                  setReplyText('')
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                <Text style={styles.replyLink}>Reply</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {!isReply && replyingToId === comment.id ? (
            <View style={styles.replyComposer}>
              <TextInput
                style={styles.replyInput}
                placeholder="Write a reply..."
                placeholderTextColor={theme.textTertiary}
                value={replyText}
                onChangeText={setReplyText}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[
                  styles.replySendButton,
                  (!replyText.trim() || submitting) && styles.sendButtonDisabled,
                ]}
                onPress={() => handleSubmitReply(comment.id)}
                disabled={!replyText.trim() || submitting}
                activeOpacity={0.8}>
                <Ionicons
                  name="send"
                  size={14}
                  color={replyText.trim() && !submitting ? theme.accentText : theme.textTertiary}
                />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    )
  }

  const topLevelComments = comments.filter((comment) => comment.parent_comment_id == null)
  const repliesByParent = comments.reduce<Record<string, PostComment[]>>((acc, comment) => {
    if (!comment.parent_comment_id) return acc
    if (!acc[comment.parent_comment_id]) acc[comment.parent_comment_id] = []
    acc[comment.parent_comment_id].push(comment)
    return acc
  }, {})

  const toggleLabel =
    commentCount === 0 ? '💬 Comment' : `💬 ${commentCount} comment${commentCount === 1 ? '' : 's'}`

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={handleToggleExpanded} activeOpacity={0.7}>
        <Text style={styles.toggleLink}>{toggleLabel}</Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.thread}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.accent} style={styles.loader} />
          ) : (
            <>
              {topLevelComments.length === 0 ? (
                <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
              ) : (
                topLevelComments.map((comment) => (
                  <View key={comment.id} style={styles.commentBlock}>
                    {renderCommentBody(comment, false)}
                    {(repliesByParent[comment.id] ?? []).map((reply) => (
                      <View key={reply.id}>{renderCommentBody(reply, true)}</View>
                    ))}
                  </View>
                ))
              )}

              <View style={styles.topLevelComposer}>
                <TextInput
                  style={styles.topLevelInput}
                  placeholder="Add a comment..."
                  placeholderTextColor={theme.textTertiary}
                  value={topLevelText}
                  onChangeText={setTopLevelText}
                  multiline
                  maxLength={1000}
                />
                <TouchableOpacity
                  style={[
                    styles.topLevelSendButton,
                    (!topLevelText.trim() || submitting) && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSubmitTopLevel}
                  disabled={!topLevelText.trim() || submitting}
                  activeOpacity={0.8}>
                  {submitting ? (
                    <ActivityIndicator size="small" color={theme.accentText} />
                  ) : (
                    <Ionicons
                      name="send"
                      size={16}
                      color={topLevelText.trim() ? theme.accentText : theme.textTertiary}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      ) : null}
    </View>
  )
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      gap: 8,
    },
    toggleLink: {
      fontFamily: 'SpaceGrotesk-Regular',
      fontSize: 12,
      color: theme.textTertiary,
    },
    thread: {
      borderTopWidth: 0.5,
      borderTopColor: theme.border,
      backgroundColor: theme.bgTertiary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 10,
      gap: 10,
    },
    loader: {
      paddingVertical: 8,
    },
    emptyText: {
      fontFamily: 'SpaceGrotesk-Regular',
      fontSize: 12,
      color: theme.textTertiary,
      textAlign: 'center',
      paddingVertical: 4,
    },
    commentBlock: {
      gap: 8,
    },
    commentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    replyRow: {
      marginLeft: 28,
    },
    avatarTop: {},
    avatarReply: {},
    avatarPlaceholder: {
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 11,
      color: theme.textSecondary,
    },
    avatarTextSmall: {
      fontSize: 10,
    },
    commentBody: {
      flex: 1,
      gap: 2,
    },
    commentUsername: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 12,
      color: theme.text,
    },
    commentContent: {
      fontFamily: 'SpaceGrotesk-Regular',
      fontSize: 12,
      color: theme.text,
      lineHeight: 17,
    },
    commentMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 2,
    },
    commentTimestamp: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: theme.textTertiary,
    },
    likeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    likeCount: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: theme.textTertiary,
    },
    replyLink: {
      fontFamily: 'SpaceGrotesk-Regular',
      fontSize: 11,
      color: theme.accent,
    },
    replyComposer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginTop: 8,
    },
    replyInput: {
      flex: 1,
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 12,
      fontFamily: 'SpaceGrotesk-Regular',
      color: theme.text,
      maxHeight: 80,
    },
    replySendButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topLevelComposer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 0.5,
      borderTopColor: theme.border,
    },
    topLevelInput: {
      flex: 1,
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      fontFamily: 'SpaceGrotesk-Regular',
      color: theme.text,
      maxHeight: 90,
    },
    topLevelSendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: theme.border,
    },
  })
