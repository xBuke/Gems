import { requireAuth } from '@/lib/authGuard';
import { BEST_TIME_OPTIONS } from '@/lib/bestTimes';
import { CATEGORIES, TAGS } from '@/lib/categories';
import {
  canAddToCustomCategory,
  fetchVisibleCustomCategories,
  type CustomCategory,
} from '@/lib/customCategories';
import { AchievementUnlockModal } from '@/components/AchievementUnlockModal';
import { PressableScale } from '@/components/PressableScale';
import { checkAndUnlockAchievements } from '@/lib/gamification';
import { checkIsLocalPick } from '@/lib/localBadge';
import { canAddGem, canUseCategory } from '@/lib/paywall';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { getDistance } from '@/lib/distance';
import { hapticError, hapticLight, hapticSuccess } from '@/lib/haptics';
import { compressImage } from '@/lib/imageCompress';
import { addStreakBonus } from '@/lib/streak';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
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
import { SafeAreaView } from 'react-native-safe-area-context';

type Category = (typeof CATEGORIES)[number];

type LocationChoice = 'here' | 'else';

const uploadImage = async (uri: string) => {
  const fileName = `gem_${Date.now()}.jpg`;

  const formData = new FormData();
  formData.append('file', {
    uri: uri,
    name: fileName,
    type: 'image/jpeg',
  } as any);

  const { error } = await supabase.storage
    .from('gem-images')
    .upload(fileName, formData, {
      contentType: 'multipart/form-data',
    });

  if (error) {
    console.error('Upload error:', error);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage.from('gem-images').getPublicUrl(fileName);

  return publicUrl;
};

export default function AddGemScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { lat, lng, communityId } = useLocalSearchParams<{ lat?: string; lng?: string; communityId?: string }>();
  const parsedLat = lat ? parseFloat(lat) : NaN;
  const parsedLng = lng ? parseFloat(lng) : NaN;
  const hasMapLocation =
    lat != null &&
    lng != null &&
    !Number.isNaN(parsedLat) &&
    !Number.isNaN(parsedLng);

  const [imageUri, setImageUri] = useState<string | null>(null);
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
  const [submitting, setSubmitting] = useState(false);
  const [communityName, setCommunityName] = useState<string | null>(null);
  const [unlockedBadge, setUnlockedBadge] = useState<string | null>(null);
  const [pendingSuccessRoute, setPendingSuccessRoute] = useState<string | null>(null);

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

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      hapticLight();
      setImageUri(result.assets[0].uri);
    }
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery access is required to choose a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      hapticLight();
      setImageUri(result.assets[0].uri);
    }
  };

  const handleImagePress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            openCamera();
          } else if (buttonIndex === 2) {
            openGallery();
          }
        },
      );
    } else {
      Alert.alert('Add Photo', 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: openCamera },
        { text: 'Choose from Gallery', onPress: openGallery },
      ]);
    }
  };

  const checkIfFirstInArea = async (lat: number, lng: number): Promise<boolean> => {
    const { data: nearbyGems } = await supabase
      .from('gems')
      .select('id, latitude, longitude')
      .eq('is_private', false);

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

    const compressedUri = imageUri ? await compressImage(imageUri) : null;

    const imageUrl = compressedUri ? await uploadImage(compressedUri) : null;

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
          image_url: imageUrl,
          verified,
          is_local_pick: isLocal,
          is_first_in_area: isFirstInArea,
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
          image_url: imageUrl,
          verified,
          is_local_pick: isLocal,
          is_first_in_area: isFirstInArea,
          ...communityField,
        };

    const { error } = await supabase.from('gems').insert(gemPayload);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    hapticSuccess();
    await addStreakBonus(user.id, 10);

    const newAchievements = await checkAndUnlockAchievements(user.id);
    const successRoute = communityId ? '/community/' + communityId : '/map';

    if (newAchievements.length > 0) {
      setUnlockedBadge(newAchievements[0]);
      setPendingSuccessRoute(successRoute);
      Alert.alert('Gem dropped! 🎉');
    } else {
      Alert.alert('Gem dropped! 🎉', undefined, [{ text: 'OK', onPress: () => router.replace(successRoute) }]);
    }
  };

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

  const locationStatusText =
    locationDetected && latitude != null && longitude != null
      ? locationFromMap
        ? `Location set from map · ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        : `Using your current location · ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
      : 'Location not detected yet';

  const showForm = hasMapLocation || locationChoice === 'here';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Drop a Gem</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

        {!hasMapLocation && (
          <View style={styles.locationRow}>
            <TouchableOpacity
              style={[styles.locationCard, locationChoice === 'here' && styles.locationCardSelected]}
              onPress={handleSelectHere}
              activeOpacity={0.8}>
              <Ionicons name="locate" size={22} color={theme.accent} style={styles.locationCardIcon} />
              <Text style={styles.locationCardTitle}>I'm here now</Text>
              <Text style={styles.locationCardSubtitle}>Use my GPS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.locationCard, locationChoice === 'else' && styles.locationCardSelected]}
              onPress={handleSelectElse}
              activeOpacity={0.8}>
              <Ionicons
                name="map-outline"
                size={22}
                color={theme.textSecondary}
                style={styles.locationCardIcon}
              />
              <Text style={styles.locationCardTitle}>Pick on map</Text>
              <Text style={styles.locationCardSubtitle}>Choose location</Text>
            </TouchableOpacity>
          </View>
        )}

        {showForm && (
          <>
            <TouchableOpacity style={styles.imagePicker} onPress={handleImagePress} activeOpacity={0.8}>
              {imageUri ? (
                <>
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.selectedImage}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                  <TouchableOpacity
                    style={styles.imageEditButton}
                    onPress={handleImagePress}
                    activeOpacity={0.8}>
                    <Ionicons name="camera" size={16} color={theme.text} />
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera" size={40} color={theme.accent} />
                  <Text style={styles.imagePlaceholderTitle}>Add a photo</Text>
                  <Text style={styles.imagePlaceholderSubtitle}>
                    Tap to choose from library or camera
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.formSection}>
              <Text style={styles.fieldLabel}>Gem name</Text>
              <TextInput
                style={styles.input}
                placeholder="Give your gem a name..."
                placeholderTextColor={theme.textTertiary}
                value={name}
                onChangeText={setName}
                maxLength={60}
              />

              <Text style={styles.fieldLabel}>What makes this place special?</Text>
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

              <Text style={styles.fieldLabel}>Category</Text>
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
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <AchievementUnlockModal
        visible={!!unlockedBadge}
        badgeType={unlockedBadge}
        onClose={() => {
          setUnlockedBadge(null);
          if (pendingSuccessRoute) {
            router.replace(pendingSuccessRoute);
            setPendingSuccessRoute(null);
          }
        }}
      />
    </SafeAreaView>
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  communityBannerText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  locationRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  locationCard: {
    flex: 1,
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
  },
  locationCardSelected: {
    borderColor: theme.accent,
  },
  locationCardIcon: {
    marginBottom: 6,
  },
  locationCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  locationCardSubtitle: {
    fontSize: 11,
    color: theme.textTertiary,
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
  formSection: {
    marginHorizontal: 16,
  },
  fieldLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 14,
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
    backgroundColor: theme.accentSubtle,
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
    paddingHorizontal: 14,
  },
  subcategoryPillSelected: {
    backgroundColor: theme.accentSubtle,
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
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tagPillSelected: {
    backgroundColor: theme.accentSubtle,
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
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  bestTimePillSelected: {
    backgroundColor: theme.accentSubtle,
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
});
