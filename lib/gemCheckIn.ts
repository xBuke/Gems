import * as Location from 'expo-location';
import { getDistance } from './distance';
import { checkAndUnlockAchievements, type AchievementType } from './gamification';
import { addStreakBonus } from './streak';
import { supabase } from './supabase';

export type GemCheckInParams = {
  gemId: string;
  userId: string;
  gemOwnerId: string;
  category: string;
  latitude: number;
  longitude: number;
  isPremium: boolean;
};

export type GemCheckInResult =
  | {
      ok: true;
      visitCount: number;
      checkedInAt: Date;
      newAchievements: AchievementType[];
    }
  | {
      ok: false;
      reason: 'too_far' | 'location_unavailable' | 'upsert_failed';
      message?: string;
    };

export async function performGemCheckIn(params: GemCheckInParams): Promise<GemCheckInResult> {
  let location: Location.LocationObject;
  try {
    location = await Location.getCurrentPositionAsync({});
  } catch {
    return { ok: false, reason: 'location_unavailable' };
  }

  if (!params.isPremium) {
    const distance = getDistance(
      location.coords.latitude,
      location.coords.longitude,
      params.latitude,
      params.longitude,
    );

    if (distance > 1000) {
      return { ok: false, reason: 'too_far' };
    }
  }

  const { error } = await supabase.from('gem_visits').upsert(
    {
      gem_id: params.gemId,
      user_id: params.userId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      category: params.category,
    },
    { onConflict: 'gem_id,user_id' },
  );

  if (error) {
    return { ok: false, reason: 'upsert_failed', message: error.message };
  }

  await supabase.from('notifications').insert({
    user_id: params.gemOwnerId,
    sender_id: params.userId,
    type: 'visit',
    gem_id: params.gemId,
    read: false,
  });

  const { count } = await supabase
    .from('gem_visits')
    .select('*', { count: 'exact', head: true })
    .eq('gem_id', params.gemId);

  const visitCount = count ?? 1;
  const checkedInAt = new Date();

  await addStreakBonus(params.userId, 5, 'verified_checkin', params.gemId);
  const newAchievements = await checkAndUnlockAchievements(params.userId);

  return {
    ok: true,
    visitCount,
    checkedInAt,
    newAchievements,
  };
}
