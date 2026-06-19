import { supabase } from './supabase'

const getWeekStart = () => {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday as start
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

export const getMysteryGemOfTheWeek = async () => {
  const weekStart = getWeekStart()

  // Check if already selected this week
  const { data: existing } = await supabase
    .from('mystery_gem_history')
    .select('*, gem:gems(*, profiles!gems_user_id_fkey(username))')
    .eq('week_start', weekStart)
    .single()

  if (existing?.gem) return existing.gem

  // Pick the most-liked gem from the past 7 days that hasn't been mystery gem before
  const { data: previousMysteryIds } = await supabase
    .from('mystery_gem_history')
    .select('gem_id')
  const excludeIds = previousMysteryIds?.map(p => p.gem_id) || []

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  let query = supabase
    .from('gems')
    .select('*, profiles!gems_user_id_fkey(username)')
    .eq('is_private', false)
    .is('community_id', null)
    .gte('created_at', sevenDaysAgo.toISOString())

  const { data: candidates } = await query

  if (!candidates || candidates.length === 0) return null

  const filtered = candidates.filter(g => !excludeIds.includes(g.id))
  const pool = filtered.length > 0 ? filtered : candidates

  // Get like counts for each candidate
  const withLikes = await Promise.all(pool.map(async (gem) => {
    const { count } = await supabase
      .from('gem_likes')
      .select('*', { count: 'exact', head: true })
      .eq('gem_id', gem.id)
    return { ...gem, likeCount: count || 0 }
  }))

  withLikes.sort((a, b) => b.likeCount - a.likeCount)
  const winner = withLikes[0]

  if (winner) {
    await supabase.from('mystery_gem_history').insert({ gem_id: winner.id, week_start: weekStart })
  }

  return winner
}
