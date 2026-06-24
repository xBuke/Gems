import { supabase } from './supabase'

export type GemVisibility = 'public' | 'friends' | 'private'

export const GEM_SELECT_WITH_COMMUNITY =
  '*, profiles!gems_user_id_fkey(username), communities(name, icon, color)'

export const GEM_SELECT_MAP = '*, communities(name, icon, color)'

export type CommunityGemInfo = {
  name: string
  icon: string
  color: string
}

export const fetchMyCommunityIds = async (userId: string | null): Promise<string[]> => {
  if (!userId) return []

  const { data: memberships } = await supabase
    .from('community_members')
    .select('community_id')
    .eq('user_id', userId)
    .eq('status', 'accepted')

  return memberships?.map((m: { community_id: string }) => m.community_id) || []
}

export const applyCommunityGemFilter = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  myCommunityIds: string[],
) => {
  if (myCommunityIds.length === 0) {
    return query.is('community_id', null)
  }
  return query.or(`community_id.is.null,community_id.in.(${myCommunityIds.join(',')})`)
}
