import { Alert } from 'react-native';
import type { Router } from 'expo-router';

export const WISHLIST_FREE_LIMIT = 20;

type SupabaseError = {
  code?: string;
  message?: string;
};

export function isWishlistLimitError(error: SupabaseError | null): boolean {
  if (!error) return false;
  if (error.code === '42501') return true;
  const message = (error.message ?? '').toLowerCase();
  return (
    message.includes('row-level security') ||
    message.includes('can_add_to_wishlist') ||
    message.includes('wishlist limit')
  );
}

export function showWishlistLimitReached(router: Router): void {
  Alert.alert(
    'Wishlist limit reached (20) — upgrade to Premium for unlimited',
    undefined,
    [
      { text: 'Maybe later', style: 'cancel' },
      { text: 'Go Premium', onPress: () => router.push('/paywall') },
    ],
  );
}
