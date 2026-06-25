import { AppBottomSheetModal, type AppBottomSheetModalRef } from '@/components/AppBottomSheetModal';
import {
  deleteContributorPhotos,
  insertGemPhoto,
  MAX_GEM_PHOTOS_PER_CONTRIBUTOR,
  uploadGemPhoto,
  type GemPhoto,
  type LocalGemPhoto,
} from '@/lib/gemPhotos';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { useToast } from '@/lib/ToastContext';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const DELETE_RED = '#F87171';
const THUMB_SIZE = 80;

type GemPhotoPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  gemId?: string | null;
  contributorId: string;
  photos: LocalGemPhoto[];
  onPhotosChange: (photos: LocalGemPhoto[]) => void;
  onPersistedPhotosChange?: (photos: GemPhoto[]) => void;
  onCameraPermissionDenied?: () => void;
};

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export type GemPhotoPickerSheetRef = AppBottomSheetModalRef;

const GemPhotoPickerSheet = forwardRef<GemPhotoPickerSheetRef, GemPhotoPickerSheetProps>(
  function GemPhotoPickerSheet(
    {
      visible,
      onClose,
      gemId,
      contributorId,
      photos,
      onPhotosChange,
      onPersistedPhotosChange,
      onCameraPermissionDenied,
    },
    forwardedRef,
  ) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sheetRef = useRef<AppBottomSheetModalRef>(null);
  const [uploading, setUploading] = useState(false);

  const present = useCallback(() => {
    sheetRef.current?.present();
  }, []);

  const dismiss = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  useImperativeHandle(
    forwardedRef,
    () => ({
      present,
      dismiss,
    }),
    [present, dismiss],
  );

  const atCap = photos.length >= MAX_GEM_PHOTOS_PER_CONTRIBUTOR;
  const remainingSlots = MAX_GEM_PHOTOS_PER_CONTRIBUTOR - photos.length;

  const showPhotoTooLargeToast = (retry: () => void) => {
    showToast({
      type: 'error',
      title: 'Upload failed',
      message: 'Photo too large · max 10MB',
      actionLabel: 'Retry',
      onAction: retry,
    });
  };

  const validatePhotoSize = async (uri: string, retry: () => void): Promise<boolean> => {
    const info = await FileSystem.getInfoAsync(uri);
    const size = info.exists && 'size' in info ? info.size ?? 0 : 0;
    if (size > MAX_PHOTO_BYTES) {
      showPhotoTooLargeToast(retry);
      return false;
    }
    return true;
  };

  const persistPhoto = async (uri: string): Promise<LocalGemPhoto | null> => {
    if (!gemId) {
      return { id: makeLocalId(), uri, isUploaded: false };
    }

    const photoUrl = await uploadGemPhoto(uri);
    if (!photoUrl) {
      showToast({
        type: 'error',
        title: 'Upload failed',
        message: 'Could not upload photo',
      });
      return null;
    }

    const { data, error } = await insertGemPhoto(gemId, contributorId, photoUrl);
    if (error || !data) {
      showToast({
        type: 'error',
        title: 'Could not add photo',
        message: error ?? 'Please try again',
      });
      return null;
    }

    onPersistedPhotosChange?.([data]);
    return {
      id: data.id,
      uri: data.photo_url,
      photoUrl: data.photo_url,
      isUploaded: true,
    };
  };

  const addPhotosFromUris = async (uris: string[], retry: () => void) => {
    if (remainingSlots <= 0) return;

    const slots = Math.min(uris.length, remainingSlots);
    const toAdd = uris.slice(0, slots);
    setUploading(true);

    const nextPhotos = [...photos];
    try {
      for (const uri of toAdd) {
        const info = await FileSystem.getInfoAsync(uri);
        const assetSize = info.exists && 'size' in info ? info.size ?? 0 : 0;
        if (assetSize > MAX_PHOTO_BYTES) {
          showPhotoTooLargeToast(retry);
          continue;
        }
        const valid = await validatePhotoSize(uri, retry);
        if (!valid) continue;

        const added = await persistPhoto(uri);
        if (added) {
          nextPhotos.push(added);
          hapticLight();
        }
      }

      if (nextPhotos.length !== photos.length) {
        onPhotosChange(nextPhotos);
        hapticSuccess();
      }
    } finally {
      setUploading(false);
    }
  };

  const openCamera = async () => {
    if (atCap) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      onCameraPermissionDenied?.();
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      await addPhotosFromUris([result.assets[0].uri], openCamera);
    }
  };

  const openGallery = async () => {
    if (atCap) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery access is required to choose photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      allowsEditing: false,
      quality: 1,
      base64: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      await addPhotosFromUris(
        result.assets.map((asset) => asset.uri),
        openGallery,
      );
    }
  };

  const handleRemoveAll = () => {
    if (photos.length === 0) return;

    Alert.alert(
      'Remove all photos?',
      'This will remove every photo you added to this gem.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove all',
          style: 'destructive',
          onPress: async () => {
            if (gemId) {
              setUploading(true);
              const { error } = await deleteContributorPhotos(gemId, contributorId);
              setUploading(false);
              if (error) {
                Alert.alert('Error', error);
                return;
              }
              onPersistedPhotosChange?.([]);
            }
            onPhotosChange([]);
            hapticSuccess();
            onClose();
          },
        },
      ],
    );
  };

  return (
    <AppBottomSheetModal
      ref={sheetRef}
      visible={visible}
      onClose={onClose}
      snapPoints={['52%']}>
      <BottomSheetScrollView
        overScrollMode="never"
        bounces={Platform.OS === 'ios' ? false : undefined}
        contentContainerStyle={styles.content}>
        <Text style={styles.title}>Add photo</Text>
        <Text style={styles.subtitle}>Show other explorers what makes this gem special</Text>

        <View style={styles.previewHeader}>
          <Text style={styles.previewLabel}>Photos</Text>
          {atCap ? <Text style={styles.capIndicator}>5/5</Text> : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.previewRow}>
          {photos.map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: photo.uri }}
              style={styles.thumbnail}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
            />
          ))}
          {!atCap ? (
            <TouchableOpacity
              style={styles.addTile}
              onPress={openGallery}
              activeOpacity={0.7}
              disabled={uploading}>
              <Ionicons name="add" size={28} color={theme.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={openCamera}
          activeOpacity={0.7}
          disabled={uploading || atCap}>
          <Ionicons name="camera-outline" size={20} color={theme.text} />
          <Text style={styles.actionText}>Take a photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={openGallery}
          activeOpacity={0.7}
          disabled={uploading || atCap}>
          <Ionicons name="images-outline" size={20} color={theme.text} />
          <Text style={styles.actionText}>Choose from library</Text>
        </TouchableOpacity>

        {photos.length > 0 ? (
          <TouchableOpacity
            style={styles.removeAllRow}
            onPress={handleRemoveAll}
            activeOpacity={0.7}
            disabled={uploading}>
            <Text style={styles.removeAllText}>Remove all photos</Text>
          </TouchableOpacity>
        ) : null}

        {uploading ? (
          <View style={styles.uploadingRow}>
            <ActivityIndicator color={theme.accent} size="small" />
            <Text style={styles.uploadingText}>Uploading…</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Done</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
  },
);

export default GemPhotoPickerSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 20,
      paddingBottom: 32,
    },
    title: {
      fontSize: 18,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 16,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    previewLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
      letterSpacing: 0.5,
    },
    capIndicator: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textTertiary,
      fontFamily: 'SpaceMono-Regular',
    },
    previewRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
      paddingBottom: 4,
    },
    thumbnail: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: 12,
      backgroundColor: theme.bgTertiary,
    },
    addTile: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.background,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    actionText: {
      fontSize: 15,
      color: theme.text,
    },
    removeAllRow: {
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    removeAllText: {
      fontSize: 15,
      fontWeight: '600',
      color: DELETE_RED,
    },
    uploadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 8,
    },
    uploadingText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    cancelButton: {
      marginTop: 8,
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textSecondary,
    },
  });

export { THUMB_SIZE };
