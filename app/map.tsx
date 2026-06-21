import { requireAuth } from '@/lib/authGuard';
import { CATEGORIES } from '@/lib/categories';
import { fetchVisibleCustomCategories, type CustomCategory } from '@/lib/customCategories';
import { getDistance } from '@/lib/distance';
import {
  applyCommunityGemFilter,
  fetchMyCommunityIds,
  GEM_SELECT_MAP,
} from '@/lib/gemVisibility';
import { checkIsPremium } from '@/lib/paywall';
import { hapticLight, hapticSelection } from '@/lib/haptics';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { MapType, Marker, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const getCategoryColor = (category: string, accentFallback: string) => {
  const match = CATEGORIES.find((c) => c.id === category);
  return match?.color ?? accentFallback;
};

const formatDistanceKm = (meters: number) => {
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
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

type Category = (typeof CATEGORIES)[number];

type Gem = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  category: string;
  subcategory?: string | null;
  custom_category_id?: string | null;
  image_url?: string | null;
  verified?: boolean;
};

type TapLocation = {
  latitude: number;
  longitude: number;
};

export default function MapScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const overlay = isDark ? 'rgba(13, 13, 13, 0.85)' : 'rgba(255, 255, 255, 0.9)';
  const chipUnselectedBg = `${theme.card}E6`;
  const styles = useMemo(() => createStyles(theme, overlay), [theme, overlay]);
  const { placeMode } = useLocalSearchParams<{ placeMode?: string }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const regionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedRegionRef = useRef<Region | null>(null);
  const snapPoints = useMemo(() => ['25%', '60%'], []);
  const [mapTypeIndex, setMapTypeIndex] = useState(1);
  const [gems, setGems] = useState<Gem[]>([]);
  const [gemsLoading, setGemsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedGem, setSelectedGem] = useState<Gem | null>(null);
  const [selectedLikeCount, setSelectedLikeCount] = useState(0);
  const [selectedCommentCount, setSelectedCommentCount] = useState(0);
  const [selectedLocationName, setSelectedLocationName] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [activeMainCategory, setActiveMainCategory] = useState<Category | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [activeCustomCategory, setActiveCustomCategory] = useState<CustomCategory | null>(null);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [placingMode, setPlacingMode] = useState(false);
  const [tapLocation, setTapLocation] = useState<TapLocation | null>(null);
  const [tapLocationName, setTapLocationName] = useState<string | null>(null);
  const [showMyLocation, setShowMyLocation] = useState(true);
  const hasShownLocationHiddenAlert = useRef(false);

  useEffect(() => {
    if (placeMode === 'true') {
      setPlacingMode(true);
    }
  }, [placeMode]);

  const fetchVisibleGems = useCallback(async (region: Region) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const myCommunityIds = await fetchMyCommunityIds(user?.id ?? null);

      const latDelta = region.latitudeDelta;
      const lngDelta = region.longitudeDelta;

      let query = supabase
        .from('gems')
        .select(GEM_SELECT_MAP)
        .eq('is_private', false)
        .gte('latitude', region.latitude - latDelta)
        .lte('latitude', region.latitude + latDelta)
        .gte('longitude', region.longitude - lngDelta)
        .lte('longitude', region.longitude + lngDelta)
        .limit(200);

      query = applyCommunityGemFilter(query, myCommunityIds);

      const { data, error } = await query;

      if (error) {
        setMapError('Could not load gems for this area.');
        return;
      }

      setMapError(null);
      if (data) {
        setGems(data);
        lastFetchedRegionRef.current = region;
      }
    } catch {
      setMapError('Could not load gems for this area.');
    } finally {
      setGemsLoading(false);
    }
  }, []);

  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      if (regionDebounceRef.current) {
        clearTimeout(regionDebounceRef.current);
      }

      regionDebounceRef.current = setTimeout(() => {
        const last = lastFetchedRegionRef.current;
        if (last) {
          const latMoved =
            Math.abs(region.latitude - last.latitude) > last.latitudeDelta * 0.3;
          const lngMoved =
            Math.abs(region.longitude - last.longitude) > last.longitudeDelta * 0.3;
          const zoomChanged =
            Math.abs(region.latitudeDelta - last.latitudeDelta) > last.latitudeDelta * 0.2;
          if (!latMoved && !lngMoved && !zoomChanged) return;
        }
        fetchVisibleGems(region);
      }, 500);
    },
    [fetchVisibleGems],
  );

  useEffect(() => {
    fetchVisibleGems(INITIAL_REGION);

    const loadCustomCategories = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const categories = await fetchVisibleCustomCategories(user.id);
      setCustomCategories(categories);
    };
    loadCustomCategories();

    return () => {
      if (regionDebounceRef.current) {
        clearTimeout(regionDebounceRef.current);
      }
    };
  }, [fetchVisibleGems]);

  useFocusEffect(
    useCallback(() => {
      const region = lastFetchedRegionRef.current ?? INITIAL_REGION;
      fetchVisibleGems(region);
    }, [fetchVisibleGems]),
  );

  useEffect(() => {
    const initLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      try {
        const location = await Location.getCurrentPositionAsync({});
        setUserCoords({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch {
        // Location unavailable — distance won't be shown
      }
    };

    initLocation();
  }, []);

  useEffect(() => {
    if (placingMode || tapLocation) {
      bottomSheetRef.current?.close();
      setSelectedGem(null);
    }
  }, [placingMode, tapLocation]);

  useEffect(() => {
    if (!selectedGem) {
      setSelectedLikeCount(0);
      setSelectedCommentCount(0);
      setSelectedLocationName(null);
      return;
    }

    const fetchGemPreviewData = async () => {
      const [{ count: likeCount }, { count: commentCount }] = await Promise.all([
        supabase
          .from('gem_likes')
          .select('*', { count: 'exact', head: true })
          .eq('gem_id', selectedGem.id),
        supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('gem_id', selectedGem.id),
      ]);

      setSelectedLikeCount(likeCount ?? 0);
      setSelectedCommentCount(commentCount ?? 0);

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${selectedGem.latitude}&lon=${selectedGem.longitude}&format=json`,
        );
        const data = await response.json();
        const name =
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          data.address?.county ||
          null;
        setSelectedLocationName(name);
      } catch {
        setSelectedLocationName(null);
      }
    };

    fetchGemPreviewData();
  }, [selectedGem]);

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
      setActiveCustomCategory(null);
    }
  };

  const handleCustomCategoryPress = (category: CustomCategory) => {
    if (activeCustomCategory?.id === category.id) {
      setActiveCustomCategory(null);
    } else {
      setActiveCustomCategory(category);
      setActiveMainCategory(null);
      setActiveSubcategory(null);
    }
  };

  const currentMapType = MAP_TYPES[mapTypeIndex];

  const visibleGems = gems.filter((gem) => {
    if (activeCustomCategory) {
      if (gem.custom_category_id !== activeCustomCategory.id) return false;
    } else if (activeMainCategory && gem.category !== activeMainCategory.id) {
      return false;
    }
    if (activeSubcategory && gem.subcategory !== activeSubcategory) return false;
    return true;
  });

  const cycleMapType = () => {
    setMapTypeIndex((prev) => (prev + 1) % MAP_TYPES.length);
  };

  const toggleShowMyLocation = () => {
    setShowMyLocation((prev) => {
      const next = !prev;
      if (!next && !hasShownLocationHiddenAlert.current) {
        hasShownLocationHiddenAlert.current = true;
        Alert.alert(
          'Location hidden',
          'Your location dot is now hidden. Tap again to show it.',
        );
      }
      return next;
    });
  };

  // Center-map button stays enabled when dot is hidden — only you see the map pan.

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
    hapticSelection();
    if (placingMode) {
      setPlacingMode(false);
      setTapLocation(null);
    } else {
      bottomSheetRef.current?.close();
      setSelectedGem(null);
      setPlacingMode(true);
    }
  };

  const openMaps = (gem: Gem) => {
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${gem.latitude},${gem.longitude}&q=${encodeURIComponent(gem.title)}`,
      android: `https://www.google.com/maps/dir/?api=1&destination=${gem.latitude},${gem.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${gem.latitude},${gem.longitude}`,
    });

    if (url) Linking.openURL(url);
  };

  const handleMapPress = useCallback(
    (e: { nativeEvent: { coordinate: TapLocation } }) => {
      if (placingMode) {
        setTapLocation(e.nativeEvent.coordinate);
        return;
      }

      bottomSheetRef.current?.close();
      setSelectedGem(null);
    },
    [placingMode],
  );

  const handleMarkerPress = (gem: Gem, e: { stopPropagation?: () => void }) => {
    hapticLight();
    if (placingMode || tapLocation) return;

    e.stopPropagation?.();
    setSelectedGem(gem);
    bottomSheetRef.current?.snapToIndex(0);
  };

  const selectedGemDistance =
    selectedGem && userCoords
      ? formatDistanceKm(
          getDistance(
            userCoords.latitude,
            userCoords.longitude,
            selectedGem.latitude,
            selectedGem.longitude,
          ),
        )
      : null;

  const selectedGemLocationLabel = selectedGem
    ? [
        selectedLocationName ??
          `${selectedGem.latitude.toFixed(4)}, ${selectedGem.longitude.toFixed(4)}`,
        selectedGemDistance,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

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
        showsUserLocation={showMyLocation}
        showsMyLocationButton={false}
        followsUserLocation={false}
        onPress={handleMapPress}
        onRegionChangeComplete={handleRegionChangeComplete}>
        {visibleGems.map((gem) => (
          <Marker
            key={gem.id}
            coordinate={{ latitude: gem.latitude, longitude: gem.longitude }}
            onPress={(e) => handleMarkerPress(gem, e)}
            stopPropagation>
            <View
              style={[styles.marker, { backgroundColor: getCategoryColor(gem.category, theme.accent) }]}>
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

      <TouchableOpacity
        style={styles.locationDotToggle}
        onPress={toggleShowMyLocation}
        activeOpacity={0.8}>
        <Ionicons
          name={showMyLocation ? 'locate' : 'locate-outline'}
          size={20}
          color={showMyLocation ? theme.accent : theme.textTertiary}
          style={showMyLocation ? undefined : { opacity: 0.55 }}
        />
      </TouchableOpacity>

      {gemsLoading && (
        <View style={{ position: 'absolute', top: 110, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ backgroundColor: theme.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color={theme.accent} />
            <Text style={{ color: theme.text, fontSize: 12 }}>Loading gems...</Text>
          </View>
        </View>
      )}

      {mapError && (
        <View style={styles.mapErrorBanner}>
          <Ionicons name="alert-circle-outline" size={14} color={theme.danger} />
          <Text style={styles.mapErrorText} numberOfLines={1}>
            {mapError}
          </Text>
          <TouchableOpacity
            onPress={() => fetchVisibleGems(lastFetchedRegionRef.current ?? INITIAL_REGION)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.mapErrorRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

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
              backgroundColor:
                activeMainCategory === null && activeCustomCategory === null
                  ? theme.accent
                  : chipUnselectedBg,
              borderWidth: 1,
              borderColor: theme.border,
            }}
            onPress={() => {
              setActiveMainCategory(null);
              setActiveSubcategory(null);
              setActiveCustomCategory(null);
            }}>
            <Text
              style={{
                color:
                  activeMainCategory === null && activeCustomCategory === null
                    ? theme.accentText
                    : theme.text,
                fontSize: 14,
                fontWeight: '600',
              }}>
              All
            </Text>
          </TouchableOpacity>

          {CATEGORIES.map((cat) => {
            const isSelected = activeMainCategory?.id === cat.id;
            const chipTextColor = isSelected ? '#FFFFFF' : theme.text;
            return (
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
                  backgroundColor: isSelected ? cat.color : chipUnselectedBg,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
                onPress={() => handleCategoryPress(cat)}
                activeOpacity={0.7}>
                <Ionicons name={cat.icon as any} size={14} color={chipTextColor} aria-hidden={true} />
                <Text
                  style={{
                    color: chipTextColor,
                    fontSize: 14,
                    fontWeight: '600',
                  }}>
                  {cat.name}
                  {cat.premium ? ' 💎' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}

          {customCategories.map((cat) => {
            const isSelected = activeCustomCategory?.id === cat.id;
            const chipTextColor = isSelected ? '#FFFFFF' : theme.text;
            return (
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
                  backgroundColor: isSelected ? cat.color : chipUnselectedBg,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
                onPress={() => handleCustomCategoryPress(cat)}
                activeOpacity={0.7}>
                <Ionicons name={cat.icon as any} size={14} color={chipTextColor} aria-hidden={true} />
                <Text
                  style={{
                    color: chipTextColor,
                    fontSize: 14,
                    fontWeight: '600',
                  }}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activeMainCategory && !activeCustomCategory && (
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
              {activeMainCategory.subcategories.map((sub) => {
                const isSelected = activeSubcategory === sub;
                return (
                  <TouchableOpacity
                    key={sub}
                    style={{
                      backgroundColor: isSelected ? activeMainCategory.color : chipUnselectedBg,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 20,
                      paddingHorizontal: 18,
                      paddingVertical: 10,
                      marginRight: 10,
                    }}
                    onPress={() => setActiveSubcategory(activeSubcategory === sub ? null : sub)}
                    activeOpacity={0.7}>
                    <Text
                      style={{
                        color: isSelected ? '#FFFFFF' : theme.text,
                        fontSize: 14,
                        fontWeight: '600',
                      }}>
                      {sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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

      {!placingMode && !tapLocation && (
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          onClose={() => setSelectedGem(null)}
          backgroundStyle={{ backgroundColor: theme.card }}
          handleIndicatorStyle={{ backgroundColor: theme.border }}>
          <BottomSheetView style={styles.bottomSheetContent}>
            {selectedGem && (
              <>
                {selectedGem.image_url ? (
                  <Image
                    source={{ uri: selectedGem.image_url }}
                    style={styles.sheetImage}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={styles.sheetImagePlaceholder}>
                    <Ionicons name="location-outline" size={40} color={theme.accent} />
                  </View>
                )}

                <Text style={styles.sheetTitle}>{selectedGem.title}</Text>

                <View style={styles.sheetBadgeRow}>
                  <View style={styles.sheetCategoryBadge}>
                    <Text style={styles.sheetCategoryBadgeText}>{selectedGem.category}</Text>
                  </View>
                  {selectedGem.verified && (
                    <View style={styles.sheetVerifiedBadge}>
                      <Ionicons name="checkmark-circle" size={12} color={theme.coral} />
                      <Text style={styles.sheetVerifiedBadgeText}>Verified</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.sheetLocation}>{selectedGemLocationLabel}</Text>

                <View style={styles.sheetStatsRow}>
                  <View style={styles.sheetStat}>
                    <Ionicons name="heart" size={14} color={theme.textSecondary} />
                    <Text style={styles.sheetStatText}>{selectedLikeCount}</Text>
                  </View>
                  <View style={styles.sheetStat}>
                    <Ionicons name="chatbubble-outline" size={14} color={theme.textSecondary} />
                    <Text style={styles.sheetStatText}>{selectedCommentCount}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.viewDetailsButton}
                  onPress={() => router.push('/gem/' + selectedGem.id)}
                  activeOpacity={0.8}>
                  <Text style={styles.viewDetailsButtonText}>View Full Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.navigateButton}
                  onPress={() => openMaps(selectedGem)}
                  activeOpacity={0.8}>
                  <Ionicons name="navigate" size={16} color={theme.accent} />
                  <Text style={styles.navigateButtonText}>Navigate</Text>
                </TouchableOpacity>
              </>
            )}
          </BottomSheetView>
        </BottomSheet>
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
      width: 44,
      height: 44,
      borderRadius: 22,
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
      minHeight: 44,
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    layerButtonText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.text,
    },
    locationDotToggle: {
      position: 'absolute',
      top: 96,
      right: 16,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
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
      minHeight: 44,
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    placeButtonText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.text,
    },
    mapErrorBanner: {
      position: 'absolute',
      top: 110,
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.card,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 0.5,
      borderColor: theme.danger,
    },
    mapErrorText: {
      flex: 1,
      fontSize: 12,
      color: theme.text,
    },
    mapErrorRetry: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.accent,
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
    bottomSheetContent: {
      flex: 1,
      padding: 16,
    },
    sheetImage: {
      width: '100%',
      height: 140,
      borderRadius: 12,
      marginBottom: 12,
    },
    sheetImagePlaceholder: {
      width: '100%',
      height: 140,
      borderRadius: 12,
      marginBottom: 12,
      backgroundColor: theme.backgroundTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 18,
      color: theme.text,
      marginBottom: 10,
    },
    sheetBadgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
    },
    sheetCategoryBadge: {
      backgroundColor: theme.accentSubtle,
      borderWidth: 0.5,
      borderColor: theme.accent,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 20,
    },
    sheetCategoryBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.accent,
    },
    sheetVerifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.coralSubtle,
      borderWidth: 0.5,
      borderColor: theme.coral,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    sheetVerifiedBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.coral,
    },
    sheetLocation: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 12,
    },
    sheetStatsRow: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 16,
    },
    sheetStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sheetStatText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    viewDetailsButton: {
      backgroundColor: theme.accent,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 10,
    },
    viewDetailsButtonText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: '600',
    },
    navigateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.accent,
      borderRadius: 10,
      paddingVertical: 14,
    },
    navigateButtonText: {
      color: theme.accent,
      fontSize: 14,
      fontWeight: '600',
    },
  });
