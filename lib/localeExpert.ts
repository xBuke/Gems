import { supabase } from './supabase'
import { getDistance } from './distance'

export const LOCALE_EXPERT_THRESHOLD = 90 // percent

export const checkLocaleExpertBadge = async (
  userId: string,
  cityName: string,
  cityLat: number,
  cityLng: number,
  radiusMeters: number = 25000,
) => {
  const { data: allPublicGems } = await supabase
    .from('gems')
    .select('id, latitude, longitude')
    .eq('is_private', false)
    .is('community_id', null)

  const gemsInArea =
    allPublicGems?.filter(
      (g: { latitude: number; longitude: number }) =>
        getDistance(cityLat, cityLng, g.latitude, g.longitude) <= radiusMeters,
    ) || []

  if (gemsInArea.length === 0) return false

  const { data: userVisits } = await supabase
    .from('gem_visits')
    .select('gem_id')
    .eq('user_id', userId)

  const visitedGemIds = new Set(userVisits?.map((v: { gem_id: string }) => v.gem_id) || [])
  const visitedInArea = gemsInArea.filter((g: { id: string }) => visitedGemIds.has(g.id))

  const completionPercent = (visitedInArea.length / gemsInArea.length) * 100

  if (completionPercent >= LOCALE_EXPERT_THRESHOLD) {
    const { data: existing } = await supabase
      .from('locale_badges')
      .select('id')
      .eq('user_id', userId)
      .eq('city_name', cityName)
      .single()

    if (!existing) {
      await supabase.from('locale_badges').insert({
        user_id: userId,
        city_name: cityName,
        lat: cityLat,
        lng: cityLng,
      })
      return true // newly unlocked
    }
  }

  return false
}
