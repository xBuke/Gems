import { requireAuth } from '@/lib/authGuard';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { getDistance } from '@/lib/distance';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACCENT_MUTED = '#A8D5BA';

const CATEGORIES = ['Beach', 'Graffiti', 'Viewpoint', 'Food', 'Skate', 'Nature'] as const;

const CATEGORY_CONFIG: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  Beach: { icon: 'water', color: '#185FA5' },
  Graffiti: { icon: 'color-palette', color: '#D85A30' },
  Viewpoint: { icon: 'eye', color: '#BA7517' },
  Food: { icon: 'restaurant', color: '#1D9E75' },
  Skate: { icon: 'bicycle', color: '#534AB7' },
  Nature: { icon: 'leaf', color: '#27500A' },
};

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
    console.log('Upload error:', error);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage.from('gem-images').getPublicUrl(fileName);

  return publicUrl;
};

export default function AddGemScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { lat, lng } = useLocalSearchParams<{ lat?: string; lng?: string }>();
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
  const [selectedCategory, setSelectedCategory] = useState<string>('Beach');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationDetected, setLocationDetected] = useState(false);
  const [locationFromMap, setLocationFromMap] = useState(false);
  const [locationChoice, setLocationChoice] = useState<LocationChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hasMapLocation) {
      setLatitude(parsedLat);
      setLongitude(parsedLng);
      setLocationDetected(true);
      setLocationFromMap(true);
    }
  }, [hasMapLocation, parsedLat, parsedLng]);

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
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
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
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
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

  const insertGem = async (verified: boolean) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      Alert.alert('Error', userError?.message ?? 'You must be logged in to drop a gem.');
      return;
    }

    const imageUrl = imageUri ? await uploadImage(imageUri) : null;

    const { error } = await supabase.from('gems').insert({
      title: name.trim(),
      description: description.trim(),
      category: selectedCategory,
      latitude,
      longitude,
      user_id: user.id,
      image_url: imageUrl,
      verified,
    });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Gem dropped! 🎉', undefined, [{ text: 'OK', onPress: () => router.replace('/map') }]);
  };

  const handleSubmit = async () => {
    const proceed = await requireAuth();
    if (!proceed) return;

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a gem name.');
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
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
                  <Image source={{ uri: imageUri }} style={styles.selectedImage} resizeMode="cover" />
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
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((category) => {
                  const isSelected = selectedCategory === category;
                  const config = CATEGORY_CONFIG[category];
                  return (
                    <View key={category} style={styles.categoryItemWrap}>
                      <TouchableOpacity
                        style={[styles.categoryItem, isSelected && styles.categoryItemSelected]}
                        onPress={() => setSelectedCategory(category)}
                        activeOpacity={0.7}>
                        <Ionicons name={config.icon} size={22} color={config.color} />
                        <Text style={styles.categoryName}>{category}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.locationStatus}>
              <Ionicons name="location" size={16} color={theme.accent} />
              <Text style={styles.locationStatusText}>{locationStatusText}</Text>
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}>
              {submitting ? (
                <ActivityIndicator color={theme.text} />
              ) : (
                <Text style={styles.submitButtonText}>Drop this Gem</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
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
    width: '33.333%',
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
  },
  categoryItemSelected: {
    backgroundColor: theme.accentSubtle,
    borderColor: theme.accent,
  },
  categoryName: {
    color: theme.text,
    fontSize: 12,
    marginTop: 4,
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
    color: ACCENT_MUTED,
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
