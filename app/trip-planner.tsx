import { CATEGORIES } from '@/lib/categories';
import { searchCities } from '@/lib/cityAutocomplete';
import { getDistance } from '@/lib/distance';
import { GEM_SELECT_WITH_COMMUNITY } from '@/lib/gemVisibility';
import { checkIsPremium } from '@/lib/paywall';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RADIUS_OPTIONS = [10, 25, 50, 100, 200] as const;
const IMAGE_PLACEHOLDER = '#1A5C3A';

type CitySuggestion = { name: string; lat: number; lng: number };

type Gem = {
  id: string;
  title: string;
  category: string;
  image_url: string | null;
  latitude: number;
  longitude: number;
  profiles: { username: string } | null;
};

type GemWithDistance = Gem & { distanceMeters: number };

const formatDistanceKm = (meters: number) => {
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
};

const getCategoryName = (categoryId: string) =>
  CATEGORIES.find((c) => c.id === categoryId)?.name ?? categoryId;

export default function TripPlannerScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();

  const [checkingPremium, setCheckingPremium] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  const [cityQuery, setCityQuery] = useState('');
  const [destName, setDestName] = useState<string | null>(null);
  const [destLat, setDestLat] = useState<number | null>(null);
  const [destLng, setDestLng] = useState<number | null>(null);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [selectedRadius, setSelectedRadius] = useState<number>(50);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<GemWithDistance[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = async () => {
      setCheckingPremium(true);
      const premium = await checkIsPremium();
      setIsPremium(premium);
      setCheckingPremium(false);
    };
    init();
  }, []);

  const handleCityInput = useCallback((text: string) => {
    setCityQuery(text);
    setDestName(null);
    setDestLat(null);
    setDestLng(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.length < 2) {
      setShowSuggestions(false);
      setCitySuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const cityResults = await searchCities(text);
      setCitySuggestions(cityResults);
      setShowSuggestions(cityResults.length > 0);
    }, 400);
  }, []);

  const selectCity = (city: CitySuggestion) => {
    setCityQuery(city.name);
    setDestName(city.name);
    setDestLat(city.lat);
    setDestLng(city.lng);
    setShowSuggestions(false);
    setCitySuggestions([]);
  };

  const toggleCategory = async (cat: (typeof CATEGORIES)[number]) => {
    if (cat.premium) {
      const premium = await checkIsPremium();
      if (!premium) {
        router.push('/paywall');
        return;
      }
    }

    setSelectedCategories((prev) =>
      prev.includes(cat.id) ? prev.filter((id) => id !== cat.id) : [...prev, cat.id],
    );
  };

  const fetchLikeCounts = async (gems: Gem[]) => {
    if (gems.length === 0) return;

    const gemIds = gems.map((gem) => gem.id);
    const { data } = await supabase.from('gem_likes').select('gem_id').in('gem_id', gemIds);

    const counts: Record<string, number> = {};
    for (const gemId of gemIds) counts[gemId] = 0;
    if (data) {
      for (const row of data) {
        counts[row.gem_id] = (counts[row.gem_id] ?? 0) + 1;
      }
    }
    setLikeCounts((prev) => ({ ...prev, ...counts }));
  };

  const handleSearch = async () => {
    if (!destName || destLat == null || destLng == null) return;

    setSearching(true);
    setHasSearched(true);

    const { data } = await supabase
      .from('gems')
      .select(GEM_SELECT_WITH_COMMUNITY)
      .eq('is_private', false)
      .is('community_id', null);

    const radiusMeters = selectedRadius * 1000;

    const gems = (data ?? []) as Gem[];

    let filtered: GemWithDistance[] = gems
      .map((gem) => ({
        ...gem,
        distanceMeters: getDistance(destLat, destLng, gem.latitude, gem.longitude),
      }))
      .filter((gem) => gem.distanceMeters <= radiusMeters);

    if (selectedCategories.length > 0) {
      filtered = filtered.filter((gem) => selectedCategories.includes(gem.category));
    }

    filtered.sort((a, b) => a.distanceMeters - b.distanceMeters);

    setResults(filtered);
    await fetchLikeCounts(filtered);
    setSearching(false);
  };

  const renderGemCard = (gem: GemWithDistance) => {
    const username = gem.profiles?.username ?? 'unknown';

    return (
      <TouchableOpacity
        key={gem.id}
        style={styles.listCard}
        onPress={() => router.push('/gem/' + gem.id)}
        activeOpacity={0.7}>
        <View style={styles.listCardImageWrap}>
          {gem.image_url ? (
            <Image
              source={{ uri: gem.image_url }}
              style={styles.listCardImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.listCardImage, styles.listCardImagePlaceholder]} />
          )}
        </View>
        <View style={styles.listCardContent}>
          <View style={styles.listBadgeRow}>
            <View style={styles.listCategoryBadge}>
              <Text style={styles.listCategoryBadgeText}>{getCategoryName(gem.category)}</Text>
            </View>
          </View>
          <Text style={styles.listCardTitle} numberOfLines={1}>
            {gem.title}
          </Text>
          <Text style={styles.listCardUsername}>@{username}</Text>
          <View style={styles.listCardMetaRow}>
            <View style={styles.listCardMetaItem}>
              <Ionicons name="heart-outline" size={12} color={theme.textSecondary} />
              <Text style={styles.listCardMetaText}>{likeCounts[gem.id] ?? 0}</Text>
            </View>
            <Text style={styles.listCardMetaDivider}>|</Text>
            <View style={styles.listCardMetaItem}>
              <Ionicons name="location-outline" size={12} color={theme.textSecondary} />
              <Text style={styles.listCardMetaText}>{formatDistanceKm(gem.distanceMeters)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (checkingPremium) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isPremium) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerSide} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip Planner</Text>
          <View style={styles.headerSide} />
        </View>
        <View style={styles.premiumPrompt}>
          <Ionicons name="diamond" size={56} color={theme.coral} />
          <Text style={styles.premiumTitle}>Trip Planner is Premium</Text>
          <Text style={styles.premiumSubtitle}>
            Plan your next adventure and discover hidden gems near any destination
          </Text>
          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: theme.accent }]}
            onPress={() => router.push('/paywall')}
            activeOpacity={0.8}>
            <Text style={[styles.upgradeButtonText, { color: theme.accentText }]}>
              Upgrade to Premium
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerSide} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Planner</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Where are you going?</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={cityQuery}
            onChangeText={handleCityInput}
            placeholder="Search for a city..."
            placeholderTextColor={theme.textTertiary}
            autoCorrect={false}
          />
          {showSuggestions && citySuggestions.length > 0 && (
            <View style={styles.suggestions}>
              <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {citySuggestions.map((city, index) => (
                  <TouchableOpacity
                    key={`${city.name}-${index}`}
                    style={[
                      styles.suggestionRow,
                      index < citySuggestions.length - 1 && styles.suggestionRowBorder,
                    ]}
                    onPress={() => selectCity(city)}
                    activeOpacity={0.7}>
                    <Ionicons name="location-outline" size={14} color={theme.textTertiary} />
                    <Text style={styles.suggestionText}>{city.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Search radius</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}>
          {RADIUS_OPTIONS.map((radius) => {
            const isSelected = selectedRadius === radius;
            return (
              <TouchableOpacity
                key={radius}
                style={[
                  styles.radiusPill,
                  isSelected && { backgroundColor: theme.accent, borderColor: theme.accent },
                ]}
                onPress={() => setSelectedRadius(radius)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.radiusPillText,
                    isSelected && { color: theme.accentText },
                  ]}>
                  {radius} km
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Interested in</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategories.includes(cat.id);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isSelected ? cat.color : 'rgba(255,255,255,0.15)',
                  },
                ]}
                onPress={() => toggleCategory(cat)}
                activeOpacity={0.7}>
                <Ionicons name={cat.icon as keyof typeof Ionicons.glyphMap} size={14} color="#FFFFFF" />
                <Text style={styles.categoryPillText}>
                  {cat.name}
                  {cat.premium ? ' 💎' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[styles.searchButton, !destName && styles.searchButtonDisabled]}
          disabled={!destName || searching}
          onPress={handleSearch}
          activeOpacity={0.8}>
          {searching ? (
            <ActivityIndicator size="small" color={theme.accentText} />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </TouchableOpacity>

        {hasSearched && (
          <View style={styles.resultsSection}>
            {searching ? (
              <View style={styles.searchingState}>
                <ActivityIndicator size="large" color={theme.accent} />
                <Text style={styles.searchingText}>Searching nearby gems...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.resultsSummary}>
                  {results.length} gem{results.length !== 1 ? 's' : ''} found near {destName}
                </Text>

                {results.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                      No gems found in this area yet. Be the first to add one!
                    </Text>
                    <TouchableOpacity
                      style={styles.addGemButton}
                      onPress={() => router.push('/add-gem')}
                      activeOpacity={0.8}>
                      <Text style={styles.addGemButtonText}>Add a Gem</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  results.map((gem) => renderGemCard(gem))
                )}
              </>
            )}
          </View>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerSide: {
      width: 22,
      alignItems: 'center',
    },
    headerTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 17,
      color: theme.text,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    premiumPrompt: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 12,
    },
    premiumTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 22,
      color: theme.text,
      textAlign: 'center',
      marginTop: 8,
    },
    premiumSubtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    upgradeButton: {
      borderRadius: 12,
      paddingHorizontal: 28,
      paddingVertical: 14,
      marginTop: 16,
    },
    upgradeButtonText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 16,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    fieldLabelSpaced: {
      marginTop: 16,
    },
    inputWrap: {
      zIndex: 10,
      position: 'relative',
      marginTop: 8,
    },
    input: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: theme.text,
    },
    suggestions: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      marginTop: 4,
      maxHeight: 200,
      overflow: 'hidden',
      zIndex: 20,
      elevation: 4,
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    suggestionRowBorder: {
      borderBottomWidth: 0.5,
      borderBottomColor: theme.border,
    },
    suggestionText: {
      fontSize: 14,
      color: theme.text,
      flex: 1,
    },
    pillRow: {
      paddingVertical: 4,
      gap: 10,
      marginTop: 8,
    },
    radiusPill: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 20,
      marginRight: 10,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.4)',
    },
    radiusPillText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      fontFamily: 'SpaceMono-Regular',
    },
    categoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 20,
      marginRight: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.4)',
    },
    categoryPillText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    searchButton: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 20,
    },
    searchButtonDisabled: {
      opacity: 0.5,
    },
    searchButtonText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 16,
      color: theme.accentText,
    },
    resultsSection: {
      marginTop: 24,
    },
    searchingState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      paddingTop: 60,
      gap: 16,
    },
    searchingText: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    resultsSummary: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 12,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 16,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    addGemButton: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 14,
    },
    addGemButtonText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 15,
      color: theme.accentText,
    },
    listCard: {
      flexDirection: 'row',
      height: 90,
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 10,
    },
    listCardImageWrap: {
      width: 90,
      height: 90,
    },
    listCardImage: {
      width: 90,
      height: 90,
      borderTopLeftRadius: 12,
      borderBottomLeftRadius: 12,
    },
    listCardImagePlaceholder: {
      backgroundColor: IMAGE_PLACEHOLDER,
    },
    listCardContent: {
      flex: 1,
      padding: 12,
      justifyContent: 'space-between',
    },
    listBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 2,
    },
    listCategoryBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.accentSubtle,
      borderWidth: 0.5,
      borderColor: theme.accent,
      paddingVertical: 2,
      paddingHorizontal: 8,
      borderRadius: 20,
    },
    listCategoryBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.accent,
    },
    listCardTitle: {
      fontSize: 14,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.text,
    },
    listCardUsername: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    listCardMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    listCardMetaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    listCardMetaText: {
      fontSize: 11,
      fontFamily: 'SpaceMono-Regular',
      color: theme.textSecondary,
    },
    listCardMetaDivider: {
      fontSize: 11,
      color: theme.textTertiary,
    },
  });
