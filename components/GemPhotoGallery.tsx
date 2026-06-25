import FullScreenPhotoViewer from '@/components/FullScreenPhotoViewer';
import GemPhotoPickerSheet, { type GemPhotoPickerSheetRef } from '@/components/GemPhotoPickerSheet';
import { PressableScale } from '@/components/PressableScale';
import {
  getDistinctContributors,
  MAX_GEM_PHOTOS_PER_CONTRIBUTOR,
  sortGemPhotos,
  type GemPhoto,
  type LocalGemPhoto,
} from '@/lib/gemPhotos';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type View as RNView,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type GemPhotoGalleryProps = {
  photos: GemPhoto[];
  gemId: string;
  currentUserId: string | null;
  isOwner: boolean;
  isPremium: boolean;
  fallbackImageUrl?: string | null;
  imageDestRef?: RefObject<RNView | null>;
  heroHidden?: boolean;
  onPhotosUpdated: () => void;
  gemTitle?: string;
  gemCategory?: string;
  gemUsername?: string;
  likeCount?: number;
};

export default function GemPhotoGallery({
  photos,
  gemId,
  currentUserId,
  isOwner,
  isPremium,
  fallbackImageUrl,
  imageDestRef,
  heroHidden,
  onPhotosUpdated,
  gemTitle,
  gemCategory,
  gemUsername,
  likeCount,
}: GemPhotoGalleryProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scrollRef = useRef<ScrollView>(null);

  const [selectedContributorId, setSelectedContributorId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const pickerSheetRef = useRef<GemPhotoPickerSheetRef>(null);

  const openPhotoPicker = useCallback(() => {
    setPickerVisible(true);
    pickerSheetRef.current?.present();
  }, []);

  const closePhotoPicker = useCallback(() => {
    setPickerVisible(false);
    pickerSheetRef.current?.dismiss();
  }, []);

  useEffect(() => {
    if (pickerVisible) {
      pickerSheetRef.current?.present();
      return;
    }
    pickerSheetRef.current?.dismiss();
  }, [pickerVisible]);

  const sortedPhotos = useMemo(() => sortGemPhotos(photos), [photos]);
  const contributors = useMemo(() => getDistinctContributors(sortedPhotos), [sortedPhotos]);
  const showFilterRow = contributors.length >= 2;

  const filteredPhotos = useMemo(() => {
    if (!selectedContributorId) return sortedPhotos;
    return sortedPhotos.filter((photo) => photo.contributor_id === selectedContributorId);
  }, [selectedContributorId, sortedPhotos]);

  const displayUrls = useMemo(() => {
    if (filteredPhotos.length > 0) {
      return filteredPhotos.map((photo) => photo.photo_url);
    }
    if (fallbackImageUrl) return [fallbackImageUrl];
    return [];
  }, [filteredPhotos, fallbackImageUrl]);

  const myPhotoCount = useMemo(() => {
    if (!currentUserId) return 0;
    return sortedPhotos.filter((photo) => photo.contributor_id === currentUserId).length;
  }, [currentUserId, sortedPhotos]);

  const myPhotosAsLocal = useMemo((): LocalGemPhoto[] => {
    if (!currentUserId) return [];
    return sortedPhotos
      .filter((photo) => photo.contributor_id === currentUserId)
      .map((photo) => ({
        id: photo.id,
        uri: photo.photo_url,
        photoUrl: photo.photo_url,
        isUploaded: true,
      }));
  }, [currentUserId, sortedPhotos]);

  const handleContributorFilter = (contributorId: string | null) => {
    setSelectedContributorId(contributorId);
    setActiveIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  };

  const onGalleryScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  }, []);

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const handleAddPhotoPress = () => {
    if (!currentUserId) return;

    if (!isOwner && !isPremium) {
      router.push('/paywall');
      return;
    }

    if (myPhotoCount >= MAX_GEM_PHOTOS_PER_CONTRIBUTOR) return;

    openPhotoPicker();
  };

  const handlePickerPhotosChange = (_nextPhotos: LocalGemPhoto[]) => {
    onPhotosUpdated();
  };

  const showAddPhotoButton = !isOwner && currentUserId != null;
  const atMyCap = myPhotoCount >= MAX_GEM_PHOTOS_PER_CONTRIBUTOR;

  return (
    <View style={styles.wrapper}>
      <View
        ref={imageDestRef}
        collapsable={false}
        style={[styles.heroMeasure, heroHidden && styles.heroHidden]}>
        {displayUrls.length > 0 ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onGalleryScroll}
            scrollEventThrottle={16}>
            {displayUrls.map((url, index) => (
              <TouchableOpacity
                key={`${url}-${index}`}
                activeOpacity={0.95}
                onPress={() => openViewer(index)}
                style={styles.slide}>
                <Image
                  source={{ uri: url }}
                  style={styles.heroImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.heroPlaceholder}>
            <Ionicons name="location-outline" size={64} color={theme.accent} />
          </View>
        )}

        {displayUrls.length > 1 ? (
          <View style={styles.pageDots}>
            {displayUrls.map((_, index) => (
              <View
                key={index}
                style={[styles.pageDot, index === activeIndex && styles.pageDotActive]}
              />
            ))}
          </View>
        ) : null}
      </View>

      {showFilterRow ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterPill, !selectedContributorId && styles.filterPillActive]}
            onPress={() => handleContributorFilter(null)}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.filterPillText,
                !selectedContributorId && styles.filterPillTextActive,
              ]}>
              All
            </Text>
          </TouchableOpacity>
          {contributors.map((contributor) => {
            const isActive = selectedContributorId === contributor.contributorId;
            return (
              <TouchableOpacity
                key={contributor.contributorId}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => handleContributorFilter(contributor.contributorId)}
                activeOpacity={0.7}>
                {contributor.avatarUrl ? (
                  <Image
                    source={{ uri: contributor.avatarUrl }}
                    style={styles.filterAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.filterAvatarPlaceholder}>
                    <Text style={styles.filterAvatarText}>
                      {contributor.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text
                  style={[styles.filterPillText, isActive && styles.filterPillTextActive]}
                  numberOfLines={1}>
                  @{contributor.username}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {showAddPhotoButton ? (
        <View style={styles.addPhotoRow}>
          <PressableScale
            onPress={handleAddPhotoPress}
            disabled={isPremium && atMyCap}
            style={[
              styles.addPhotoButton,
              !isPremium && styles.addPhotoButtonLocked,
              isPremium && atMyCap && styles.addPhotoButtonDisabled,
            ]}>
            <Ionicons
              name="camera-outline"
              size={14}
              color={isPremium ? theme.accent : theme.textTertiary}
            />
            <Text
              style={[
                styles.addPhotoText,
                !isPremium && styles.addPhotoTextLocked,
                isPremium && atMyCap && styles.addPhotoTextDisabled,
              ]}>
              + Add your photo
            </Text>
            {!isPremium ? <Text style={styles.addPhotoGem}>💎</Text> : null}
            {isPremium && atMyCap ? (
              <Text style={styles.addPhotoCap}>5/5</Text>
            ) : null}
          </PressableScale>
        </View>
      ) : null}

      <FullScreenPhotoViewer
        visible={viewerVisible}
        photos={displayUrls}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
        gemId={gemId}
        currentUserId={currentUserId}
        gemTitle={gemTitle}
        gemCategory={gemCategory}
        gemUsername={gemUsername}
        likeCount={likeCount}
      />

      {currentUserId ? (
        <GemPhotoPickerSheet
          ref={pickerSheetRef}
          visible={pickerVisible}
          onClose={closePhotoPicker}
          gemId={gemId}
          contributorId={currentUserId}
          photos={myPhotosAsLocal}
          onPhotosChange={handlePickerPhotosChange}
          onPersistedPhotosChange={() => onPhotosUpdated()}
        />
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      position: 'relative',
    },
    heroMeasure: {
      width: '100%',
      height: 320,
      backgroundColor: theme.bgTertiary,
    },
    heroHidden: {
      opacity: 0,
    },
    slide: {
      width: SCREEN_WIDTH,
      height: 320,
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    heroPlaceholder: {
      flex: 1,
      height: 320,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bgTertiary,
    },
    pageDots: {
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    pageDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.45)',
    },
    pageDotActive: {
      backgroundColor: '#FFFFFF',
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    filterRow: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    filterPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      marginRight: 8,
      maxWidth: 180,
    },
    filterPillActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    filterPillText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
    filterPillTextActive: {
      color: theme.accentText,
    },
    filterAvatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    filterAvatarPlaceholder: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterAvatarText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.accentText,
    },
    addPhotoRow: {
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    addPhotoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    addPhotoButtonLocked: {
      borderColor: theme.border,
      opacity: 0.75,
    },
    addPhotoButtonDisabled: {
      opacity: 0.5,
    },
    addPhotoText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.accent,
    },
    addPhotoTextLocked: {
      color: theme.textTertiary,
    },
    addPhotoTextDisabled: {
      color: theme.textTertiary,
    },
    addPhotoGem: {
      fontSize: 11,
    },
    addPhotoCap: {
      fontSize: 11,
      fontFamily: 'SpaceMono-Regular',
      color: theme.textTertiary,
    },
  });
