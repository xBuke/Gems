import { router } from 'expo-router';
import { supabase } from './supabase';

export const requireAuth = async (redirectTo?: string): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    if (redirectTo) {
      router.push({ pathname: '/auth', params: { redirectTo } });
    } else {
      router.push('/auth');
    }
    return false;
  }
  return true;
};
