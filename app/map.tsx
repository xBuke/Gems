import { requireAuth } from '@/lib/authGuard';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { MapType, Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = {
  bg: '#0D0D0D',
  card: '#141414',
  accent: '#1D9E75',
  text: '#FFFFFF',
  textLight: '#F5F5F5',
  textMuted: '#888888',
  border: '#222222',
  overlay: 'rgba(13, 13, 13, 0.85)',
  cancelBg: '#1A1A1A',
};

const MAP_TYPES: { type: MapType; label: string }[] = [
  { type: 'standard', label: 'Street' },
  { type: 'satellite', label: 'Satellite' },
  { type: 'hybrid', label: 'Hybrid' },
];

const INITIAL_REGION = {
  latitude: 44.5,
  longitude: 16.4,
  latitudeDelta: 3,
  longitudeDelta: 3,
};

const CATEGORY_COLORS: Record<string, string> = {
  Beach: '#185FA5',
  Graffiti: '#D85A30',
  Viewpoint: '#BA7517',
  Food: '#1D9E75',
  Skate: '#534AB7',
  Nature: '#27500A',
};

const getCategoryColor = (category: string) => CATEGORY_COLORS[category] ?? '#1D9E75';

const CATEGORIES = ['All', 'Beach', 'Graffiti', 'Viewpoint', 'Food', 'Skate', 'Nature'] as const;

type Gem = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  category: string;
};

type TapLocation = {
  latitude: number;
  longitude: number;
};

export default function MapScreen() {
  const router = useRouter();
  const { placeMode } = useLocalSearchParams<{ placeMode?: string }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [mapTypeIndex, setMapTypeIndex] = useState(1);
  const [gems, setGems] = useState<Gem[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [placingMode, setPlacingMode] = useState(false);
  const [tapLocation, setTapLocation] = useState<TapLocation | null>(null);
  const [tapLocationName, setTapLocationName] = useState<string | null>(null);

  useEffect(() => {
    if (placeMode === 'true') {
      setPlacingMode(true);
    }
  }, [placeMode]);

  useEffect(() => {
    const fetchGems = async () => {
      const { data } = await supabase.from('gems').select('*').eq('is_private', false);
      if (data) setGems(data);
    };
    fetchGems();
  }, []);

  useEffect(() => {
    Location.requestForegroundPermissionsAsync();
  }, []);

  useEffect(() => {
    if (!tapLocation) {
      setTapLocationName(null);
      return;
    }

    const fetchLocationName = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${tapLocation.latitude}&lon=${tapLocation.longitude}&format=json`,
        );
        const data = await response.json();
        const name =
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          data.address?.county ||
          null;
        setTapLocationName(name);
      } catch {
        setTapLocationName(null);
      }
    };

    fetchLocationName();
  }, [tapLocation]);

  const currentMapType = MAP_TYPES[mapTypeIndex];

  const visibleGems =
    activeCategory === 'All' ? gems : gems.filter((g) => g.category === activeCategory);

  const cycleMapType = () => {
    setMapTypeIndex((prev) => (prev + 1) % MAP_TYPES.length);
  };

  const handleAddGemHere = async () => {
    if (!tapLocation) return;

    const proceed = await requireAuth();
    if (!proceed) return;

    router.push({
      pathname: '/add-gem',
      params: { lat: tapLocation.latitude, lng: tapLocation.longitude },
    });
    setTapLocation(null);
    setPlacingMode(false);
  };

  const togglePlacingMode = () => {
    if (placingMode) {
      setPlacingMode(false);
      setTapLocation(null);
    } else {
      setPlacingMode(true);
    }
  };

  const handleMyLocation = async () => {
    const location = await Location.getCurrentPositionAsync({});
    mapRef.current?.animateToRegion(
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      1000,
    );
  };

  const tapLocationLabel =
    tapLocationName ??
    (tapLocation
      ? `${tapLocation.latitude.toFixed(4)}, ${tapLocation.longitude.toFixed(4)}`
      : '');

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        mapType={currentMapType.type}
        showsUserLocation
        showsMyLocationButton={false}
        followsUserLocation={false}
        onPress={
          placingMode ? (e) => setTapLocation(e.nativeEvent.coordinate) : undefined
        }>
        {visibleGems.map((gem) => (
          <Marker
            key={gem.id}
            coordinate={{ latitude: gem.latitude, longitude: gem.longitude }}
            onPress={() => router.push('/gem/' + gem.id)}>
            <View
              style={[styles.marker, { backgroundColor: getCategoryColor(gem.category) }]}>
              <Text style={styles.markerText}>{gem.category.charAt(0)}</Text>
            </View>
          </Marker>
        ))}
        {tapLocation && (
          <Marker coordinate={tapLocation}>
            <Ionicons name="location" size={48} color={COLORS.accent} />
          </Marker>
        )}
      </MapView>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
        <Ionicons name="arrow-back" size={20} color={COLORS.text} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.placeButton}
        onPress={togglePlacingMode}
        activeOpacity={0.8}>
        <Text style={styles.placeButtonText}>
          {placingMode ? 'Cancel' : 'Place Gem'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.layerButton} onPress={cycleMapType} activeOpacity={0.8}>
        <Text style={styles.layerButtonText}>{currentMapType.label}</Text>
      </TouchableOpacity>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryBar}
        contentContainerStyle={styles.categoryRow}>
        {CATEGORIES.map((category) => {
          const isActive = activeCategory === category;
          return (
            <TouchableOpacity
              key={category}
              style={[styles.categoryPill, isActive && styles.categoryPillActive]}
              onPress={() => setActiveCategory(category)}
              activeOpacity={0.7}>
              <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                {category}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.myLocationButton} onPress={handleMyLocation} activeOpacity={0.8}>
        <Ionicons name="locate" size={22} color={COLORS.accent} />
      </TouchableOpacity>

      {tapLocation && (
        <View style={[styles.actionSheet, { paddingBottom: 20 + insets.bottom }]}>
          <Text style={styles.actionSheetTitle}>Drop a gem here?</Text>
          <Text style={styles.actionSheetLocation}>{tapLocationLabel}</Text>
          <View style={styles.actionSheetButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setTapLocation(null)}
              activeOpacity={0.8}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={handleAddGemHere} activeOpacity={0.8}>
              <Text style={styles.addButtonText}>Add Gem Here</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.overlay,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layerButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: COLORS.overlay,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  layerButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  placeButton: {
    position: 'absolute',
    top: 50,
    right: 130,
    backgroundColor: COLORS.overlay,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  placeButtonActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  placeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  placeButtonTextActive: {
    color: COLORS.bg,
  },
  categoryBar: {
    position: 'absolute',
    top: 105,
    left: 0,
    right: 0,
  },
  categoryRow: {
    paddingHorizontal: 16,
  },
  categoryPill: {
    backgroundColor: COLORS.overlay,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textLight,
  },
  categoryTextActive: {
    fontWeight: '600',
    color: COLORS.bg,
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 40,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.overlay,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  actionSheetTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  actionSheetLocation: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 16,
  },
  actionSheetButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.cancelBg,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonText: {
    color: COLORS.bg,
    fontSize: 14,
    fontWeight: '600',
  },
});
