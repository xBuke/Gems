import { supabase } from './supabase'
import { FREE_GEM_LIMIT, PREMIUM_CATEGORY_IDS } from './categories'

export const checkIsPremium = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('profiles').select('is_premium').eq('id', user.id).single()
  return data?.is_premium || false
}

export const canAddGem = async (): Promise<{ allowed: boolean, reason?: string }> => {
  const isPremium = await checkIsPremium()
  if (isPremium) return { allowed: true }
  
  const { data: { user } } = await supabase.auth.getUser()
  const { count } = await supabase.from('gems').select('*', { count: 'exact', head: true }).eq('user_id', user!.id)
  
  if (count >= FREE_GEM_LIMIT) {
    return { allowed: false, reason: `Free users can only add ${FREE_GEM_LIMIT} gems. Upgrade to Premium for unlimited gems!` }
  }
  return { allowed: true }
}

export const canUseCategory = async (categoryId: string): Promise<boolean> => {
  if (!PREMIUM_CATEGORY_IDS.includes(categoryId)) return true
  return await checkIsPremium()
}

export const checkAndExpireTrial = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data } = await supabase
    .from('profiles')
    .select('trial_ends_at, is_premium')
    .eq('id', user.id)
    .single()
  if (data?.trial_ends_at && new Date(data.trial_ends_at) < new Date() && data.is_premium) {
    await supabase
      .from('profiles')
      .update({ is_premium: false, trial_ends_at: null })
      .eq('id', user.id)
  }
}
