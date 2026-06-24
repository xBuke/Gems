import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { hasCompletedOnboarding } from '@/lib/onboarding';
import { supabase } from '@/lib/supabase';

let foregroundHandlerConfigured = false;

export function getExpoProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

export function configureForegroundNotificationHandler() {
  if (foregroundHandlerConfigured || Platform.OS === 'web') return;
  foregroundHandlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}

export async function setupAndroidNotificationChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('nearby', {
    name: 'Nearby Gems',
    importance: AndroidImportance.HIGH,
    description: 'Alerts when a new gem is added near you',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2DD4BF',
  });

  await Notifications.setNotificationChannelAsync('social', {
    name: 'Social',
    importance: AndroidImportance.DEFAULT,
    description: 'Follows, likes, comments, and messages',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2DD4BF',
  });

  await Notifications.setNotificationChannelAsync('achievements', {
    name: 'Achievements',
    importance: AndroidImportance.DEFAULT,
    description: 'Badge unlocks and milestones',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2DD4BF',
  });
}

async function ensureNotificationPreferences(userId: string) {
  const { data } = await supabase
    .from('notification_preferences')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (data) return;

  await supabase.from('notification_preferences').insert({
    user_id: userId,
    nearby_enabled: true,
    social_enabled: true,
    achievements_enabled: true,
  });
}

async function upsertPushToken(userId: string, token: string) {
  await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform: Platform.OS,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' },
  );
}

export async function registerPushNotificationsForUser(userId: string): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return false;
  }

  const onboardingComplete = await hasCompletedOnboarding();
  if (!onboardingComplete) {
    return false;
  }

  configureForegroundNotificationHandler();
  await setupAndroidNotificationChannels();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    console.warn(
      '[push] Missing EAS projectId in app.json extra.eas.projectId — run `npx eas init` to add one.',
    );
    return false;
  }

  try {
    const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
    await upsertPushToken(userId, pushToken.data);
    await ensureNotificationPreferences(userId);
    return true;
  } catch (error) {
    console.warn('[push] Failed to register push token:', error);
    return false;
  }
}

export function mapPushToastType(
  data: Record<string, unknown>,
): 'success' | 'error' | 'warning' | 'info' {
  const type = typeof data.type === 'string' ? data.type : '';
  if (type === 'achievement') return 'success';
  return 'info';
}
