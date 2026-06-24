import type { Router } from 'expo-router';

export type PushNotificationData = {
  type?: string;
  gem_id?: string;
  user_id?: string;
  sender_id?: string;
  community_id?: string;
  username?: string;
  channelId?: string;
};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

export const parsePushNotificationData = (
  data: Record<string, unknown> | undefined,
): PushNotificationData => ({
  type: asString(data?.type),
  gem_id: asString(data?.gem_id),
  user_id: asString(data?.user_id),
  sender_id: asString(data?.sender_id),
  community_id: asString(data?.community_id),
  username: asString(data?.username),
  channelId: asString(data?.channelId),
});

export function navigateFromPushNotification(router: Router, rawData: Record<string, unknown>) {
  const data = parsePushNotificationData(rawData);
  const type = data.type;

  if (!type) {
    router.push('/notifications');
    return;
  }

  switch (type) {
    case 'nearby_gem': {
      if (data.gem_id) {
        router.push({ pathname: '/gem/[id]', params: { id: data.gem_id } });
        return;
      }
      break;
    }
    case 'follow':
    case 'follow_accepted': {
      const profileId = data.user_id ?? data.sender_id;
      if (profileId) {
        router.push({ pathname: '/profile', params: { userId: profileId } });
        return;
      }
      break;
    }
    case 'achievement': {
      router.push({ pathname: '/profile', params: { panel: 'achievements' } });
      return;
    }
    case 'comment':
    case 'like':
    case 'visit': {
      if (data.gem_id) {
        router.push({ pathname: '/gem/[id]', params: { id: data.gem_id } });
        return;
      }
      break;
    }
    case 'message': {
      const chatUserId = data.user_id ?? data.sender_id;
      if (chatUserId) {
        router.push({
          pathname: '/chat',
          params: {
            userId: chatUserId,
            username: data.username ?? '',
          },
        });
        return;
      }
      break;
    }
    case 'community_post':
    case 'community_join_request': {
      if (data.community_id) {
        router.push({ pathname: '/community/[id]', params: { id: data.community_id } });
        return;
      }
      break;
    }
    default:
      break;
  }

  router.push('/notifications');
}
