import { supabase } from './supabase'

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export const checkIsLocalPick = async (userId: string, gemLat: number, gemLng: number): Promise<boolean> => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('home_lat, home_lng')
    .eq('id', userId)
    .single()

  if (!profile?.home_lat || !profile?.home_lng) return false

  const distance = getDistance(profile.home_lat, profile.home_lng, gemLat, gemLng)
  return distance <= 15000
}
