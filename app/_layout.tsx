import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import { startTracking, stopTracking } from '@/lib/locationTracker';
import { supabase } from '@/lib/supabase';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

function RootNavigator() {
  const { theme } = useTheme();

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="discover" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="add-gem" options={{ headerShown: false }} />
        <Stack.Screen name="messages" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="followers" options={{ headerShown: false }} />
        <Stack.Screen name="gem/[id]" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) startTracking(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        startTracking(session.user.id);
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
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}
