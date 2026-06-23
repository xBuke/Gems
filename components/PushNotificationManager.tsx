import { navigateFromPushNotification } from '@/lib/pushNotificationNavigation';
import {
  configureForegroundNotificationHandler,
  mapPushToastType,
  registerPushNotificationsForUser,
  setupAndroidNotificationChannels,
} from '@/lib/pushNotifications';
import { useToast } from '@/lib/ToastContext';
import { supabase } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export function PushNotificationManager() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);
  const routerRef = useRef(router);

  showToastRef.current = showToast;
  routerRef.current = router;

  useEffect(() => {
    if (Platform.OS === 'web') return;

    configureForegroundNotificationHandler();
    void setupAndroidNotificationChannels();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !navigationState?.key) return;

    const handleResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      navigateFromPushNotification(routerRef.current, data);
    };

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      const payload = (data ?? {}) as Record<string, unknown>;

      showToastRef.current({
        type: mapPushToastType(payload),
        title: title ?? 'Notification',
        message: body ?? undefined,
        onPress: () => navigateFromPushNotification(routerRef.current, payload),
      });
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(handleResponse);

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      handleResponse(lastResponse);
      Notifications.clearLastNotificationResponse();
    }

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [navigationState?.key]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const registerForSession = async (userId: string) => {
      await registerPushNotificationsForUser(userId);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        void registerForSession(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        void registerForSession(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
