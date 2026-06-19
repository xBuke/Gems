import { supabase } from './supabase'

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
  return data?.map((d: { community: unknown }) => d.community) || []
}

export const getCommunityMemberCount = async (communityId: string) => {
  const { count } = await supabase
    .from('community_members')
    .select('*', { count: 'exact', head: true })
    .eq('community_id', communityId)
  return count || 0
}

export const canJoinMoreCommunities = async (userId: string): Promise<boolean> => {
  const { checkIsPremium } = await import('./paywall')
  const isPremium = await checkIsPremium()
  if (isPremium) return true
  const myCommunities = await fetchMyCommunities(userId)
  return myCommunities.length < 1
}
