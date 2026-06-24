import { supabase } from '@/lib/supabase';

const DEACTIVATION_GRACE_DAYS = 30;

/** Tables touched by the old instant-delete cascade — reuse in the scheduled permanent-deletion job. */
export const PERMANENT_DELETION_TABLES = [
  'community_messages (by community_id for owned communities)',
  'community_members (by community_id for owned communities)',
  'communities (creator_id)',
  'saved_gems',
  'gem_likes',
  'gem_visits',
  'comment_likes',
  'comments',
  'notifications',
  'messages',
  'follows',
  'blocked_users',
  'community_members (user_id)',
  'community_messages (user_id)',
  'custom_categories',
  'user_locations',
  'reports',
  'gems',
  'profiles',
] as const;

export async function deactivateAccount(userId: string): Promise<{ error: Error | null }> {
  const deactivatedAt = new Date();
  const scheduledDeletionAt = new Date(
    deactivatedAt.getTime() + DEACTIVATION_GRACE_DAYS * 24 * 60 * 60 * 1000,
  );

  const { error } = await supabase
    .from('profiles')
    .update({
      deactivated_at: deactivatedAt.toISOString(),
      scheduled_deletion_at: scheduledDeletionAt.toISOString(),
    })
    .eq('id', userId);

  return { error: error ? new Error(error.message) : null };
}

export async function isReactivationEligible(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_reactivation_eligible', {
    p_user_id: userId,
  });

  if (error) {
    console.warn('[account] check_reactivation_eligible failed:', error.message);
    return false;
  }

  return data === true;
}

export async function reactivateAccount(userId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({
      deactivated_at: null,
      scheduled_deletion_at: null,
    })
    .eq('id', userId);

  return { error: error ? new Error(error.message) : null };
}
