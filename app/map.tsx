import { requireAuth } from '@/lib/authGuard';
import { CATEGORIES } from '@/lib/categories';
import { checkIsPremium } from '@/lib/paywall';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { MapType, Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const getCategoryColor = (category: string) => {
  const match = CATEGORIES.find((c) => c.id === category);
  return match?.color ?? '#1D9E75';
};

type Category = (typeof CATEGORIES)[number];

type Gem = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  category: string;
  subcategory?: string | null;
};

type TapLocation = {
  latitude: number;
  longitude: number;
};

export default function MapScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const overlay = isDark ? 'rgba(13, 13, 13, 0.85)' : 'rgba(255, 255, 255, 0.9)';
  const styles = useMemo(() => createStyles(theme, overlay), [theme, overlay]);
  const { placeMode } = useLocalSearchParams<{ placeMode?: string }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [mapTypeIndex, setMapTypeIndex] = useState(1);
  const [gems, setGems] = useState<Gem[]>([]);
  const [activeMainCategory, setActiveMainCategory] = useState<Category | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
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

  const handleCategoryPress = async (cat: Category) => {
    if (cat.premium) {
      const isPremium = await checkIsPremium();
      if (!isPremium) {
        router.push('/paywall');
        return;
      }
    }
    if (activeMainCategory?.id === cat.id) {
      setActiveMainCategory(null);
      setActiveSubcategory(null);
    } else {
      setActiveMainCategory(cat);
      setActiveSubcategory(null);
    }
  };

  const currentMapType = MAP_TYPES[mapTypeIndex];

  const visibleGems = gems.filter((gem) => {
    if (activeMainCategory && gem.category !== activeMainCategory.id) return false;
    if (activeSubcategory && gem.subcategory !== activeSubcategory) return false;
    return true;
  });

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
            <Ionicons name="location" size={48} color={theme.accent} />
          </Marker>
        )}
      </MapView>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
        <Ionicons name="arrow-back" size={20} color={theme.text} />
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

      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 8 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          <TouchableOpacity
            style={{
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 20,
              marginRight: 10,
              backgroundColor: activeMainCategory === null ? '#1D9E75' : 'rgba(255,255,255,0.15)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.4)',
            }}
            onPress={() => {
              setActiveMainCategory(null);
              setActiveSubcategory(null);
            }}>
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: '600',
              }}>
              All
            </Text>
          </TouchableOpacity>

          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 20,
                marginRight: 10,
                backgroundColor:
                  activeMainCategory?.id === cat.id ? cat.color : 'rgba(255,255,255,0.15)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.4)',
              }}
              onPress={() => handleCategoryPress(cat)}
              activeOpacity={0.7}>
              <Ionicons name={cat.icon as any} size={14} color="#FFFFFF" aria-hidden={true} />
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: '600',
                }}>
                {cat.name}
                {cat.premium ? ' 💎' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {activeMainCategory && (
          <View style={{ marginBottom: 4 }}>
            <Text
              style={{
                color: theme.textSecondary,
                fontSize: 12,
                marginBottom: 6,
                marginLeft: 16,
              }}>
              Filter by:
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ paddingLeft: 16 }}>
              {activeMainCategory.subcategories.map((sub) => (
                <TouchableOpacity
                  key={sub}
                  style={{
                    backgroundColor:
                      activeSubcategory === sub
                        ? activeMainCategory.color
                        : 'rgba(255,255,255,0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.4)',
                    borderRadius: 20,
                    paddingHorizontal: 18,
                    paddingVertical: 10,
                    marginRight: 10,
                  }}
                  onPress={() => setActiveSubcategory(activeSubcategory === sub ? null : sub)}
                  activeOpacity={0.7}>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 14,
                      fontWeight: '600',
                    }}>
                    {sub}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.myLocationButton} onPress={handleMyLocation} activeOpacity={0.8}>
        <Ionicons name="locate" size={22} color={theme.accent} />
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

const createStyles = (theme: Theme, overlay: string) =>
  StyleSheet.create({
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
      backgroundColor: overlay,
      borderWidth: 0.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    layerButton: {
      position: 'absolute',
      top: 50,
      right: 16,
      backgroundColor: overlay,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    layerButtonText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.text,
    },
    filterContainer: {
      position: 'absolute',
      top: 100,
      left: 0,
      right: 0,
    },
    placeButton: {
      position: 'absolute',
      top: 50,
      right: 130,
      backgroundColor: overlay,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    placeButtonText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.text,
    },
    marker: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: theme.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markerText: {
      color: theme.text,
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
      backgroundColor: overlay,
      borderWidth: 0.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionSheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.card,
      borderTopWidth: 0.5,
      borderTopColor: theme.border,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
    },
    actionSheetTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 6,
    },
  actionSheetLocation: {
    color: theme.textSecondary,
    fontSize: 13,
    fontFamily: 'SpaceMono-Regular',
    marginBottom: 16,
  },
    actionSheetButtons: {
      flexDirection: 'row',
      gap: 10,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: theme.backgroundTertiary,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
    addButton: {
      flex: 1,
      backgroundColor: theme.accent,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    addButtonText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: '600',
    },
  });
