import { useAppFonts } from '@/lib/fonts';
import { hasCompletedOnboarding, syncPendingPreferences } from '@/lib/onboarding';
import { checkAndExpireTrial } from '@/lib/paywall';
import { updateStreak } from '@/lib/streak';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import { startTracking, stopTracking } from '@/lib/locationTracker';
import { darkTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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

function RootNavigator() {
  const { theme } = useTheme();

  return (
    <>
      <ThemeEffects />
      <OnboardingGate />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: 'slide_from_right',
          animationDuration: 250,
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="auth" />
        <Stack.Screen name="map" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen
          name="add-gem"
          options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="messages" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="legal-document" options={{ headerShown: false }} />
        <Stack.Screen name="blocked-users" options={{ headerShown: false }} />
        <Stack.Screen
          name="edit-hometown"
          options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="followers" options={{ headerShown: false }} />
        <Stack.Screen name="gem/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="paywall"
          options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="gem-swipe" options={{ headerShown: false }} />
        <Stack.Screen
          name="trip-planner"
          options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="communities" options={{ headerShown: false }} />
        <Stack.Screen
          name="create-community"
          options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="create-category"
          options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="community/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useAppFonts();

  useEffect(() => {
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
          <RootNavigator />
        </ThemeProvider>
      )}
    </GestureHandlerRootView>
  );
}
