import { supabase } from './supabase'

export type CustomCategory = {
  id: string
  creator_id: string
  name: string
  icon: string
  color: string
  visibility: 'public' | 'private'
  created_at: string
  creator?: { username: string } | null
}

export const fetchVisibleCustomCategories = async (userId: string) => {
  const { data } = await supabase
    .from('custom_categories')
    .select('*, creator:profiles!custom_categories_creator_id_fkey(username)')
    .order('created_at', { ascending: false })
  return (data || []) as CustomCategory[]
}

export const canAddToCustomCategory = async (category: CustomCategory, userId: string): Promise<boolean> => {
  if (category.visibility === 'public') {
    const { checkIsPremium } = await import('./paywall')
    return await checkIsPremium()
  }
  if (category.visibility === 'private') {
    return category.creator_id === userId
  }
  return false
}
