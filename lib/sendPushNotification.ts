import { supabase } from '@/lib/supabase';

export type PushCategory = 'nearby' | 'social' | 'achievements';

export type SendPushParams = {
  user_id: string;
  category: PushCategory;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

/** Fire-and-forget — never throws, never blocks the caller. */
export function sendPushNotification(params: SendPushParams): void {
  void supabase.functions
    .invoke('send-push-notification', { body: params })
    .then(({ error }) => {
      if (error) {
        console.warn('[push] send-push-notification failed:', error.message);
      }
    })
    .catch((err) => {
      console.warn('[push] send-push-notification failed:', err);
    });
}
