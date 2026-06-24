import { supabase } from './supabase';

export async function deleteGem(
  gemId: string,
  imageUrl: string | null,
): Promise<{ error: string | null }> {
  try {
    if (imageUrl) {
      const fileName = imageUrl.split('/').pop();
      if (fileName) {
        await supabase.storage.from('gem-images').remove([fileName]);
      }
    }

    const { error } = await supabase.from('gems').delete().eq('id', gemId);

    if (error) {
      return { error: 'Could not delete gem' };
    }

    return { error: null };
  } catch {
    return { error: 'Could not delete gem' };
  }
}
