import { searchCities } from '@/lib/cityAutocomplete'
import { CATEGORIES } from '@/lib/categories'
import {
  ONBOARDING_SEEN_KEY,
  savePreferences,
  type PendingPrefs,
} from '@/lib/onboarding'
import { useTheme } from '@/lib/ThemeContext'
import type { Theme } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const TOTAL_STEPS = 10
const STORY_TEXTS = [
  "Most places worth seeing aren't on any map.",
  "The best ones get passed between people who've actually been there.",
  'Hidden Gems is where that happens.',
]

const TRIAL_FEATURES = [
  'Unlimited gem drops',
  'Hidden Gems exclusive category',
  'Private pins for friends only',
  'No ads',
]

type Gem = {
  id: string
  image_url: string | null
  category: string
}

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_GAP = 12
const CATEGORY_CARD_SIZE = (SCREEN_WIDTH - 48 - CARD_GAP) / 2

async function fetchLikeCounts(gemIds: string[]): Promise<Record<string, number>> {
  if (gemIds.length === 0) return {}
  const { data } = await supabase.from('gem_likes').select('gem_id').in('gem_id', gemIds)
  const counts: Record<string, number> = {}
  for (const id of gemIds) counts[id] = 0
  if (data) {
    for (const row of data) {
      counts[row.gem_id] = (counts[row.gem_id] ?? 0) + 1
    }
  }
  return counts
}

async function sortGemsByLikes(gems: Gem[]): Promise<Gem[]> {
  const counts = await fetchLikeCounts(gems.map((g) => g.id))
  return [...gems].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
}

export default function OnboardingScreen() {
  const { theme } = useTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [trendingGems, setTrendingGems] = useState<Gem[]>([])
  const [categoryGems, setCategoryGems] = useState<Record<string, Gem | null>>({})
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [explorePreference, setExplorePreference] = useState<'urban' | 'nature' | null>(null)
  const [discoverStyle, setDiscoverStyle] = useState<'solo' | 'social' | null>(null)
  const [homeTown, setHomeTown] = useState('')
  const [homeLat, setHomeLat] = useState<number | null>(null)
  const [homeLng, setHomeLng] = useState<number | null>(null)
  const [cityQuery, setCityQuery] = useState('')
  const [citySuggestions, setCitySuggestions] = useState<{ name: string; lat: number; lng: number }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [prefsSaved, setPrefsSaved] = useState(false)

  const fadeAnim = useRef(new Animated.Value(1)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const cardScale = useRef(new Animated.Value(1)).current
  const stepRef = useRef(step)
  stepRef.current = step

  const animateStepChange = useCallback(
    (next: number) => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start()
      setTimeout(() => setStep(next), 120)
    },
    [fadeAnim],
  )

  const advance = useCallback(() => {
    if (step >= TOTAL_STEPS - 1) return
    if (step === 3 || step === 6 || step === 7 || step === 8) return
    animateStepChange(step + 1)
  }, [animateStepChange, step])

  const animateStepRef = useRef(animateStepChange)
  animateStepRef.current = animateStepChange

  const buildPrefs = useCallback((): PendingPrefs => {
    let categories = [...selectedCategories]
    if (explorePreference && !categories.includes(explorePreference)) {
      categories = [...categories, explorePreference]
    }
    return {
      preferred_categories: categories,
      explore_preference: explorePreference ?? undefined,
      discover_style: discoverStyle ?? undefined,
      home_town: homeTown.trim() || undefined,
      home_lat: homeLat ?? undefined,
      home_lng: homeLng ?? undefined,
    }
  }, [selectedCategories, explorePreference, discoverStyle, homeTown, homeLat, homeLng])

  const completeWithDefaults = useCallback(async () => {
    const allIds = CATEGORIES.map((c) => c.id)
    const prefs: PendingPrefs = { preferred_categories: allIds }
    await savePreferences(userId, prefs)
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true')
    router.replace('/auth')
  }, [router, userId])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        if (stepRef.current > 2) return false
        return Math.abs(g.dx) > 24 && Math.abs(g.dy) < 40
      },
      onPanResponderRelease: (_, g) => {
        if (stepRef.current > 2) return
        if (g.dx < -50) {
          if (stepRef.current < TOTAL_STEPS - 1) {
            animateStepRef.current(stepRef.current + 1)
          }
        } else if (g.dx > 50 && stepRef.current > 0) {
          animateStepRef.current(stepRef.current - 1)
        }
      },
    }),
  ).current

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)

      const { data: gems } = await supabase
        .from('gems')
        .select('id, image_url, category')
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .limit(10)

      if (gems && gems.length > 0) {
        const sorted = await sortGemsByLikes(gems as Gem[])
        setTrendingGems(sorted.slice(0, 3))
      }

      const catMap: Record<string, Gem | null> = {}
      await Promise.all(
        CATEGORIES.map(async (cat) => {
          const { data: catGems } = await supabase
            .from('gems')
            .select('id, image_url, category')
            .eq('is_private', false)
            .eq('category', cat.id)
            .limit(10)
          if (catGems && catGems.length > 0) {
            const sorted = await sortGemsByLikes(catGems as Gem[])
            catMap[cat.id] = sorted[0]
          } else {
            catMap[cat.id] = null
          }
        }),
      )
      setCategoryGems(catMap)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (step !== 6) return

    const detectHomeTown = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return

        const location = await Location.getCurrentPositionAsync({})
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${location.coords.latitude}&lon=${location.coords.longitude}&format=json`,
        )
        const data = await response.json()
        const detectedCity =
          data.address?.city || data.address?.town || data.address?.village || ''
        setHomeTown(detectedCity)
        setCityQuery(detectedCity)
        setHomeLat(location.coords.latitude)
        setHomeLng(location.coords.longitude)
      } catch {
        // Location detection is optional
      }
    }
    detectHomeTown()
  }, [step])

  useEffect(() => {
    if (step !== 7 || prefsSaved) return

    const save = async () => {
      await savePreferences(userId, buildPrefs())
      setPrefsSaved(true)
    }
    save()

    const timer = setTimeout(() => animateStepChange(8), 1800)
    return () => clearTimeout(timer)
  }, [step, prefsSaved, userId, buildPrefs, animateStepChange])

  useEffect(() => {
    if (step !== 7) return
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    )
    pulse.start()
    return () => pulse.stop()
  }, [step, pulseAnim])

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  const selectExplore = (pref: 'urban' | 'nature') => {
    setExplorePreference(pref)
    Animated.sequence([
      Animated.spring(cardScale, { toValue: 1.05, useNativeDriver: true, friction: 4 }),
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start()
    setTimeout(() => animateStepChange(5), 300)
  }

  const selectDiscover = (style: 'solo' | 'social') => {
    setDiscoverStyle(style)
    Animated.sequence([
      Animated.spring(cardScale, { toValue: 1.05, useNativeDriver: true, friction: 4 }),
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start()
    setTimeout(() => animateStepChange(6), 300)
  }

  const handleCityInput = (text: string) => {
    setCityQuery(text)
    setHomeTown(text)

    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current)

    if (text.length < 2) {
      setShowSuggestions(false)
      setCitySuggestions([])
      return
    }

    cityDebounceRef.current = setTimeout(async () => {
      const results = await searchCities(text)
      setCitySuggestions(results)
      setShowSuggestions(results.length > 0)
    }, 400)
  }

  const selectCity = (city: { name: string; lat: number; lng: number }) => {
    setHomeTown(city.name)
    setHomeLat(city.lat)
    setHomeLng(city.lng)
    setCityQuery(city.name)
    setShowSuggestions(false)
    setCitySuggestions([])
  }

  const continueFromHomeTown = () => {
    if (!homeTown.trim()) return
    animateStepChange(7)
  }

  const startTrial = async () => {
    if (userId) {
      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + 3)
      await supabase
        .from('profiles')
        .update({ is_premium: true, trial_ends_at: trialEnd.toISOString() })
        .eq('id', userId)
    }
    animateStepChange(9)
  }

  const finishOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true')
    if (userId) {
      router.replace('/')
    } else {
      router.replace('/auth')
    }
  }

  const showSkip = !loading && step < 8
  const showProgress = !loading && step < 9
  const tapToAdvance = !loading && step < 3

  const renderStoryStep = (index: number) => {
    const gem = trendingGems[index]
    return (
      <View style={styles.storyContainer}>
        {gem?.image_url ? (
          <Image source={{ uri: gem.image_url }} style={styles.storyImage} />
        ) : (
          <View style={[styles.storyImage, styles.storyPlaceholder]} />
        )}
        <View style={styles.storyGradient} />
        <Text style={styles.storyText}>{STORY_TEXTS[index]}</Text>
      </View>
    )
  }

  const renderCategoryCard = (cat: (typeof CATEGORIES)[number]) => {
    const gem = categoryGems[cat.id]
    const selected = selectedCategories.includes(cat.id)
    return (
      <TouchableOpacity
        key={cat.id}
        style={[styles.categoryCard, selected && styles.categoryCardSelected]}
        onPress={() => toggleCategory(cat.id)}
        activeOpacity={0.85}>
        {gem?.image_url ? (
          <Image source={{ uri: gem.image_url }} style={styles.categoryCardImage} />
        ) : (
          <View style={[styles.categoryCardImage, { backgroundColor: cat.color + '33' }]} />
        )}
        <View style={styles.categoryCardGradient} />
        <View style={styles.categoryCardLabel}>
          <Ionicons name={cat.icon as keyof typeof Ionicons.glyphMap} size={16} color="#FFFFFF" />
          <Text style={styles.categoryCardName}>{cat.name}</Text>
        </View>
        {selected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    )
  }

  const renderExploreCard = (
    pref: 'urban' | 'nature',
    label: string,
    gem: Gem | null | undefined,
    fallbackColor: string,
  ) => {
    const selected = explorePreference === pref
    return (
      <Animated.View style={[styles.exploreCardWrap, { transform: [{ scale: selected ? cardScale : 1 }] }]}>
        <TouchableOpacity
          style={[styles.exploreCard, selected && styles.exploreCardSelected]}
          onPress={() => selectExplore(pref)}
          activeOpacity={0.85}>
          {gem?.image_url ? (
            <Image source={{ uri: gem.image_url }} style={styles.exploreCardImage} />
          ) : (
            <View style={[styles.exploreCardImage, { backgroundColor: fallbackColor + '44' }]} />
          )}
          <View style={styles.exploreCardGradient} />
          <Text style={styles.exploreCardLabel}>{label}</Text>
          {selected && (
            <View style={styles.exploreCheck}>
              <Ionicons name="checkmark-circle" size={28} color={theme.accent} />
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    )
  }

  const renderDiscoverCard = (
    style: 'solo' | 'social',
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    iconColor: string,
  ) => {
    const selected = discoverStyle === style
    return (
      <Animated.View style={[styles.exploreCardWrap, { transform: [{ scale: selected ? cardScale : 1 }] }]}>
        <TouchableOpacity
          style={[styles.discoverCard, selected && styles.exploreCardSelected]}
          onPress={() => selectDiscover(style)}
          activeOpacity={0.85}>
          <Ionicons name={icon} size={40} color={iconColor} />
          <Text style={styles.discoverCardLabel}>{label}</Text>
          {selected && (
            <View style={styles.exploreCheck}>
              <Ionicons name="checkmark-circle" size={28} color={theme.accent} />
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    )
  }

  const renderStepContent = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )
    }

    if (step <= 2) return renderStoryStep(step)

    if (step === 3) {
      return (
        <View style={styles.prefsContainer}>
          <Text style={styles.prefsTitle}>What calls to you?</Text>
          <Text style={styles.prefsSubtitle}>Pick as many as you like</Text>
          <ScrollView
            contentContainerStyle={styles.categoryGrid}
            showsVerticalScrollIndicator={false}>
            {CATEGORIES.map((cat) => renderCategoryCard(cat))}
          </ScrollView>
          <TouchableOpacity
            style={[
              styles.continueButton,
              selectedCategories.length === 0 && styles.continueButtonDisabled,
            ]}
            disabled={selectedCategories.length === 0}
            onPress={() => animateStepChange(4)}
            activeOpacity={0.8}>
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )
    }

    if (step === 4) {
      return (
        <View style={styles.prefsContainer}>
          <Text style={styles.prefsTitle}>City or wild?</Text>
          <Text style={styles.prefsSubtitle}>This helps us prioritize your feed</Text>
          <View style={styles.exploreRow}>
            {renderExploreCard('urban', 'Urban', categoryGems.urban, '#534AB7')}
            {renderExploreCard('nature', 'Nature', categoryGems.nature, '#27500A')}
          </View>
        </View>
      )
    }

    if (step === 5) {
      return (
        <View style={styles.prefsContainer}>
          <Text style={styles.prefsTitle}>Solo or social?</Text>
          <Text style={styles.prefsSubtitle}>How do you like to discover?</Text>
          <View style={styles.exploreRow}>
            {renderDiscoverCard('solo', 'Solo explorer', 'person', theme.accent)}
            {renderDiscoverCard('social', 'With friends', 'people', theme.coral)}
          </View>
        </View>
      )
    }

    if (step === 6) {
      return (
        <View style={styles.prefsContainer}>
          <Text style={styles.prefsTitle}>Where do you call home?</Text>
          <Text style={styles.prefsSubtitle}>We&apos;ll use this to recognize you as a local</Text>
          <View style={styles.homeTownInputWrap}>
            <TextInput
              style={styles.homeTownInput}
              value={cityQuery}
              onChangeText={handleCityInput}
              placeholder="Your city"
              placeholderTextColor={theme.textSecondary}
              autoCorrect={false}
            />
            {showSuggestions && citySuggestions.length > 0 && (
              <View style={styles.citySuggestions}>
                <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {citySuggestions.map((city, index) => (
                    <TouchableOpacity
                      key={`${city.name}-${index}`}
                      style={[
                        styles.citySuggestionRow,
                        index < citySuggestions.length - 1 && styles.citySuggestionRowBorder,
                      ]}
                      onPress={() => selectCity(city)}
                      activeOpacity={0.7}>
                      <Ionicons name="location-outline" size={14} color={theme.textTertiary} />
                      <Text style={styles.citySuggestionText}>{city.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <Text style={styles.homeTownHint}>Detected automatically — tap to edit</Text>
          </View>
          <TouchableOpacity
            style={[styles.continueButton, !homeTown.trim() && styles.continueButtonDisabled]}
            disabled={!homeTown.trim()}
            onPress={continueFromHomeTown}
            activeOpacity={0.8}>
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )
    }

    if (step === 7) {
      return (
        <View style={styles.centered}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Ionicons name="sparkles" size={48} color={theme.accent} />
          </Animated.View>
          <Text style={styles.setupTitle}>Setting up your feed...</Text>
          <View style={styles.chipRow}>
            {selectedCategories.map((id) => {
              const cat = CATEGORIES.find((c) => c.id === id)
              return (
                <View key={id} style={styles.chip}>
                  <Text style={styles.chipText}>{cat?.name ?? id}</Text>
                </View>
              )
            })}
          </View>
        </View>
      )
    }

    if (step === 8) {
      return (
        <ScrollView contentContainerStyle={styles.trialContent} showsVerticalScrollIndicator={false}>
          <Ionicons name="diamond" size={56} color={theme.coral} />
          <Text style={styles.trialTitle}>Try Premium free for 3 days</Text>
          <Text style={styles.trialSubtitle}>Then 4.99€/month. Cancel anytime.</Text>
          <View style={styles.featuresList}>
            {TRIAL_FEATURES.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.trialButton} onPress={startTrial} activeOpacity={0.8}>
            <Text style={styles.trialButtonText}>Start free trial</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => animateStepChange(9)} activeOpacity={0.7}>
            <Text style={styles.maybeLater}>Maybe later</Text>
          </TouchableOpacity>
        </ScrollView>
      )
    }

    return (
      <View style={styles.centered}>
        <Ionicons name="checkmark-circle" size={72} color={theme.accent} />
        <Text style={styles.finalTitle}>You&apos;re all set</Text>
        <TouchableOpacity style={styles.trialButton} onPress={finishOnboarding} activeOpacity={0.8}>
          <Text style={styles.trialButtonText}>Start exploring</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const content = (
    <Animated.View style={[styles.content, { opacity: fadeAnim }]} {...panResponder.panHandlers}>
      {renderStepContent()}
    </Animated.View>
  )

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {showProgress && (
        <View style={styles.progressBar}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                { backgroundColor: i <= step ? theme.accent : theme.border },
              ]}
            />
          ))}
        </View>
      )}

      {showSkip && (
        <TouchableOpacity style={styles.skipButton} onPress={completeWithDefaults} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {tapToAdvance ? (
        <Pressable style={styles.pressable} onPress={advance}>
          {content}
        </Pressable>
      ) : (
        <View style={styles.pressable}>{content}</View>
      )}
    </SafeAreaView>
  )
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    progressBar: {
      position: 'absolute',
      top: 50,
      left: 16,
      right: 16,
      height: 3,
      flexDirection: 'row',
      gap: 4,
      zIndex: 10,
    },
    progressSegment: {
      flex: 1,
      borderRadius: 2,
    },
    skipButton: {
      position: 'absolute',
      top: 46,
      right: 16,
      zIndex: 10,
      padding: 4,
    },
    skipText: {
      color: theme.textSecondary,
      fontSize: 13,
    },
    pressable: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    storyContainer: {
      flex: 1,
    },
    storyImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    storyPlaceholder: {
      backgroundColor: theme.backgroundTertiary,
    },
    storyGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 220,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    storyText: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 26,
      color: '#FFFFFF',
      lineHeight: 34,
      padding: 24,
    },
    prefsContainer: {
      flex: 1,
      paddingTop: 72,
    },
    prefsTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 22,
      color: theme.text,
      textAlign: 'center',
      paddingHorizontal: 24,
    },
    prefsSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 20,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      gap: CARD_GAP,
      paddingBottom: 100,
    },
    categoryCard: {
      width: CATEGORY_CARD_SIZE,
      aspectRatio: 1,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
    },
    categoryCardSelected: {
      borderWidth: 3,
      borderColor: theme.accent,
    },
    categoryCardImage: {
      width: '100%',
      height: '100%',
    },
    categoryCardGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 72,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    categoryCardLabel: {
      position: 'absolute',
      bottom: 12,
      left: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    categoryCardName: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    checkBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    continueButton: {
      position: 'absolute',
      bottom: 24,
      left: 16,
      right: 16,
      backgroundColor: theme.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    continueButtonDisabled: {
      backgroundColor: theme.border,
      opacity: 0.6,
    },
    continueButtonText: {
      color: theme.accentText,
      fontSize: 16,
      fontWeight: '700',
    },
    homeTownInputWrap: {
      paddingHorizontal: 16,
      marginTop: 8,
      zIndex: 10,
      position: 'relative',
    },
    citySuggestions: {
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
    citySuggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    citySuggestionRowBorder: {
      borderBottomWidth: 0.5,
      borderBottomColor: theme.border,
    },
    citySuggestionText: {
      fontSize: 14,
      color: theme.text,
      flex: 1,
    },
    homeTownInput: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: theme.text,
    },
    homeTownHint: {
      fontSize: 11,
      color: theme.textTertiary,
      marginTop: 8,
      textAlign: 'center',
    },
    exploreRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      gap: 12,
      flex: 1,
    },
    exploreCardWrap: {
      flex: 1,
    },
    exploreCard: {
      flex: 1,
      borderRadius: 16,
      overflow: 'hidden',
      minHeight: 280,
      position: 'relative',
    },
    exploreCardSelected: {
      borderWidth: 3,
      borderColor: theme.accent,
    },
    exploreCardImage: {
      width: '100%',
      height: '100%',
      ...StyleSheet.absoluteFillObject,
    },
    exploreCardGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 80,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    exploreCardLabel: {
      position: 'absolute',
      bottom: 16,
      left: 0,
      right: 0,
      textAlign: 'center',
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 18,
      color: '#FFFFFF',
    },
    exploreCheck: {
      position: 'absolute',
      top: 12,
      right: 12,
    },
    discoverCard: {
      flex: 1,
      borderRadius: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 280,
      gap: 16,
      position: 'relative',
    },
    discoverCardLabel: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 16,
      color: theme.text,
      textAlign: 'center',
      paddingHorizontal: 12,
    },
    setupTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 18,
      color: theme.text,
      marginTop: 20,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
    },
    chip: {
      backgroundColor: theme.accentSubtle,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    chipText: {
      fontSize: 12,
      color: theme.accent,
      fontWeight: '600',
    },
    trialContent: {
      flexGrow: 1,
      alignItems: 'center',
      paddingTop: 72,
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    trialTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 24,
      color: theme.text,
      textAlign: 'center',
      marginTop: 16,
    },
    trialSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    featuresList: {
      alignSelf: 'stretch',
      marginTop: 28,
      paddingHorizontal: 8,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    featureText: {
      fontSize: 15,
      color: theme.text,
      flex: 1,
    },
    trialButton: {
      alignSelf: 'stretch',
      backgroundColor: theme.accent,
      borderRadius: 12,
      padding: 16,
      marginTop: 24,
      marginHorizontal: 16,
      alignItems: 'center',
    },
    trialButtonText: {
      color: theme.accentText,
      fontSize: 16,
      fontWeight: '700',
    },
    maybeLater: {
      color: theme.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 16,
    },
    finalTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 22,
      color: theme.text,
      marginTop: 16,
      marginBottom: 8,
    },
  })
