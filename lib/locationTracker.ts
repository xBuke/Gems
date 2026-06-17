import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';

let subscription: Location.LocationSubscription | null = null;
let currentUserId: string | null = null;

const saveLocation = async (latitude: number, longitude: number) => {
  if (!currentUserId) return;

  await supabase.from('user_locations').insert({
    user_id: currentUserId,
    latitude,
    longitude,
  });
};

export const startTracking = async (userId: string) => {
  await stopTracking();
  currentUserId = userId;

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;

  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 50,
      timeInterval: 30000,
    },
    (location) => {
      saveLocation(location.coords.latitude, location.coords.longitude);
    }
  );
};

export const stopTracking = async () => {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
  currentUserId = null;
};
