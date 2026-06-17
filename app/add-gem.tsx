import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
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

const COLORS = {
  bg: '#0D0D0D',
  card: '#141414',
  accent: '#1D9E75',
  accentSubtle: '#0F3D25',
  text: '#F5F5F5',
  textMuted: '#888888',
  border: '#222222',
};

const CATEGORIES = ['Beach', 'Graffiti', 'Viewpoint', 'Food', 'Skate', 'Nature'] as const;

const uploadImage = async (uri: string) => {
  const fileName = `gem_${Date.now()}.jpg`;

  const formData = new FormData();
  formData.append('file', {
    uri: uri,
    name: fileName,
    type: 'image/jpeg',
  } as any);

  const { data, error } = await supabase.storage
    .from('gem-images')
    .upload(fileName, formData, {
      contentType: 'multipart/form-data',
    });

  if (error) {
    console.log('Upload error:', error);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('gem-images')
    .getPublicUrl(fileName);

  return publicUrl;
};

export default function AddGemScreen() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Beach');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationDetected, setLocationDetected] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);
      setLocationDetected(true);
    })();
  }, []);

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

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a gem name.');
      return;
    }

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
    });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Gem dropped! 🎉', undefined, [{ text: 'OK', onPress: () => router.back() }]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add a Gem</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.imagePicker} onPress={handleImagePress} activeOpacity={0.8}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.selectedImage} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="camera" size={36} color={COLORS.textMuted} />
              <Text style={styles.imagePlaceholderText}>Tap to add photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Give your gem a name..."
          placeholderTextColor={COLORS.textMuted}
          value={name}
          onChangeText={setName}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What makes this place special?"
          placeholderTextColor={COLORS.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}>
          {CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category;
            return (
              <TouchableOpacity
                key={category}
                style={[styles.categoryPill, isSelected && styles.categoryPillSelected]}
                onPress={() => setSelectedCategory(category)}
                activeOpacity={0.7}>
                <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.label}>Location</Text>
        {locationDetected && (
          <Text style={styles.locationText}>📍 Using your current location</Text>
        )}

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} activeOpacity={0.8}>
          <Text style={styles.submitButtonText}>Drop this Gem 📍</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  imagePicker: {
    height: 200,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 12,
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  textArea: {
    height: 80,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  categoryRow: {
    gap: 8,
    marginBottom: 20,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSubtle,
  },
  categoryPillSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.accent,
  },
  categoryTextSelected: {
    color: COLORS.bg,
    fontWeight: '600',
  },
  locationText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.bg,
  },
});
