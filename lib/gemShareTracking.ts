import { Share, type ShareAction } from 'react-native';

import { supabase } from './supabase';

export function shouldTrackGemShare(result: ShareAction | undefined): boolean {
  if (!result?.action) return true;
  return result.action !== Share.dismissedAction;
}

export function trackGemShare(gemId: string) {
  void supabase.rpc('increment_gem_share_count', { p_gem_id: gemId });
}
