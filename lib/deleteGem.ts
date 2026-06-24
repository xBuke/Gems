import { deleteAllGemPhotos, deletePhotoFromStorage } from './gemPhotos';
import { supabase } from './supabase';

export async function deleteGem(
  gemId: string,
  imageUrl: string | null,
): Promise<{ error: string | null }> {
  try {
    await deleteAllGemPhotos(gemId);

    if (imageUrl) {
      await deletePhotoFromStorage(imageUrl);
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
