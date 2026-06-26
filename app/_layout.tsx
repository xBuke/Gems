import { ensureInstallDateRecorded } from '@/lib/appRating';
import { useAppFonts } from '@/lib/fonts';
import { hasCompletedOnboarding, syncPendingPreferences } from '@/lib/onboarding';
import {
  getModalScreenOptions,
  getStackPushOptions,
  getTabScreenOptions,
} from '@/lib/navigationMotion';
import { checkAndExpireTrial } from '@/lib/paywall';
import { ReduceMotionProvider, useReduceMotion } from '@/lib/ReduceMotionContext';
import { updateStreak } from '@/lib/streak';
import { OfflineBanner, useOfflineStatus } from '@/components/OfflineBanner';
import { PushNotificationManager } from '@/components/PushNotificationManager';
import { ToastProvider } from '@/lib/ToastContext';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import { startTracking, stopTracking } from '@/lib/locationTracker';
import { darkTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const DARK_HERO_STATUS_BAR_ROUTES = new Set(['map', 'onboarding', 'paywall', 'gem']);

function OnboardingGate() {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (!rootNavigationState?.key) return;

    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await checkAndExpireTrial();
        await syncPendingPreferences(session.user.id);
        await updateStreak(session.user.id);
      }

      const completed = await hasCompletedOnboarding();
      const currentRoute = segments[0];
      if (!completed && currentRoute !== 'onboarding' && currentRoute !== 'auth') {
        router.replace('/onboarding');
      }
    };

    run();
  }, [rootNavigationState?.key, segments, router]);

  return null;
}

function ThemeEffects() {
  const { theme } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void NavigationBar.setBackgroundColorAsync(theme.background);
  }, [theme.background]);

  return null;
}

function OfflineShell({ children }: { children: ReactNode }) {
  const { showBanner, dismissBanner } = useOfflineStatus();

  return (
    <>
      {showBanner ? <OfflineBanner onDismiss={dismissBanner} /> : null}
      {children}
    </>
  );
}

function AdaptiveStatusBar() {
  const segments = useSegments();
  const { isDark, theme } = useTheme();
  const rootRoute = segments[0];

  const forceLightContent =
    rootRoute != null && DARK_HERO_STATUS_BAR_ROUTES.has(rootRoute);
  const style = forceLightContent ? 'light' : isDark ? 'light' : 'dark';
  const backgroundColor =
    forceLightContent ? darkTheme.background : theme.background;

  return (
    <StatusBar
      style={style}
      {...(Platform.OS === 'android'
        ? { backgroundColor, translucent: false }
        : {})}
    />
  );
}

function RootNavigator() {
  const { theme } = useTheme();
  const reduceMotion = useReduceMotion();
  const stackPushOptions = getStackPushOptions(reduceMotion);
  const tabOptions = getTabScreenOptions(reduceMotion);
  const modalOptions = getModalScreenOptions(reduceMotion);

  return (
    <OfflineShell>
      <ThemeEffects />
      <OnboardingGate />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          ...stackPushOptions,
        }}>
        <Stack.Screen name="index" options={tabOptions} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="follow-suggestions" options={{ headerShown: false }} />
        <Stack.Screen name="auth" />
        <Stack.Screen name="map" options={{ headerShown: false, ...tabOptions }} />
        <Stack.Screen name="notifications" options={{ headerShown: false, ...tabOptions }} />
        <Stack.Screen name="add-gem" options={modalOptions} />
        <Stack.Screen name="messages" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false, ...tabOptions }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="legal-document" options={{ headerShown: false }} />
        <Stack.Screen name="blocked-users" options={{ headerShown: false }} />
        <Stack.Screen name="edit-hometown" options={modalOptions} />
        <Stack.Screen name="followers" options={{ headerShown: false }} />
        <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
        <Stack.Screen name="wishlist" options={{ headerShown: false }} />
        <Stack.Screen name="user-gems" options={{ headerShown: false }} />
        <Stack.Screen name="gem/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="paywall" options={modalOptions} />
        <Stack.Screen name="gem-swipe" options={{ headerShown: false }} />
        <Stack.Screen name="trip-planner" options={modalOptions} />
        <Stack.Screen name="search" options={modalOptions} />
        <Stack.Screen name="communities" options={{ headerShown: false }} />
        <Stack.Screen name="create-community" options={modalOptions} />
        <Stack.Screen name="create-category" options={modalOptions} />
        <Stack.Screen name="community/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
      </Stack>
      <AdaptiveStatusBar />
    </OfflineShell>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useAppFonts();

  useEffect(() => {
    void ensureInstallDateRecorded();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        startTracking(session.user.id);
        await checkAndExpireTrial();
        await syncPendingPreferences(session.user.id);
        await updateStreak(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        startTracking(session.user.id);
        await checkAndExpireTrial();
        await syncPendingPreferences(session.user.id);
        await updateStreak(session.user.id);
      } else {
        stopTracking();
      }
    });

    return () => {
      subscription.unsubscribe();
      stopTracking();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {!fontsLoaded ? (
        <View style={{ flex: 1, backgroundColor: darkTheme.background }} />
      ) : (
        <ThemeProvider>
          <ReduceMotionProvider>
            <ToastProvider>
              <BottomSheetModalProvider>
                <PushNotificationManager />
                <RootNavigator />
              </BottomSheetModalProvider>
            </ToastProvider>
          </ReduceMotionProvider>
        </ThemeProvider>
      )}
    </GestureHandlerRootView>
  );
}
