import { startTracking, stopTracking } from '@/lib/locationTracker';
import { supabase } from '@/lib/supabase';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

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
    <View style={{ flex: 1, backgroundColor: '#0A2E1F' }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A2E1F' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="add-gem" options={{ headerShown: false }} />
        <Stack.Screen name="messages" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="gem/[id]" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </View>
  );
}
