import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'

export const ONBOARDING_SEEN_KEY = 'onboarding_seen'
export const PENDING_PREFS_KEY = 'onboarding_pending_prefs'

export type PendingPrefs = {
  preferred_categories: string[]
  explore_preference?: 'urban' | 'nature'
  discover_style?: 'solo' | 'social'
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  const seen = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY)
  if (seen === 'true') return true

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('profiles')
    .select('has_completed_onboarding')
    .eq('id', user.id)
    .single()

  if (data?.has_completed_onboarding) {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true')
    return true
  }
  return false
}

export async function savePendingPreferences(prefs: PendingPrefs) {
  await AsyncStorage.setItem(PENDING_PREFS_KEY, JSON.stringify(prefs))
}

export async function syncPendingPreferences(userId: string) {
  const raw = await AsyncStorage.getItem(PENDING_PREFS_KEY)
  if (!raw) return

  const prefs: PendingPrefs = JSON.parse(raw)
  await supabase
    .from('profiles')
    .update({
      preferred_categories: prefs.preferred_categories,
      has_completed_onboarding: true,
    })
    .eq('id', userId)

  await AsyncStorage.removeItem(PENDING_PREFS_KEY)
}

export async function savePreferences(userId: string | null, prefs: PendingPrefs) {
  if (userId) {
    await supabase
      .from('profiles')
      .update({
        preferred_categories: prefs.preferred_categories,
        has_completed_onboarding: true,
      })
      .eq('id', userId)
  } else {
    await savePendingPreferences(prefs)
  }
}
