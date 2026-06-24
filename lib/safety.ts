import { supabase } from './supabase'

export const GEM_REPORT_REASONS = [
  "It doesn't exist / wrong location",
  'Spam or commercial',
  'Inappropriate content',
  'Other',
] as const

export const COMMENT_REPORT_REASONS = [
  'Spam',
  'Harassment',
  'Misinformation',
  'Inappropriate',
  'Other',
] as const

export const USER_REPORT_REASONS = [
  'Spam account',
  'Harassment',
  'Impersonation',
  'Inappropriate content',
  'Other',
] as const

export const getReportReasons = (
  targetType: 'gem' | 'comment' | 'message' | 'user',
): readonly string[] => {
  switch (targetType) {
    case 'gem':
      return GEM_REPORT_REASONS
    case 'comment':
    case 'message':
      return COMMENT_REPORT_REASONS
    case 'user':
      return USER_REPORT_REASONS
  }
}

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
