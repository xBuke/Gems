import { supabase } from '@/lib/supabase';

/** Mark incoming DMs and matching message notifications read for a conversation. */
export async function markConversationRead(
  myUserId: string,
  otherUserId: string,
): Promise<void> {
  const [messagesResult, notificationsResult] = await Promise.all([
    supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', myUserId)
      .eq('sender_id', otherUserId)
      .select('id, read'),
    supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', myUserId)
      .eq('type', 'message')
      .eq('sender_id', otherUserId)
      .eq('read', false)
      .select('id, read, type, sender_id'),
  ]);

  if (messagesResult.error) {
    console.warn('Failed to mark messages as read:', messagesResult.error);
  }
  if (notificationsResult.error) {
    console.warn('Failed to mark message notifications as read:', notificationsResult.error);
  }
}
