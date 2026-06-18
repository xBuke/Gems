import { router } from 'expo-router';
import { supabase } from './supabase';

export const requireAuth = async (): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    router.push('/auth');
    return false;
  }
  return true;
};
