import { supabase } from './supabase'

export type CommunityJoinType = 'open' | 'invite_only'
export type CommunityMemberStatus = 'pending' | 'accepted'

export const fetchCommunities = async () => {
  const { data } = await supabase
    .from('communities')
    .select('*, creator:profiles!communities_creator_id_fkey(username)')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
  return data || []
}

export const fetchMyCommunities = async (userId: string) => {
  const { data } = await supabase
    .from('community_members')
    .select('*, community:communities(*, creator:profiles!communities_creator_id_fkey(username))')
    .eq('user_id', userId)
    .eq('status', 'accepted')
  return data?.map((d: { community: unknown }) => d.community) || []
}

export const fetchMyMemberships = async (
  userId: string,
): Promise<{ community_id: string; status: CommunityMemberStatus }[]> => {
  const { data } = await supabase
    .from('community_members')
    .select('community_id, status')
    .eq('user_id', userId)

  return (data ?? []) as { community_id: string; status: CommunityMemberStatus }[]
}

export const getCommunityMemberCount = async (communityId: string) => {
  const { count } = await supabase
    .from('community_members')
    .select('*', { count: 'exact', head: true })
    .eq('community_id', communityId)
    .eq('status', 'accepted')
  return count || 0
}

export const canJoinMoreCommunities = async (userId: string): Promise<boolean> => {
  const { checkIsPremium } = await import('./paywall')
  const isPremium = await checkIsPremium()
  if (isPremium) return true
  const myCommunities = await fetchMyCommunities(userId)
  return myCommunities.length < 1
}
