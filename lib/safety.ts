import { supabase } from './supabase'

export const REPORT_REASONS = [
  'Inappropriate content',
  'Spam',
  'Harassment',
  'Fake location',
  'Other',
]

export const createReport = async (
  reporterId: string,
  targetType: 'gem' | 'comment' | 'message' | 'user',
  targetId: string,
  reason: string,
  details?: string,
) => {
  const { data, error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    target_type: targetType,
    target_id: targetId,
    reason,
    details: details || null,
  });
  console.log('Report insert result:', data, error);
  return { data, error };
};

export const blockUser = async (blockerId: string, blockedId: string) => {
  return await supabase.from('blocked_users').insert({ blocker_id: blockerId, blocked_id: blockedId })
}

export const unblockUser = async (blockerId: string, blockedId: string) => {
  return await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
}

export const isUserBlocked = async (blockerId: string, targetId: string): Promise<boolean> => {
  const { data } = await supabase
    .from('blocked_users')
    .select('id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', targetId)
    .single()
  return !!data
}

export const getMyBlockedUsers = async (userId: string) => {
  const { data } = await supabase
    .from('blocked_users')
    .select('*, blocked:profiles!blocked_users_blocked_id_fkey(username)')
    .eq('blocker_id', userId)
  return data || []
}
