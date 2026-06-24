import { compressImage } from './imageCompress';
import { supabase } from './supabase';

export const MAX_GEM_PHOTOS_PER_CONTRIBUTOR = 5;

export const GEM_PHOTO_SELECT =
  '*, profiles!gem_photos_contributor_id_fkey(username, avatar_url)';

export type GemPhoto = {
  id: string;
  gem_id: string;
  contributor_id: string;
  photo_url: string;
  is_owner_photo: boolean;
  created_at: string;
  profiles?: { username: string; avatar_url: string | null } | null;
};

export type LocalGemPhoto = {
  id: string;
  uri: string;
  photoUrl?: string;
  isUploaded: boolean;
};

export const photoUrlFromStorage = (photoUrl: string): string | null => {
  const fileName = photoUrl.split('/').pop();
  return fileName ?? null;
};

export const uploadGemPhoto = async (uri: string): Promise<string | null> => {
  const compressedUri = await compressImage(uri);
  const fileName = `gem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;

  const formData = new FormData();
  formData.append('file', {
    uri: compressedUri,
    name: fileName,
    type: 'image/jpeg',
  } as unknown as Blob);

  const { error } = await supabase.storage
    .from('gem-images')
    .upload(fileName, formData, { contentType: 'multipart/form-data' });

  if (error) {
    console.error('Gem photo upload error:', error);
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('gem-images').getPublicUrl(fileName);

  return publicUrl;
};

export const fetchGemPhotos = async (gemId: string): Promise<GemPhoto[]> => {
  const { data, error } = await supabase
    .from('gem_photos')
    .select(GEM_PHOTO_SELECT)
    .eq('gem_id', gemId)
    .order('is_owner_photo', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('fetchGemPhotos error:', error);
    return [];
  }

  return (data ?? []) as GemPhoto[];
};

export const insertGemPhoto = async (
  gemId: string,
  contributorId: string,
  photoUrl: string,
): Promise<{ data: GemPhoto | null; error: string | null }> => {
  const { data, error } = await supabase
    .from('gem_photos')
    .insert({
      gem_id: gemId,
      contributor_id: contributorId,
      photo_url: photoUrl,
    })
    .select(GEM_PHOTO_SELECT)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as GemPhoto, error: null };
};

export const deletePhotoFromStorage = async (photoUrl: string): Promise<void> => {
  const fileName = photoUrlFromStorage(photoUrl);
  if (!fileName) return;
  await supabase.storage.from('gem-images').remove([fileName]);
};

export const deleteContributorPhotos = async (
  gemId: string,
  contributorId: string,
): Promise<{ error: string | null }> => {
  const { data: photos, error: fetchError } = await supabase
    .from('gem_photos')
    .select('id, photo_url')
    .eq('gem_id', gemId)
    .eq('contributor_id', contributorId);

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!photos || photos.length === 0) {
    return { error: null };
  }

  await Promise.all(
    photos.map((photo: { photo_url: string }) => deletePhotoFromStorage(photo.photo_url)),
  );

  const { error } = await supabase
    .from('gem_photos')
    .delete()
    .eq('gem_id', gemId)
    .eq('contributor_id', contributorId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
};

export const deleteAllGemPhotos = async (gemId: string): Promise<void> => {
  const { data: photos } = await supabase
    .from('gem_photos')
    .select('photo_url')
    .eq('gem_id', gemId);

  if (photos && photos.length > 0) {
    await Promise.all(photos.map((photo: { photo_url: string }) => deletePhotoFromStorage(photo.photo_url)));
  }
};

export const uploadAndInsertGemPhotos = async (
  gemId: string,
  contributorId: string,
  localUris: string[],
): Promise<{ photoUrls: string[]; error: string | null }> => {
  const photoUrls: string[] = [];

  for (const uri of localUris) {
    const photoUrl = await uploadGemPhoto(uri);
    if (!photoUrl) {
      return { photoUrls, error: 'Could not upload photo' };
    }

    const { error } = await insertGemPhoto(gemId, contributorId, photoUrl);
    if (error) {
      await deletePhotoFromStorage(photoUrl);
      return { photoUrls, error };
    }

    photoUrls.push(photoUrl);
  }

  return { photoUrls, error: null };
};

export const sortGemPhotos = (photos: GemPhoto[]): GemPhoto[] =>
  [...photos].sort((a, b) => {
    if (a.is_owner_photo !== b.is_owner_photo) {
      return a.is_owner_photo ? -1 : 1;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

export const getDistinctContributors = (photos: GemPhoto[]) => {
  const map = new Map<
    string,
    { contributorId: string; username: string; avatarUrl: string | null }
  >();

  for (const photo of photos) {
    if (!map.has(photo.contributor_id)) {
      map.set(photo.contributor_id, {
        contributorId: photo.contributor_id,
        username: photo.profiles?.username ?? 'unknown',
        avatarUrl: photo.profiles?.avatar_url ?? null,
      });
    }
  }

  return Array.from(map.values());
};
