import { requireAuth } from '@/lib/authGuard';
import { CATEGORIES } from '@/lib/categories';
import { fetchVisibleCustomCategories, type CustomCategory } from '@/lib/customCategories';
import { formatCoordinates } from '@/lib/coordinates';
import { getDistance } from '@/lib/distance';
import {
  applyCommunityGemFilter,
  fetchMyCommunityIds,
  GEM_SELECT_MAP,
} from '@/lib/gemVisibility';
import { checkIsPremium } from '@/lib/paywall';
import { hapticLight, hapticSelection } from '@/lib/haptics';
import { navigateToGemWithSharedTransition } from '@/lib/gemSharedTransition';
import { goBackOrTab, useTabRootBackHandler, useTabStackGesture } from '@/lib/navigationMotion';
import { useReduceMotion } from '@/lib/ReduceMotionContext';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { BottomSheetHandle } from '@/components/BottomSheetHandle';
import { ClusterMiniPanel } from '@/components/ClusterMiniPanel';
import { MapPin } from '@/components/MapPin';
import {
  pickMostLikedThumbnail,
  resolveGemsFromClusterLeaves,
} from '@/lib/mapClustering';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ClusteredMapView from 'react-native-map-clustering';
import RNMapView, { MapType, Marker, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

/** Extra space below the safe-area top inset for floating map controls. */
const MAP_TOP_CONTROL_EXTRA = 21;
const MAP_FLOATING_CONTROL_HEIGHT = 44;
const MAP_FILTER_GAP = 10;

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
  share_count?: number | null;
};

type MapGem = Gem & {
  likeCount: number;
  commentCount: number;
  shareCount: number;
};

type SelectedCluster = {
  coordinate: { latitude: number; longitude: number };
  gems: MapGem[];
};

type ClusterRenderPayload = {
  id: number;
  geometry: { coordinates: [number, number] };
  onPress: () => void;
  properties: { point_count: number };
};

type TapLocation = {
  latitude: number;
  longitude: number;
};

export default function MapScreen() {
  const router = useRouter();
  useTabRootBackHandler(true);
  useTabStackGesture(router);
  const { theme, isDark } = useTheme();
  const overlay = isDark ? 'rgba(13, 13, 13, 0.85)' : 'rgba(255, 255, 255, 0.9)';
  const chipUnselectedBg = `${theme.card}E6`;
  const styles = useMemo(() => createStyles(theme, overlay), [theme, overlay]);
  const { placeMode, focusLat, focusLng } = useLocalSearchParams<{
    placeMode?: string;
    focusLat?: string;
    focusLng?: string;
  }>();
  const insets = useSafeAreaInsets();
  const topControlTop = insets.top + MAP_TOP_CONTROL_EXTRA;
  const filterTop = topControlTop + MAP_FLOATING_CONTROL_HEIGHT + MAP_FILTER_GAP;
  const mapRef = useRef<RNMapView>(null);
  const superClusterRef = useRef<{ getLeaves: (id: number, limit: number) => unknown[] } | null>(
    null,
  );
  const markerGemsRef = useRef<MapGem[]>([]);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const tapSheetRef = useRef<BottomSheet>(null);
  const sheetImageRef = useRef<View>(null);
  const sheetTitleRef = useRef<View>(null);
  const reduceMotion = useReduceMotion();
  const regionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clusterZoomAnimatingRef = useRef(false);
  const clusterZoomAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedRegionRef = useRef<Region | null>(null);
  const snapPoints = useMemo(() => ['30%', '65%'], []);
  const tapSnapPoints = useMemo(() => ['32%'], []);
  const [mapTypeIndex, setMapTypeIndex] = useState(1);
  const [gems, setGems] = useState<Gem[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [gemsLoading, setGemsLoading] = useState(true);
  const [currentRegion, setCurrentRegion] = useState<Region>(INITIAL_REGION);
  const [selectedCluster, setSelectedCluster] = useState<SelectedCluster | null>(null);
  const [clusterPanelPoint, setClusterPanelPoint] = useState<{ x: number; y: number } | null>(null);
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
  const showMyLocation = true;

  useEffect(() => {
    if (placeMode === 'true') {
      setPlacingMode(true);
    }
  }, [placeMode]);

  const fetchEngagementCounts = useCallback(async (gemList: Gem[]) => {
    if (gemList.length === 0) {
      setLikeCounts({});
      setCommentCounts({});
      return;
    }

    const gemIds = gemList.map((gem) => gem.id);
    const [{ data: likes }, { data: comments }] = await Promise.all([
      supabase.from('gem_likes').select('gem_id').in('gem_id', gemIds),
      supabase.from('comments').select('gem_id').in('gem_id', gemIds),
    ]);

    const nextLikeCounts: Record<string, number> = {};
    const nextCommentCounts: Record<string, number> = {};
    for (const gemId of gemIds) {
      nextLikeCounts[gemId] = 0;
      nextCommentCounts[gemId] = 0;
    }

    if (likes) {
      for (const row of likes) {
        nextLikeCounts[row.gem_id] = (nextLikeCounts[row.gem_id] ?? 0) + 1;
      }
    }

    if (comments) {
      for (const row of comments) {
        nextCommentCounts[row.gem_id] = (nextCommentCounts[row.gem_id] ?? 0) + 1;
      }
    }

    setLikeCounts(nextLikeCounts);
    setCommentCounts(nextCommentCounts);
  }, []);

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
        void fetchEngagementCounts(data);
      }
    } catch {
      setMapError('Could not load gems for this area.');
    } finally {
      setGemsLoading(false);
    }
  }, [fetchEngagementCounts]);

  useEffect(() => {
    const lat = focusLat ? parseFloat(focusLat) : NaN;
    const lng = focusLng ? parseFloat(focusLng) : NaN;
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    const region: Region = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.15,
      longitudeDelta: 0.15,
    };

    mapRef.current?.animateToRegion(region, 500);
    fetchVisibleGems(region);
  }, [focusLat, focusLng, fetchVisibleGems]);

  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      setCurrentRegion(region);

      if (selectedCluster && !clusterZoomAnimatingRef.current) {
        mapRef.current
          ?.pointForCoordinate(selectedCluster.coordinate)
          .then((point: { x: number; y: number }) => {
            if (point) {
              setClusterPanelPoint({ x: point.x, y: point.y });
            }
          })
          .catch(() => {
            setClusterPanelPoint(null);
          });
      }

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
    [fetchVisibleGems, selectedCluster],
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
      if (clusterZoomAnimTimeoutRef.current) {
        clearTimeout(clusterZoomAnimTimeoutRef.current);
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
    if (!tapLocation) return;

    requestAnimationFrame(() => {
      tapSheetRef.current?.snapToIndex(0);
    });
  }, [tapLocation]);

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

  const visibleGemsWithLikes = useMemo<MapGem[]>(
    () =>
      visibleGems.map((gem) => ({
        ...gem,
        likeCount: likeCounts[gem.id] ?? 0,
        commentCount: commentCounts[gem.id] ?? 0,
        shareCount: gem.share_count ?? 0,
      })),
    [visibleGems, likeCounts, commentCounts],
  );

  markerGemsRef.current = visibleGemsWithLikes;

  const cycleMapType = () => {
    setMapTypeIndex((prev) => (prev + 1) % MAP_TYPES.length);
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
      setSelectedCluster(null);
      setClusterPanelPoint(null);
    },
    [placingMode],
  );

  const updateClusterPanelPosition = useCallback(
    (coordinate: { latitude: number; longitude: number }) => {
      mapRef.current
        ?.pointForCoordinate(coordinate)
        .then((point: { x: number; y: number }) => {
          if (point) {
            setClusterPanelPoint({ x: point.x, y: point.y });
          }
        })
        .catch(() => {
          setClusterPanelPoint(null);
        });
    },
    [],
  );

  const handleClusterPress = useCallback(
    (
      cluster: ClusterRenderPayload,
      children?: { properties: { index: number } }[],
    ) => {
      hapticLight();
      if (placingMode || tapLocation) return;

      const gems = resolveGemsFromClusterLeaves(children, markerGemsRef.current);
      if (gems.length < 2) return;

      bottomSheetRef.current?.close();
      setSelectedGem(null);

      const coordinate = {
        latitude: cluster.geometry.coordinates[1],
        longitude: cluster.geometry.coordinates[0],
      };

      setSelectedCluster({ coordinate, gems });
      updateClusterPanelPosition(coordinate);
    },
    [placingMode, tapLocation, updateClusterPanelPosition],
  );

  const handleSinglePinPress = (gem: MapGem, e: { stopPropagation?: () => void }) => {
    hapticLight();
    if (placingMode || tapLocation) return;

    e.stopPropagation?.();
    setSelectedCluster(null);
    setClusterPanelPoint(null);
    bottomSheetRef.current?.close();
    router.push({ pathname: '/gem/[id]', params: { id: gem.id } });
  };

  const handleZoomToCluster = useCallback(() => {
    const cluster = selectedCluster;
    const map = mapRef.current;
    if (!cluster || !map) return;

    const { latitude, longitude } = cluster.coordinate;
    const baseLatDelta = currentRegion.latitudeDelta;
    const baseLngDelta = currentRegion.longitudeDelta;

    const latitudeDelta =
      Number.isFinite(baseLatDelta) && baseLatDelta > 0
        ? Math.max(baseLatDelta * 0.35, 0.01)
        : 0.05;
    const longitudeDelta =
      Number.isFinite(baseLngDelta) && baseLngDelta > 0
        ? Math.max(baseLngDelta * 0.35, 0.01)
        : 0.05;

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitudeDelta) ||
      !Number.isFinite(longitudeDelta)
    ) {
      return;
    }

    const region: Region = {
      latitude,
      longitude,
      latitudeDelta,
      longitudeDelta,
    };

    if (clusterZoomAnimTimeoutRef.current) {
      clearTimeout(clusterZoomAnimTimeoutRef.current);
    }

    clusterZoomAnimatingRef.current = true;
    map.animateToRegion(region, 400);
    clusterZoomAnimTimeoutRef.current = setTimeout(() => {
      clusterZoomAnimatingRef.current = false;
      clusterZoomAnimTimeoutRef.current = null;
    }, 500);
  }, [selectedCluster, currentRegion]);

  const renderCluster = useCallback(
    (cluster: ClusterRenderPayload) => {
      const count = cluster.properties.point_count;
      const leaves =
        (superClusterRef.current?.getLeaves(cluster.id, Infinity) as
          | { properties: { index: number } }[]
          | undefined) ?? [];
      const gems = resolveGemsFromClusterLeaves(leaves, markerGemsRef.current);
      const thumbnailUrl = pickMostLikedThumbnail(gems);

      return (
        <Marker
          key={`cluster-${cluster.id}`}
          coordinate={{
            longitude: cluster.geometry.coordinates[0],
            latitude: cluster.geometry.coordinates[1],
          }}
          onPress={(e) => {
            e.stopPropagation?.();
            cluster.onPress(e);
          }}
          tracksViewChanges={false}
          zIndex={count + 1000}>
          <MapPin count={count} thumbnailUrl={thumbnailUrl} theme={theme} />
        </Marker>
      );
    },
    [theme],
  );

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
    ? formatCoordinates(selectedGem.latitude, selectedGem.longitude)
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
    (tapLocation ? formatCoordinates(tapLocation.latitude, tapLocation.longitude) : '');

  return (
    <View style={styles.container}>
      <ClusteredMapView
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        mapType={currentMapType.type}
        showsUserLocation={showMyLocation}
        showsMyLocationButton={false}
        followsUserLocation={false}
        onPress={handleMapPress}
        onRegionChangeComplete={handleRegionChangeComplete}
        preserveClusterPressBehavior
        renderCluster={renderCluster}
        onClusterPress={handleClusterPress}
        superClusterRef={superClusterRef}
        tracksViewChanges={false}
        radius={48}>
        {visibleGemsWithLikes.map((gem) => (
          <Marker
            key={gem.id}
            identifier={gem.id}
            coordinate={{ latitude: gem.latitude, longitude: gem.longitude }}
            onPress={(e) => handleSinglePinPress(gem, e)}
            tracksViewChanges={false}
            zIndex={1}>
            <MapPin count={1} thumbnailUrl={gem.image_url ?? null} theme={theme} />
          </Marker>
        ))}
        {tapLocation && (
          <Marker
            coordinate={tapLocation}
            {...({ cluster: false } as Record<string, unknown>)}>
            <Ionicons name="location" size={48} color={theme.accent} />
          </Marker>
        )}
      </ClusteredMapView>

      {selectedCluster && !placingMode && !tapLocation ? (
        <ClusterMiniPanel
          gems={selectedCluster.gems}
          theme={theme}
          overlay={overlay}
          screenPoint={clusterPanelPoint}
          onDismiss={() => {
            setSelectedCluster(null);
            setClusterPanelPoint(null);
          }}
          onZoomIn={handleZoomToCluster}
          onGemPress={(gemId) => {
            setSelectedCluster(null);
            setClusterPanelPoint(null);
            router.push({ pathname: '/gem/[id]', params: { id: gemId } });
          }}
        />
      ) : null}

      <TouchableOpacity
        style={[styles.backButton, { top: topControlTop }]}
        onPress={() => goBackOrTab(router, 'index')}
        activeOpacity={0.8}>
        <Ionicons name="arrow-back" size={20} color={theme.text} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.myLocationButton, { top: topControlTop }]}
        onPress={handleMyLocation}
        activeOpacity={0.8}>
        <Ionicons name="locate" size={22} color={theme.accent} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.placeButton, { top: topControlTop }]}
        onPress={togglePlacingMode}
        activeOpacity={0.8}>
        <Text style={styles.placeButtonText}>
          {placingMode ? 'Cancel' : 'Place Gem'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.layerButton, { top: topControlTop }]}
        onPress={cycleMapType}
        activeOpacity={0.8}>
        <Text style={styles.layerButtonText}>{currentMapType.label}</Text>
      </TouchableOpacity>

      {gemsLoading && (
        <View
          style={{
            position: 'absolute',
            top: topControlTop + MAP_FLOATING_CONTROL_HEIGHT + 2,
            left: 0,
            right: 0,
            alignItems: 'center',
          }}>
          <View style={{ backgroundColor: theme.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color={theme.accent} />
            <Text style={{ color: theme.text, fontSize: 12 }}>Loading gems...</Text>
          </View>
        </View>
      )}

      {mapError && (
        <View style={[styles.mapErrorBanner, { top: topControlTop + MAP_FLOATING_CONTROL_HEIGHT + 2 }]}>
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

      <View style={[styles.filterContainer, { top: filterTop }]}>
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

      {tapLocation && (
        <BottomSheet
          ref={tapSheetRef}
          index={0}
          snapPoints={tapSnapPoints}
          enablePanDownToClose
          onClose={() => setTapLocation(null)}
          handleComponent={BottomSheetHandle}
          backgroundStyle={{ backgroundColor: theme.card }}
          activeOffsetY={[-1, 1]}>
          <BottomSheetView style={[styles.tapSheetContent, { paddingBottom: 20 + insets.bottom }]}>
            <Text style={styles.actionSheetTitle}>Drop a gem here?</Text>
            <Text style={styles.actionSheetLocation}>{tapLocationLabel}</Text>
            <View style={styles.actionSheetButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setTapLocation(null);
                }}
                activeOpacity={0.8}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addButton} onPress={handleAddGemHere} activeOpacity={0.8}>
                <Text style={styles.addButtonText}>Add Gem Here</Text>
              </TouchableOpacity>
            </View>
          </BottomSheetView>
        </BottomSheet>
      )}

      {!placingMode && !tapLocation && (
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          onClose={() => setSelectedGem(null)}
          handleComponent={BottomSheetHandle}
          backgroundStyle={{ backgroundColor: theme.card }}
          activeOffsetY={[-1, 1]}>
          <BottomSheetScrollView
            overScrollMode="never"
            bounces={Platform.OS === 'ios' ? false : undefined}
            contentContainerStyle={styles.bottomSheetContent}>
            {selectedGem && (
              <>
                <View ref={sheetTitleRef} collapsable={false}>
                  <Text style={styles.sheetTitle}>{selectedGem.title}</Text>
                </View>

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

                <Pressable
                  style={({ pressed }) => [
                    styles.checkInButton,
                    pressed && Platform.OS !== 'android' && { opacity: 0.8 },
                  ]}
                  onPress={() =>
                    navigateToGemWithSharedTransition(
                      router,
                      {
                        id: selectedGem.id,
                        title: selectedGem.title,
                        image_url: selectedGem.image_url ?? null,
                      },
                      { imageRef: sheetImageRef, titleRef: sheetTitleRef },
                      reduceMotion,
                    )
                  }
                  android_ripple={{ color: theme.accentSub, borderless: false }}>
                  <Text style={styles.checkInButtonText}>Check In</Text>
                </Pressable>

                <View ref={sheetImageRef} style={styles.sheetImageWrap} collapsable={false}>
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
                  {selectedGemDistance ? (
                    <View style={styles.sheetStat}>
                      <Ionicons name="navigate-outline" size={14} color={theme.textSecondary} />
                      <Text style={styles.sheetStatText}>{selectedGemDistance}</Text>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.viewDetailsButton}
                  onPress={() =>
                    navigateToGemWithSharedTransition(
                      router,
                      {
                        id: selectedGem.id,
                        title: selectedGem.title,
                        image_url: selectedGem.image_url ?? null,
                      },
                      { imageRef: sheetImageRef, titleRef: sheetTitleRef },
                      reduceMotion,
                    )
                  }
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
          </BottomSheetScrollView>
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
      left: 0,
      right: 0,
    },
    placeButton: {
      position: 'absolute',
      right: 92,
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
    myLocationButton: {
      position: 'absolute',
      left: 68,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: overlay,
      borderWidth: 1,
      borderColor: theme.accent + '80',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tapSheetContent: {
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
      backgroundColor: theme.bgTertiary,
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
      padding: 16,
      paddingBottom: 28,
    },
    checkInButton: {
      backgroundColor: theme.accent,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 12,
      marginBottom: 16,
    },
    checkInButtonText: {
      color: theme.accentText,
      fontSize: 15,
      fontWeight: '700',
    },
    sheetImageWrap: {
      width: '100%',
      height: 140,
      marginBottom: 12,
    },
    sheetImage: {
      width: '100%',
      height: 140,
      borderRadius: 12,
    },
    sheetImagePlaceholder: {
      width: '100%',
      height: 140,
      borderRadius: 12,
      backgroundColor: theme.bgTertiary,
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
      backgroundColor: theme.accentSub,
      borderWidth: 0.5,
      borderColor: theme.accent,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 20,
    },
    sheetCategoryBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
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
      fontSize: 10,
      color: theme.accent,
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
