import { supabase } from './supabase'

export type StreakUpdateResult = {
  current_streak: number
  isNewDay: boolean
  brokeRecord?: boolean
}

let lastStreakResult: StreakUpdateResult | null = null

export const getLastStreakResult = () => lastStreakResult

export const consumeLastStreakResult = () => {
  const result = lastStreakResult
  lastStreakResult = null
  return result
}

export const updateStreak = async (userId: string) => {
  const today = new Date().toISOString().split('T')[0]

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_streak, longest_streak, last_active_date')
    .eq('id', userId)
    .single()

  if (!profile) return null

  if (profile.last_active_date === today) {
    const result = { current_streak: profile.current_streak, isNewDay: false }
    if (!lastStreakResult?.isNewDay) {
      lastStreakResult = result
    }
    return lastStreakResult ?? result
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  let newStreak = 1
  if (profile.last_active_date === yesterdayStr) {
    newStreak = (profile.current_streak || 0) + 1
  }

  const newLongest = Math.max(newStreak, profile.longest_streak || 0)

  await supabase.from('profiles').update({
    current_streak: newStreak,
    longest_streak: newLongest,
    last_active_date: today
  }).eq('id', userId)

  const result = {
    current_streak: newStreak,
    isNewDay: true,
    brokeRecord: newStreak > (profile.longest_streak || 0),
  }
  lastStreakResult = result
  return result
}

export const addStreakBonus = async (userId: string, points: number) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('streak_points')
    .eq('id', userId)
    .single()

  await supabase.from('profiles').update({
    streak_points: (profile?.streak_points || 0) + points
  }).eq('id', userId)
}
