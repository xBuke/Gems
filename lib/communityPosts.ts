import { supabase } from './supabase'

export const REACTION_TYPES = ['fire', 'wave', 'heart', 'gem', 'mountain'] as const
export type ReactionType = (typeof REACTION_TYPES)[number]

export const REACTION_EMOJI: Record<ReactionType, string> = {
  fire: '🔥',
  wave: '🌊',
  heart: '❤',
  gem: '💎',
  mountain: '🏔',
}

export type PostAuthor = {
  username: string
  avatar_url?: string | null
}

export type PostGem = {
  id: string
  title: string
  category: string
  image_url: string | null
  latitude: number
  longitude: number
  profiles: { username: string } | null
}

export type CommunityPost = {
  id: string
  community_id: string
  author_id: string
  post_type: 'text' | 'gem_share'
  content: string | null
  gem_id: string | null
  is_pinned: boolean
  created_at: string
  author: PostAuthor | null
  gem: PostGem | null
}

export type ReactionRow = {
  id: string
  post_id: string
  user_id: string
  reaction_type: ReactionType
}

export type ReactionSummary = Record<ReactionType, number>

export const emptyReactionSummary = (): ReactionSummary => ({
  fire: 0,
  wave: 0,
  heart: 0,
  gem: 0,
  mountain: 0,
})

export const buildReactionSummary = (
  rows: Pick<ReactionRow, 'post_id' | 'reaction_type'>[],
  postId: string,
): ReactionSummary => {
  const summary = emptyReactionSummary()
  for (const row of rows) {
    if (row.post_id === postId && row.reaction_type in summary) {
      summary[row.reaction_type] += 1
    }
  }
  return summary
}

export const formatPostTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export const createGemSharePost = async (
  communityId: string,
  authorId: string,
  gemId: string,
) => {
  return supabase.from('community_posts').insert({
    community_id: communityId,
    author_id: authorId,
    post_type: 'gem_share',
    gem_id: gemId,
    content: null,
  })
}

export const togglePostReaction = async (
  postId: string,
  userId: string,
  reactionType: ReactionType,
  currentReaction: ReactionType | null,
) => {
  if (currentReaction === reactionType) {
    return supabase
      .from('community_post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
  }

  if (currentReaction) {
    return supabase
      .from('community_post_reactions')
      .update({ reaction_type: reactionType })
      .eq('post_id', postId)
      .eq('user_id', userId)
  }

  return supabase.from('community_post_reactions').insert({
    post_id: postId,
    user_id: userId,
    reaction_type: reactionType,
  })
}
