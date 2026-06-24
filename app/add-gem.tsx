import { requireAuth } from '@/lib/authGuard';
import { BEST_TIME_OPTIONS } from '@/lib/bestTimes';
import { CATEGORIES, TAGS } from '@/lib/categories';
import {
  canAddToCustomCategory,
  fetchVisibleCustomCategories,
  type CustomCategory,
} from '@/lib/customCategories';
import { AchievementUnlockModal } from '@/components/AchievementUnlockModal';
import { AppBottomSheetModal, type AppBottomSheetModalRef } from '@/components/AppBottomSheetModal';
import { ModalEntryWrapper } from '@/components/ModalEntryWrapper';
import { PressableScale } from '@/components/PressableScale';
import { checkAndUnlockAchievements } from '@/lib/gamification';
import { checkIsLocalPick } from '@/lib/localBadge';
import { canAddGem, canUseCategory } from '@/lib/paywall';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { formatLatitude } from '@/lib/coordinates';
import { getDistance } from '@/lib/distance';
import { resolveCityName } from '@/lib/reverseGeocode';
import { hapticError, hapticLight, hapticSuccess } from '@/lib/haptics';
import GemPhotoPickerSheet, {
  THUMB_SIZE,
  type GemPhotoPickerSheetRef,
} from '@/components/GemPhotoPickerSheet';
import { createGemSharePost } from '@/lib/communityPosts';
import { deleteGem } from '@/lib/deleteGem';
import {
  fetchGemPhotos,
  MAX_GEM_PHOTOS_PER_CONTRIBUTOR,
  uploadAndInsertGemPhotos,
  type LocalGemPhoto,
} from '@/lib/gemPhotos';
import type { GemVisibility } from '@/lib/gemVisibility';
import { BottomSheetModalProvider, BottomSheetView } from '@gorhom/bottom-sheet';
import { addStreakBonus } from '@/lib/streak';
import { useToast } from '@/lib/ToastContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Category = (typeof CATEGORIES)[number];

const HEADER_HEIGHT = 48;
const STEP_INDICATOR_HEIGHT = 21;

type LocationChoice = 'here' | 'else';

const VISIBILITY_OPTIONS: { value: GemVisibility; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'friends', label: 'Friends' },
  { value: 'private', label: 'Private' },
];

const DELETE_RED = '#F87171';

export default function AddGemScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { lat, lng, communityId, gemId: gemIdParam } = useLocalSearchParams<{
    lat?: string;
    lng?: string;
    communityId?: string;
    gemId?: string;
  }>();
  const editGemId = Array.isArray(gemIdParam) ? gemIdParam[0] : gemIdParam;
  const isEditMode = !!editGemId;
  const parsedLat = lat ? parseFloat(lat) : NaN;
  const parsedLng = lng ? parseFloat(lng) : NaN;
  const hasMapLocation =
    lat != null &&
    lng != null &&
    !Number.isNaN(parsedLat) &&
    !Number.isNaN(parsedLng);

  const [ownerPhotos, setOwnerPhotos] = useState<LocalGemPhoto[]>([]);
  const [photoPickerVisible, setPhotoPickerVisible] = useState(false);
  const photoPickerSheetRef = useRef<GemPhotoPickerSheetRef>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMainCategory, setSelectedMainCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedCustomCategory, setSelectedCustomCategory] = useState<CustomCategory | null>(null);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedBestTime, setSelectedBestTime] = useState('');
  const [customBestTime, setCustomBestTime] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationDetected, setLocationDetected] = useState(false);
  const [locationFromMap, setLocationFromMap] = useState(false);
  const [locationChoice, setLocationChoice] = useState<LocationChoice | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [communityName, setCommunityName] = useState<string | null>(null);
  const [unlockedBadge, setUnlockedBadge] = useState<string | null>(null);
  const [unlockCoords, setUnlockCoords] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [pendingSuccessRoute, setPendingSuccessRoute] = useState<string | null>(null);
  const [loadingGem, setLoadingGem] = useState(isEditMode);
  const [visibility, setVisibility] = useState<GemVisibility>('public');
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteSheetRef = useRef<AppBottomSheetModalRef>(null);

  useEffect(() => {
    if (!isEditMode || !editGemId) return;

    const loadGem = async () => {
      setLoadingGem(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoadingGem(false);
        Alert.alert('Error', 'You must be logged in to edit a gem.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      const { data: gem, error } = await supabase
        .from('gems')
        .select('*')
        .eq('id', editGemId)
        .single();

      if (error || !gem) {
        setLoadingGem(false);
        Alert.alert('Error', 'Could not load this gem.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      if (gem.user_id !== user.id) {
        setLoadingGem(false);
        Alert.alert('Error', 'You can only edit your own gems.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      setUserId(user.id);
      setName(gem.title ?? '');
      setDescription(gem.description ?? '');
      setLatitude(gem.latitude);
      setLongitude(gem.longitude);
      setLocationDetected(true);
      setVisibility((gem.visibility as GemVisibility) ?? 'public');

      const gemPhotos = await fetchGemPhotos(editGemId);
      setOwnerPhotos(
        gemPhotos
          .filter((photo) => photo.contributor_id === user.id)
          .map((photo) => ({
            id: photo.id,
            uri: photo.photo_url,
            photoUrl: photo.photo_url,
            isUploaded: true,
          })),
      );

      const tags = (gem.tags as string[] | null) ?? [];
      setSelectedTags(tags);

      const bestTime = gem.best_time ?? '';
      if (bestTime && BEST_TIME_OPTIONS.includes(bestTime)) {
        setSelectedBestTime(bestTime);
        setCustomBestTime('');
      } else if (bestTime) {
        setSelectedBestTime('');
        setCustomBestTime(bestTime);
      }

      if (gem.custom_category_id) {
        const categories = await fetchVisibleCustomCategories(user.id);
        setCustomCategories(categories);
        const match = categories.find((c) => c.id === gem.custom_category_id);
        if (match) {
          setSelectedCustomCategory(match);
        }
      } else if (gem.category) {
        const main = CATEGORIES.find((c) => c.id === gem.category);
        if (main) {
          setSelectedMainCategory(main);
          setSelectedSubcategory(gem.subcategory ?? null);
        }
        const categories = await fetchVisibleCustomCategories(user.id);
        setCustomCategories(categories);
      } else {
        const categories = await fetchVisibleCustomCategories(user.id);
        setCustomCategories(categories);
      }

      setLoadingGem(false);
    };

    loadGem();
  }, [editGemId, isEditMode, router]);

  useEffect(() => {
    if (hasMapLocation) {
      setLatitude(parsedLat);
      setLongitude(parsedLng);
      setLocationDetected(true);
      setLocationFromMap(true);
    }
  }, [hasMapLocation, parsedLat, parsedLng]);

  useEffect(() => {
    const loadCustomCategories = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const categories = await fetchVisibleCustomCategories(user.id);
      setCustomCategories(categories);
    };
    loadCustomCategories();
  }, []);

  useEffect(() => {
    if (latitude == null || longitude == null) {
      setCityName(null);
      return;
    }

    let cancelled = false;
    resolveCityName(latitude, longitude).then((name) => {
      if (!cancelled) setCityName(name);
    });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  useEffect(() => {
    if (!communityId) return;
    const loadCommunity = async () => {
      const { data } = await supabase
        .from('communities')
        .select('name')
        .eq('id', communityId)
        .single();
      if (data?.name) setCommunityName(data.name);
    };
    loadCommunity();
  }, [communityId]);

  const detectCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    setLatitude(location.coords.latitude);
    setLongitude(location.coords.longitude);
    setLocationDetected(true);
    setLocationFromMap(false);
  };

  const handleSelectHere = async () => {
    setLocationChoice('here');
    await detectCurrentLocation();
  };

  const handleSelectElse = () => {
    setLocationChoice('else');
    router.push({ pathname: '/map', params: { placeMode: 'true' } });
  };

  const checkIfFirstInArea = async (lat: number, lng: number): Promise<boolean> => {
    const { data: nearbyGems } = await supabase
      .from('gems')
      .select('id, latitude, longitude')
      .eq('visibility', 'public');

    if (!nearbyGems || nearbyGems.length === 0) return true;

    const isNearby = nearbyGems.some((gem: { latitude: number; longitude: number }) => {
      const distance = getDistance(lat, lng, gem.latitude, gem.longitude);
      return distance < 5000;
    });

    return !isNearby;
  };

  const insertGem = async (verified: boolean) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      Alert.alert('Error', userError?.message ?? 'You must be logged in to drop a gem.');
      return;
    }

    const pendingPhotoUris = ownerPhotos
      .filter((photo) => !photo.isUploaded)
      .map((photo) => photo.uri);

    const firstExistingUrl =
      ownerPhotos.find((photo) => photo.photoUrl)?.photoUrl ??
      ownerPhotos.find((photo) => photo.isUploaded)?.uri ??
      null;

    const finalLatitude = latitude!;
    const finalLongitude = longitude!;
    const isLocal = await checkIsLocalPick(user.id, finalLatitude, finalLongitude);
    const isFirstInArea = await checkIfFirstInArea(finalLatitude, finalLongitude);

    const communityField = communityId ? { community_id: communityId } : {};
    const bestTime = customBestTime.trim() || selectedBestTime || null;

    const gemPayload = selectedCustomCategory
      ? {
          title: name.trim(),
          description: description.trim(),
          custom_category_id: selectedCustomCategory.id,
          tags: selectedTags.length > 0 ? selectedTags : null,
          best_time: bestTime,
          latitude: finalLatitude,
          longitude: finalLongitude,
          user_id: user.id,
          image_url: firstExistingUrl,
          verified,
          is_local_pick: isLocal,
          is_first_in_area: isFirstInArea,
          city_name: cityName,
          ...communityField,
        }
      : {
          title: name.trim(),
          description: description.trim(),
          category: selectedMainCategory!.id,
          subcategory: selectedSubcategory,
          tags: selectedTags.length > 0 ? selectedTags : null,
          best_time: bestTime,
          latitude: finalLatitude,
          longitude: finalLongitude,
          user_id: user.id,
          image_url: firstExistingUrl,
          verified,
          is_local_pick: isLocal,
          is_first_in_area: isFirstInArea,
          city_name: cityName,
          ...communityField,
        };

    const { data: newGem, error } = await supabase
      .from('gems')
      .insert(gemPayload)
      .select('id')
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    if (newGem?.id && pendingPhotoUris.length > 0) {
      const { photoUrls, error: photoError } = await uploadAndInsertGemPhotos(
        newGem.id,
        user.id,
        pendingPhotoUris,
      );

      if (photoError) {
        hapticError();
        showToast({
          type: 'error',
          title: 'Photos not saved',
          message: photoError,
        });
      } else if (photoUrls.length > 0 && !firstExistingUrl) {
        await supabase
          .from('gems')
          .update({ image_url: photoUrls[0] })
          .eq('id', newGem.id);
      }
    }

    if (communityId && newGem?.id) {
      const { error: postError } = await createGemSharePost(communityId, user.id, newGem.id);
      if (postError) {
        Alert.alert('Gem added', 'Your gem was created but could not be posted to the feed. Try again from the community.');
      }
    }

    hapticSuccess();
    await addStreakBonus(user.id, 10);

    const newAchievements = await checkAndUnlockAchievements(user.id);
    const successRoute = communityId ? '/community/' + communityId : '/map';

    if (newAchievements.length > 0) {
      setUnlockedBadge(newAchievements[0]);
      setUnlockCoords({ latitude: finalLatitude, longitude: finalLongitude });
      setPendingSuccessRoute(successRoute);
      Alert.alert('Gem dropped! 🎉');
    } else {
      Alert.alert('Gem dropped! 🎉', undefined, [{ text: 'OK', onPress: () => router.replace(successRoute) }]);
    }
  };

  const updateGem = async () => {
    if (!editGemId) return;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      Alert.alert('Error', userError?.message ?? 'You must be logged in.');
      return;
    }

    const bestTime = customBestTime.trim() || selectedBestTime || null;
    const coverImageUrl =
      ownerPhotos.find((photo) => photo.photoUrl)?.photoUrl ??
      ownerPhotos[0]?.uri ??
      null;

    const basePayload = {
      title: name.trim(),
      description: description.trim(),
      tags: selectedTags.length > 0 ? selectedTags : null,
      best_time: bestTime,
      image_url: coverImageUrl,
      visibility,
    };

    const gemPayload = selectedCustomCategory
      ? {
          ...basePayload,
          custom_category_id: selectedCustomCategory.id,
          category: null,
          subcategory: null,
        }
      : {
          ...basePayload,
          category: selectedMainCategory!.id,
          subcategory: selectedSubcategory,
          custom_category_id: null,
        };

    const { error } = await supabase.from('gems').update(gemPayload).eq('id', editGemId);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    hapticSuccess();
    router.back();
  };

  const handleSaveEdit = async () => {
    const proceed = await requireAuth();
    if (!proceed) return;

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a gem name.');
      return;
    }

    if (!selectedCustomCategory && !selectedMainCategory) {
      Alert.alert('Error', 'Please select a category.');
      return;
    }

    if (!selectedCustomCategory && !selectedSubcategory) {
      Alert.alert('Error', 'Please select a subcategory.');
      return;
    }

    setSubmitting(true);
    try {
      await updateGem();
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = useCallback(async () => {
    if (!editGemId) return;

    setDeleting(true);
    const { error } = await deleteGem(editGemId, null);
    setDeleting(false);
    setDeleteSheetVisible(false);
    deleteSheetRef.current?.dismiss();

    if (error) {
      Alert.alert('Error', error);
      return;
    }

    hapticSuccess();
    router.replace('/');
  }, [editGemId, router]);

  useEffect(() => {
    if (deleteSheetVisible) {
      deleteSheetRef.current?.present();
      return;
    }
    deleteSheetRef.current?.dismiss();
  }, [deleteSheetVisible]);

  const handleCategorySelect = async (category: Category) => {
    if (category.premium) {
      const allowed = await canUseCategory(category.id);
      if (!allowed) {
        Alert.alert('This is a Premium category', undefined, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go Premium', onPress: () => router.push('/paywall') },
        ]);
        return;
      }
    }
    setSelectedMainCategory(category);
    setSelectedSubcategory(null);
    setSelectedCustomCategory(null);
  };

  const handleCustomCategorySelect = async (category: CustomCategory) => {
    if (!userId) return;

    const allowed = await canAddToCustomCategory(category, userId);
    if (!allowed) {
      Alert.alert('This category is for Premium members', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go Premium', onPress: () => router.push('/paywall') },
      ]);
      return;
    }

    setSelectedCustomCategory(category);
    setSelectedMainCategory(null);
    setSelectedSubcategory(null);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSubmit = async () => {
    if (isEditMode) return;

    const proceed = await requireAuth();
    if (!proceed) return;

    const { allowed, reason } = await canAddGem();
    if (!allowed) {
      Alert.alert('Upgrade to Premium', reason, [
        { text: 'Maybe later', style: 'cancel' },
        { text: 'Go Premium', onPress: () => router.push('/paywall') },
      ]);
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a gem name.');
      return;
    }

    if (!selectedCustomCategory && !selectedMainCategory) {
      Alert.alert('Error', 'Please select a category.');
      return;
    }

    if (!selectedCustomCategory && !selectedSubcategory) {
      Alert.alert('Error', 'Please select a subcategory.');
      return;
    }

    if (latitude == null || longitude == null) {
      Alert.alert('Error', 'Location not detected. Please enable location services.');
      return;
    }

    setSubmitting(true);
    try {
      const location = await Location.getCurrentPositionAsync({});
      const distance = getDistance(
        location.coords.latitude,
        location.coords.longitude,
        latitude,
        longitude,
      );

      if (distance > 500) {
        hapticError();
        Alert.alert('You seem far from this location. Pin here anyway?', undefined, [
          { text: 'No', style: 'cancel' },
          { text: 'Yes', onPress: () => insertGem(false) },
        ]);
      } else {
        await insertGem(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const locationCoordsLabel =
    latitude != null && longitude != null
      ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
      : null;

  const locationStatusText =
    locationDetected && locationCoordsLabel
      ? cityName
        ? locationFromMap
          ? `Location set from map · ${cityName}`
          : `Using your current location · ${cityName}`
        : locationFromMap
          ? `Location set from map · ${locationCoordsLabel}`
          : `Using your current location · ${locationCoordsLabel}`
      : 'Location not detected yet';

  const showForm = isEditMode || hasMapLocation || locationChoice === 'here';

  const addGemStep = !showForm ? 1 : selectedMainCategory || selectedCustomCategory ? 3 : 2;
  const addGemStepLabels = ['LOCATION', 'DETAILS', 'CATEGORY'] as const;

  const atPhotoCap = ownerPhotos.length >= MAX_GEM_PHOTOS_PER_CONTRIBUTOR;

  const openPhotoPicker = useCallback(() => {
    setPhotoPickerVisible(true);
  }, []);

  const closePhotoPicker = useCallback(() => {
    setPhotoPickerVisible(false);
  }, []);

  useEffect(() => {
    if (photoPickerVisible) {
      photoPickerSheetRef.current?.present();
      return;
    }
    photoPickerSheetRef.current?.dismiss();
  }, [photoPickerVisible]);

  const refreshOwnerPhotos = useCallback(async () => {
    if (!editGemId || !userId) return;
    const gemPhotos = await fetchGemPhotos(editGemId);
    setOwnerPhotos(
      gemPhotos
        .filter((photo) => photo.contributor_id === userId)
        .map((photo) => ({
          id: photo.id,
          uri: photo.photo_url,
          photoUrl: photo.photo_url,
          isUploaded: true,
        })),
    );
  }, [editGemId, userId]);

  if (isEditMode && loadingGem) {
    return (
      <ModalEntryWrapper>
        <BottomSheetModalProvider>
          <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.accent} size="large" />
            </View>
          </SafeAreaView>
        </BottomSheetModalProvider>
      </ModalEntryWrapper>
    );
  }

  return (
    <ModalEntryWrapper>
    <BottomSheetModalProvider>
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {isEditMode ? (
          <>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerAction}>
              <Text style={styles.headerActionText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Gem</Text>
            <TouchableOpacity
              onPress={handleSaveEdit}
              activeOpacity={0.7}
              style={styles.headerAction}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={theme.accent} size="small" />
              ) : (
                <Text style={[styles.headerActionText, styles.headerSaveText]}>Save</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Drop a Gem</Text>
            <View style={styles.headerSpacer} />
          </>
        )}
      </View>

      {!isEditMode && (
      <View style={styles.stepIndicatorWrap}>
        <Text style={styles.stepIndicator}>
          STEP {addGemStep} OF 3 — {addGemStepLabels[addGemStep - 1]}
        </Text>
      </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={
          Platform.OS === 'ios' ? insets.top + HEADER_HEIGHT + STEP_INDICATOR_HEIGHT : 0
        }
        style={{ flex: 1 }}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {communityName && (
          <View style={styles.communityBanner}>
            <Ionicons name="people" size={16} color="#FFFFFF" />
            <Text style={styles.communityBannerText}>Posting to {communityName}</Text>
          </View>
        )}

        {!hasMapLocation && !isEditMode && (
          <View style={styles.locationRow}>
            <TouchableOpacity
              style={[
                styles.locationCard,
                locationChoice === 'here' && styles.locationCardSelected,
                locationChoice === 'here' && styles.locationCardSelectedFill,
              ]}
              onPress={handleSelectHere}
              activeOpacity={0.8}>
              <View
                style={[
                  styles.locationCardIconCircle,
                  locationChoice === 'here' && styles.locationCardIconCircleSelected,
                ]}>
                <Ionicons
                  name="locate"
                  size={16}
                  color={locationChoice === 'here' ? theme.accentText : theme.accent}
                />
              </View>
              <Text
                style={[
                  styles.locationCardTitle,
                  locationChoice === 'here' && styles.locationCardTitleSelected,
                ]}>
                I'm here now
              </Text>
              {locationChoice === 'here' && locationDetected && latitude != null ? (
                <Text style={styles.locationCardCoordsPreview}>{formatLatitude(latitude)}</Text>
              ) : (
                <Text style={styles.locationCardSubtitle}>Use my GPS</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.locationCard,
                locationChoice === 'else' && styles.locationCardSelected,
                locationChoice === 'else' && styles.locationCardSelectedFill,
              ]}
              onPress={handleSelectElse}
              activeOpacity={0.8}>
              <View
                style={[
                  styles.locationCardIconCircle,
                  locationChoice === 'else' && styles.locationCardIconCircleSelected,
                ]}>
                <Ionicons
                  name="map-outline"
                  size={16}
                  color={locationChoice === 'else' ? theme.accentText : theme.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.locationCardTitle,
                  locationChoice === 'else' && styles.locationCardTitleSelected,
                ]}>
                Pick on map
              </Text>
              <Text style={styles.locationCardSubtitle}>Choose location</Text>
            </TouchableOpacity>
          </View>
        )}

        {showForm && (
          <>
            <View style={styles.photoSection}>
              <View style={styles.photoSectionHeader}>
                <Text style={styles.journalFieldLabel}>PHOTOS</Text>
                {atPhotoCap ? <Text style={styles.photoCapIndicator}>5/5</Text> : null}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoPreviewRow}>
                {ownerPhotos.map((photo) => (
                  <Image
                    key={photo.id}
                    source={{ uri: photo.uri }}
                    style={styles.photoThumbnail}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="memory-disk"
                  />
                ))}
                {!atPhotoCap ? (
                  <TouchableOpacity
                    style={styles.photoAddTile}
                    onPress={openPhotoPicker}
                    activeOpacity={0.8}>
                    <Ionicons name="add" size={28} color={theme.textTertiary} />
                  </TouchableOpacity>
                ) : null}
              </ScrollView>
              {ownerPhotos.length === 0 ? (
                <TouchableOpacity
                  style={styles.photoEmptyPrompt}
                  onPress={openPhotoPicker}
                  activeOpacity={0.8}>
                  <Ionicons name="camera" size={32} color={theme.accent} />
                  <Text style={styles.photoEmptyTitle}>Add photos</Text>
                  <Text style={styles.photoEmptySubtitle}>
                    Show other explorers what makes this gem special
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.photoManageLink}
                  onPress={openPhotoPicker}
                  activeOpacity={0.7}>
                  <Ionicons name="images-outline" size={16} color={theme.accent} />
                  <Text style={styles.photoManageText}>Manage photos</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.formSection}>
              <Text style={styles.journalFieldLabel}>GEM NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Give your gem a name..."
                placeholderTextColor={theme.textTertiary}
                value={name}
                onChangeText={setName}
                maxLength={60}
              />

              <Text style={styles.journalFieldLabel}>WHAT MAKES IT SPECIAL?</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Share what makes this spot worth visiting..."
                placeholderTextColor={theme.textTertiary}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
                maxLength={500}
              />

              <Text style={styles.journalFieldLabel}>CATEGORY</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((category) => {
                  const isSelected = selectedMainCategory?.id === category.id;
                  return (
                    <View key={category.id} style={styles.categoryItemWrap}>
                      <TouchableOpacity
                        style={[styles.categoryItem, isSelected && styles.categoryItemSelected]}
                        onPress={() => handleCategorySelect(category)}
                        activeOpacity={0.7}>
                        <Ionicons
                          name={category.icon as keyof typeof Ionicons.glyphMap}
                          size={22}
                          color={category.color}
                        />
                        <Text style={styles.categoryName}>{category.name}</Text>
                        {category.premium && (
                          <View style={styles.proBadge}>
                            <Ionicons name="diamond" size={10} color="#FFD700" />
                            <Text style={styles.proBadgeText}>PRO</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              {customCategories.length > 0 && (
                <>
                  <Text style={styles.fieldLabel}>Custom Categories</Text>
                  <View style={styles.categoryGrid}>
                    {customCategories.map((category) => {
                      const isSelected = selectedCustomCategory?.id === category.id;
                      return (
                        <View key={category.id} style={styles.categoryItemWrap}>
                          <TouchableOpacity
                            style={[styles.categoryItem, isSelected && styles.categoryItemSelected]}
                            onPress={() => handleCustomCategorySelect(category)}
                            activeOpacity={0.7}>
                            <Ionicons
                              name={category.icon as keyof typeof Ionicons.glyphMap}
                              size={22}
                              color={category.color}
                            />
                            <Text style={styles.categoryName}>{category.name}</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}

              {selectedMainCategory && (
                <>
                  <Text style={styles.fieldLabel}>Subcategory</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.subcategoryScroll}
                    contentContainerStyle={styles.subcategoryRow}>
                    {selectedMainCategory.subcategories.map((sub) => {
                      const isSelected = selectedSubcategory === sub;
                      return (
                        <TouchableOpacity
                          key={sub}
                          style={[styles.subcategoryPill, isSelected && styles.subcategoryPillSelected]}
                          onPress={() => setSelectedSubcategory(sub)}
                          activeOpacity={0.7}>
                          <Text
                            style={[
                              styles.subcategoryPillText,
                              isSelected && styles.subcategoryPillTextSelected,
                            ]}>
                            {sub}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              <Text style={styles.fieldLabel}>Tags (optional)</Text>
              <View style={styles.tagsGrid}>
                {TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tagPill, isSelected && styles.tagPillSelected]}
                      onPress={() => toggleTag(tag)}
                      activeOpacity={0.7}>
                      <Text style={[styles.tagPillText, isSelected && styles.tagPillTextSelected]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Best time to visit (optional)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.bestTimeScroll}
                contentContainerStyle={styles.bestTimeRow}>
                {BEST_TIME_OPTIONS.map((option) => {
                  const isSelected = selectedBestTime === option && !customBestTime.trim();
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.bestTimePill, isSelected && styles.bestTimePillSelected]}
                      onPress={() => {
                        setSelectedBestTime(option);
                        setCustomBestTime('');
                      }}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.bestTimePillText,
                          isSelected && styles.bestTimePillTextSelected,
                        ]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TextInput
                style={styles.input}
                placeholder="Or type your own (e.g. 'after rain')"
                placeholderTextColor={theme.textTertiary}
                value={customBestTime}
                onChangeText={setCustomBestTime}
              />
            </View>

            <View style={styles.locationStatus}>
              <Ionicons name="location" size={16} color={theme.accent} />
              <Text style={styles.locationStatusText}>{locationStatusText}</Text>
            </View>

            {isEditMode && (
              <View style={styles.formSection}>
                <Text style={styles.journalFieldLabel}>VISIBILITY</Text>
                <View style={styles.visibilitySegment}>
                  {VISIBILITY_OPTIONS.map((option) => {
                    const isActive = visibility === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.visibilitySegmentItem, isActive && styles.visibilitySegmentItemActive]}
                        onPress={() => setVisibility(option.value)}
                        activeOpacity={0.8}>
                        <Text
                          style={[
                            styles.visibilitySegmentText,
                            isActive && styles.visibilitySegmentTextActive,
                          ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {!isEditMode && (
            <PressableScale
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={theme.text} />
              ) : (
                <Text style={styles.submitButtonText}>Drop this Gem</Text>
              )}
            </PressableScale>
            )}

            {isEditMode && (
              <>
                <View style={styles.editDivider} />
                <TouchableOpacity
                  style={styles.deleteGemRow}
                  onPress={() => setDeleteSheetVisible(true)}
                  activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={18} color={DELETE_RED} />
                  <Text style={styles.deleteGemText}>Delete this gem</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <AchievementUnlockModal
        visible={!!unlockedBadge}
        badgeType={unlockedBadge}
        latitude={unlockCoords?.latitude}
        longitude={unlockCoords?.longitude}
        onClose={() => {
          setUnlockedBadge(null);
          setUnlockCoords(null);
          if (pendingSuccessRoute) {
            router.replace(pendingSuccessRoute);
            setPendingSuccessRoute(null);
          }
        }}
      />

      {userId ? (
        <GemPhotoPickerSheet
          ref={photoPickerSheetRef}
          visible={photoPickerVisible}
          onClose={closePhotoPicker}
          gemId={isEditMode ? editGemId : null}
          contributorId={userId}
          photos={ownerPhotos}
          onPhotosChange={setOwnerPhotos}
          onPersistedPhotosChange={() => {
            if (isEditMode) {
              refreshOwnerPhotos();
            }
          }}
        />
      ) : null}

      {isEditMode && (
        <AppBottomSheetModal
          ref={deleteSheetRef}
          visible={deleteSheetVisible}
          onClose={() => setDeleteSheetVisible(false)}
          snapPoints={['32%']}>
          <BottomSheetView style={styles.deleteSheetContent}>
            <Text style={styles.deleteSheetTitle}>Delete this gem?</Text>
            <Text style={styles.deleteSheetMessage}>This cannot be undone.</Text>
            <TouchableOpacity
              style={styles.deleteSheetConfirm}
              onPress={handleConfirmDelete}
              disabled={deleting}
              activeOpacity={0.85}>
              {deleting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteSheetConfirmText}>Delete</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteSheetCancel}
              onPress={() => setDeleteSheetVisible(false)}
              activeOpacity={0.7}>
              <Text style={styles.deleteSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </BottomSheetView>
        </AppBottomSheetModal>
      )}
    </SafeAreaView>
    </BottomSheetModalProvider>
    </ModalEntryWrapper>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 22,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
  },
  headerSpacer: {
    width: 22,
  },
  headerAction: {
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  headerSaveText: {
    color: theme.accent,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicatorWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  stepIndicator: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    letterSpacing: 2,
    color: theme.accent,
    textTransform: 'uppercase',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  communityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.coral,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  communityBannerText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  locationRow: {
    flexDirection: 'column',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  locationCard: {
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 16,
  },
  locationCardSelected: {
    borderColor: theme.accent,
    borderWidth: 1.5,
  },
  locationCardSelectedFill: {
    backgroundColor: theme.accentSub,
  },
  locationCardIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  locationCardIconCircleSelected: {
    backgroundColor: theme.accent,
  },
  locationCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  locationCardTitleSelected: {
    color: theme.accent,
  },
  locationCardSubtitle: {
    fontSize: 11,
    color: theme.textTertiary,
  },
  locationCardCoordsPreview: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: theme.accent,
    opacity: 0.7,
  },
  photoSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  photoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  photoCapIndicator: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textTertiary,
    fontFamily: 'SpaceMono-Regular',
  },
  photoPreviewRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  photoThumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 12,
    backgroundColor: theme.bgTertiary,
  },
  photoAddTile: {
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
  photoEmptyPrompt: {
    height: 160,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderStyle: 'dashed',
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  photoEmptyTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.text,
    marginTop: 8,
  },
  photoEmptySubtitle: {
    fontSize: 12,
    color: theme.textTertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  photoManageLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  photoManageText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent,
  },
  imagePicker: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: theme.card,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderStyle: 'dashed',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.text,
    marginTop: 8,
  },
  imagePlaceholderSubtitle: {
    fontSize: 12,
    color: theme.textTertiary,
    marginTop: 4,
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  imageEditButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replacePhotoPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  replacePhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  formSection: {
    marginHorizontal: 16,
  },
  journalFieldLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    letterSpacing: 1.5,
    color: theme.accent,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldLabel: {
    fontFamily: 'SpaceMono-Regular',
    color: theme.textTertiary,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    fontSize: 15,
    color: theme.text,
  },
  textArea: {
    height: 100,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 16,
  },
  categoryItemWrap: {
    width: '50%',
    padding: 4,
  },
  categoryItem: {
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  categoryItemSelected: {
    backgroundColor: theme.accentSub,
    borderColor: theme.accent,
  },
  categoryName: {
    color: theme.text,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  proBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  proBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '700',
  },
  subcategoryScroll: {
    marginBottom: 16,
  },
  subcategoryRow: {
    gap: 8,
    paddingRight: 4,
  },
  subcategoryPill: {
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  subcategoryPillSelected: {
    backgroundColor: theme.accentSub,
    borderColor: theme.accent,
  },
  subcategoryPillText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '500',
  },
  subcategoryPillTextSelected: {
    color: theme.accent,
    fontWeight: '600',
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tagPill: {
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tagPillSelected: {
    backgroundColor: theme.accentSub,
    borderColor: theme.accent,
  },
  tagPillText: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '500',
  },
  tagPillTextSelected: {
    color: theme.accent,
  },
  bestTimeScroll: {
    marginBottom: 8,
  },
  bestTimeRow: {
    gap: 8,
    paddingRight: 4,
  },
  bestTimePill: {
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  bestTimePillSelected: {
    backgroundColor: theme.accentSub,
    borderColor: theme.accent,
  },
  bestTimePillText: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '500',
  },
  bestTimePillTextSelected: {
    color: theme.accent,
    fontWeight: '600',
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  locationStatusText: {
    flex: 1,
    color: theme.textSecondary,
    fontSize: 13,
  },
  submitButton: {
    marginHorizontal: 16,
    backgroundColor: theme.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  visibilitySegment: {
    flexDirection: 'row',
    backgroundColor: theme.bgTertiary,
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  visibilitySegmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  visibilitySegmentItemActive: {
    backgroundColor: theme.accent,
  },
  visibilitySegmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  visibilitySegmentTextActive: {
    color: theme.accentText,
  },
  editDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  deleteGemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginBottom: 16,
  },
  deleteGemText: {
    fontSize: 15,
    fontWeight: '600',
    color: DELETE_RED,
  },
  deleteSheetContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  deleteSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteSheetMessage: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  deleteSheetConfirm: {
    alignSelf: 'stretch',
    backgroundColor: DELETE_RED,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  deleteSheetConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteSheetCancel: {
    alignSelf: 'stretch',
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteSheetCancelText: {
    fontSize: 15,
    color: theme.textSecondary,
  },
});
