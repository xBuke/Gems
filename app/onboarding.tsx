import { searchCities } from '@/lib/cityAutocomplete'
import { CATEGORIES } from '@/lib/categories'
import { getCurrentCoordinates } from '@/lib/currentLocation'
import { formatCoordinates } from '@/lib/coordinates'
import {
  ONBOARDING_SEEN_KEY,
  savePreferences,
  type PendingPrefs,
} from '@/lib/onboarding'
import { useTheme } from '@/lib/ThemeContext'
import type { Theme } from '@/lib/theme'
import { hapticSuccess } from '@/lib/haptics'
import { supabase } from '@/lib/supabase'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

const TOTAL_STEPS = 13
const STORY_STEP_COUNT = 6

type StoryStepDef = {
  text: string
  subtitle?: string
  showProBadge?: boolean
  gradient: readonly [string, string, string, string]
  fallbackCoords: readonly [number, number]
}

const STORY_STEPS: StoryStepDef[] = [
  {
    text: "Most places worth seeing aren't on any map.",
    gradient: ['#162812', '#1e3a1a', '#142210', '#0a180a'],
    fallbackCoords: [43.0512, 17.4291],
  },
  {
    text: "The best ones get passed between people who've actually been there.",
    gradient: ['#0e2840', '#1a3a5a', '#122038', '#081420'],
    fallbackCoords: [45.815, 15.9819],
  },
  {
    text: 'Some gems you find. Others find you.',
    subtitle: 'Swipe through curated spots picked just for you',
    showProBadge: true,
    gradient: ['#3a1a0a', '#4a2810', '#2a1a08', '#1a1006'],
    fallbackCoords: [42.6507, 18.0944],
  },
  {
    text: 'Build your own circle of secrets.',
    subtitle: 'Create communities around what you love — local crews, dog parks, sunset chasers',
    showProBadge: true,
    gradient: ['#160a2a', '#220e3a', '#180c2e', '#0e0820'],
    fallbackCoords: [44.1194, 15.2314],
  },
  {
    text: "Going somewhere new? We'll map it out.",
    subtitle: "Tell us where you're headed — we'll surface the gems worth the detour",
    showProBadge: true,
    gradient: ['#0a1a2a', '#102238', '#0a1828', '#060e18'],
    fallbackCoords: [46.3057, 16.3366],
  },
  {
    text: 'Hidden Gems is where that happens.',
    gradient: ['#1a0e28', '#241438', '#1a102a', '#0e0818'],
    fallbackCoords: [43.5081, 16.4402],
  },
]

const WARM_CATEGORY_GRADIENT = ['#3D2817', '#1F1410'] as const
const COOL_CATEGORY_GRADIENT = ['#16332E', '#0D1F1C'] as const
const NEUTRAL_CATEGORY_GRADIENT = ['#2A2A2E', '#16161A'] as const

const CATEGORY_GRADIENTS: Record<string, readonly [string, string]> = {
  social: WARM_CATEGORY_GRADIENT,
  couples: WARM_CATEGORY_GRADIENT,
  pets: WARM_CATEGORY_GRADIENT,
  nature: COOL_CATEGORY_GRADIENT,
  views: COOL_CATEGORY_GRADIENT,
  sport: COOL_CATEGORY_GRADIENT,
  chill: COOL_CATEGORY_GRADIENT,
  family: COOL_CATEGORY_GRADIENT,
  urban: NEUTRAL_CATEGORY_GRADIENT,
  culture: NEUTRAL_CATEGORY_GRADIENT,
  hidden: NEUTRAL_CATEGORY_GRADIENT,
}

const STORY_OVERLAY_COLORS = [
  'rgba(0,0,0,0.15)',
  'transparent',
  'rgba(0,0,0,0.3)',
  'rgba(0,0,0,0.88)',
] as const

function CompassHero({ accent, accentSub, coral, background }: {
  accent: string
  accentSub: string
  coral: string
  background: string
}) {
  return (
    <View style={{ marginBottom: 24, alignItems: 'center' }}>
      <View
        style={{
          padding: 24,
          borderRadius: 72,
          backgroundColor: background,
        }}>
        <View
          style={{
            padding: 12,
            borderRadius: 60,
            backgroundColor: accentSub,
          }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              borderWidth: 2.5,
              borderColor: accent,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: background,
            }}>
            <View
              style={{
                position: 'absolute',
                top: 10,
                left: '50%',
                marginLeft: -1.5,
                width: 3,
                height: 24,
                backgroundColor: coral,
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: 10,
                left: '50%',
                marginLeft: -1.5,
                width: 3,
                height: 24,
                backgroundColor: accent,
                borderBottomLeftRadius: 2,
                borderBottomRightRadius: 2,
              }}
            />
            <View
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                marginTop: -1.5,
                height: 3,
                width: 24,
                backgroundColor: accent,
                borderTopRightRadius: 2,
                borderBottomRightRadius: 2,
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                marginTop: -1.5,
                height: 3,
                width: 24,
                backgroundColor: accent,
                borderTopLeftRadius: 2,
                borderBottomLeftRadius: 2,
              }}
            />
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: accent,
              }}
            />
          </View>
        </View>
      </View>
    </View>
  )
}

const TRIAL_FEATURES = [
  'Gem Swipe',
  'Unlimited drops',
  'Trip Planner',
  'Private pins',
  'Communities',
  'No ads',
  'Custom categories',
  'Hidden Gems cat.',
] as const

const TRIAL_HERO_GRADIENT_RAD = ((160 - 90) * Math.PI) / 180
const TRIAL_HERO_GRADIENT_START = {
  x: 0.5 - Math.cos(TRIAL_HERO_GRADIENT_RAD) * 0.5,
  y: 0.5 - Math.sin(TRIAL_HERO_GRADIENT_RAD) * 0.5,
}
const TRIAL_HERO_GRADIENT_END = {
  x: 0.5 + Math.cos(TRIAL_HERO_GRADIENT_RAD) * 0.5,
  y: 0.5 + Math.sin(TRIAL_HERO_GRADIENT_RAD) * 0.5,
}

function TrialHeroGlow() {
  return (
    <View style={trialHeroGlowStyle} pointerEvents="none">
      <Svg width={200} height={200}>
        <Defs>
          <RadialGradient id="trialHeroGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="rgba(45,212,191,0.18)" />
            <Stop offset="70%" stopColor="rgba(45,212,191,0)" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="200" height="200" fill="url(#trialHeroGlow)" />
      </Svg>
    </View>
  )
}

const trialHeroGlowStyle = {
  position: 'absolute' as const,
  top: -20,
  alignSelf: 'center' as const,
  width: 200,
  height: 200,
}

function TrialCompass({ accent, coral }: { accent: string; coral: string }) {
  return (
    <View
      style={{
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: accent,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
      }}>
      <View
        style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          marginLeft: -1,
          width: 2,
          height: 16,
          backgroundColor: coral,
          borderTopLeftRadius: 1,
          borderTopRightRadius: 1,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          marginLeft: -1,
          width: 2,
          height: 16,
          backgroundColor: accent,
          borderBottomLeftRadius: 1,
          borderBottomRightRadius: 1,
        }}
      />
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: accent,
        }}
      />
    </View>
  )
}

type Gem = {
  id: string
  image_url: string | null
  category: string
  latitude?: number
  longitude?: number
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
  const [welcomeGpsCoords, setWelcomeGpsCoords] = useState<{
    latitude: number
    longitude: number
  } | null>(null)

  const fadeAnim = useRef(new Animated.Value(1)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const cardScale = useRef(new Animated.Value(1)).current
  const kenBurnsAnim = useRef(new Animated.Value(1)).current
  const storyTextAnim = useRef(new Animated.Value(0)).current
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
    if (step === 6 || step === 9 || step === 10 || step === 11) return
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
        if (stepRef.current > 5) return false
        return Math.abs(g.dx) > 24 && Math.abs(g.dy) < 40
      },
      onPanResponderRelease: (_, g) => {
        if (stepRef.current > 5) return
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
        .select('id, image_url, category, latitude, longitude')
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .limit(10)

      if (gems && gems.length > 0) {
        const sorted = await sortGemsByLikes(gems as Gem[])
        setTrendingGems(sorted.slice(0, 6))
      }

      const catMap: Record<string, Gem | null> = {}
      await Promise.all(
        CATEGORIES.map(async (cat) => {
          const { data: catGems } = await supabase
            .from('gems')
            .select('id, image_url, category, latitude, longitude')
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
    if (step !== 9) return

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
    if (step !== 12) return

    let cancelled = false
    const loadWelcomeCoords = async () => {
      const coords = await getCurrentCoordinates()
      if (!cancelled && coords) {
        setWelcomeGpsCoords(coords)
      }
    }
    loadWelcomeCoords()
    return () => {
      cancelled = true
    }
  }, [step])

  useEffect(() => {
    if (step !== 10 || prefsSaved) return

    const save = async () => {
      await savePreferences(userId, buildPrefs())
      setPrefsSaved(true)
    }
    save()

    const timer = setTimeout(() => animateStepChange(11), 1800)
    return () => clearTimeout(timer)
  }, [step, prefsSaved, userId, buildPrefs, animateStepChange])

  useEffect(() => {
    if (step > 5) return
    kenBurnsAnim.setValue(1)
    Animated.timing(kenBurnsAnim, {
      toValue: 1.08,
      duration: 12000,
      useNativeDriver: true,
    }).start()
  }, [step, kenBurnsAnim])

  useEffect(() => {
    if (step > 5) return
    storyTextAnim.setValue(20)
    Animated.spring(storyTextAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start()
  }, [step, storyTextAnim])

  useEffect(() => {
    if (step !== 10) return
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
    setTimeout(() => animateStepChange(8), 300)
  }

  const selectDiscover = (style: 'solo' | 'social') => {
    setDiscoverStyle(style)
    Animated.sequence([
      Animated.spring(cardScale, { toValue: 1.05, useNativeDriver: true, friction: 4 }),
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start()
    setTimeout(() => animateStepChange(9), 300)
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
    animateStepChange(10)
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
    hapticSuccess()
    animateStepChange(12)
  }

  const finishOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true')
    if (userId) {
      router.replace('/follow-suggestions')
    } else {
      router.replace('/auth')
    }
  }

  const showSkip = !loading && step < 11
  const showStoryDots = !loading && step <= 5
  const tapToAdvance = !loading && step < 6

  const goToStoryStep = (next: number) => {
    if (next < 0 || next >= STORY_STEP_COUNT) return
    animateStepChange(next)
  }

  const renderStoryStep = (index: number) => {
    const story = STORY_STEPS[index]
    const gem =
      trendingGems.length > 0 ? trendingGems[index % trendingGems.length] : undefined
    const coordLabel = formatCoordinates(story.fallbackCoords[0], story.fallbackCoords[1])

    return (
      <View style={styles.storyContainer}>
        <Animated.View
          style={[styles.storyBackground, { transform: [{ scale: kenBurnsAnim }] }]}>
          <LinearGradient
            colors={[...story.gradient]}
            locations={[0, 0.3, 0.6, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {gem?.image_url ? (
            <Image
              source={{ uri: gem.image_url }}
              style={styles.storyImageOverlay}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : null}
        </Animated.View>

        <LinearGradient
          colors={[...STORY_OVERLAY_COLORS]}
          locations={[0, 0.3, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {story.showProBadge && (
          <View style={styles.storyProBadge}>
            <Text style={styles.storyProBadgeEmoji}>💎</Text>
            <Text style={styles.storyProBadgeText}>PRO</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.storyNavButton, styles.storyNavPrev, index === 0 && styles.storyNavDisabled]}
          onPress={() => goToStoryStep(index - 1)}
          activeOpacity={0.8}
          disabled={index === 0}>
          <Ionicons
            name="chevron-back"
            size={18}
            color={index === 0 ? 'rgba(234,246,244,0.3)' : '#EAF6F4'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.storyNavButton, styles.storyNavNext]}
          onPress={() => goToStoryStep(index + 1)}
          activeOpacity={0.8}
          disabled={index >= STORY_STEP_COUNT - 1}>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={index >= STORY_STEP_COUNT - 1 ? 'rgba(234,246,244,0.3)' : '#EAF6F4'}
          />
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.storyTextWrap,
            { transform: [{ translateY: storyTextAnim }], opacity: fadeAnim },
          ]}>
          <Text style={styles.storyCoordWatermark}>{coordLabel}</Text>
          <Text style={styles.storyText}>{story.text}</Text>
          {story.subtitle ? <Text style={styles.storySubtitle}>{story.subtitle}</Text> : null}
        </Animated.View>
      </View>
    )
  }

  const renderCategoryCard = (cat: (typeof CATEGORIES)[number]) => {
    const gem = categoryGems[cat.id]
    const selected = selectedCategories.includes(cat.id)
    const gradient = CATEGORY_GRADIENTS[cat.id] ?? NEUTRAL_CATEGORY_GRADIENT

    return (
      <TouchableOpacity
        key={cat.id}
        style={[styles.categoryCard, selected && styles.categoryCardSelected]}
        onPress={() => toggleCategory(cat.id)}
        activeOpacity={0.85}>
        {gem?.image_url ? (
          <Image
            source={{ uri: gem.image_url }}
            style={styles.categoryCardImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <LinearGradient
            colors={[gradient[0], gradient[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          style={styles.categoryCardGradient}
        />
        <View style={styles.categoryCardLabel}>
          <Ionicons name={cat.icon as keyof typeof Ionicons.glyphMap} size={16} color="#FFFFFF" />
          <Text style={styles.categoryCardName}>{cat.name}</Text>
        </View>
        {selected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={14} color={theme.accentText} />
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
            <Image
              source={{ uri: gem.image_url }}
              style={styles.exploreCardImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
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

    if (step <= 5) return renderStoryStep(step)

    if (step === 6) {
      return (
        <View style={styles.prefsContainer}>
          <View style={styles.prefsTitleRow}>
            <Text style={styles.prefsTitle}>What calls to you?</Text>
            <View style={styles.prefsCountBadge}>
              <Text style={styles.prefsCountText}>{selectedCategories.length}</Text>
            </View>
          </View>
          <Text style={styles.prefsSubtitle}>Pick as many as you like</Text>
          <ScrollView
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryGrid}
            showsVerticalScrollIndicator={false}>
            {CATEGORIES.map((cat) => renderCategoryCard(cat))}
          </ScrollView>
          <TouchableOpacity
            style={[
              styles.continueButton,
              selectedCategories.length === 0 && styles.categoryContinueButtonDisabled,
            ]}
            disabled={selectedCategories.length === 0}
            onPress={() => animateStepChange(7)}
            activeOpacity={selectedCategories.length === 0 ? 1 : 0.8}>
            <Text
              style={[
                styles.continueButtonText,
                selectedCategories.length === 0 && styles.categoryContinueButtonTextDisabled,
              ]}>
              {selectedCategories.length > 0
                ? `Continue (${selectedCategories.length})`
                : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      )
    }

    if (step === 7) {
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

    if (step === 8) {
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

    if (step === 9) {
      return (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}>
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
        </KeyboardAvoidingView>
      )
    }

    if (step === 10) {
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

    if (step === 11) {
      return (
        <View style={styles.trialScreen}>
          <LinearGradient
            colors={['#0B2E2B', '#142B2E', '#1C3438']}
            locations={[0, 0.4, 1]}
            start={TRIAL_HERO_GRADIENT_START}
            end={TRIAL_HERO_GRADIENT_END}
            style={styles.trialHero}>
            <TrialHeroGlow />
            <TrialCompass accent={theme.accent} coral={theme.coral} />
            <View style={styles.trialFreeBadge}>
              <Text style={styles.trialFreeBadgeText}>3 DAYS FREE</Text>
            </View>
          </LinearGradient>

          <ScrollView
            contentContainerStyle={styles.trialBody}
            showsVerticalScrollIndicator={false}>
            <Text style={styles.trialTitle}>Try Hidden Gems Premium</Text>
            <Text style={styles.trialPricing}>
              €0 today · €5.99/month after · cancel anytime
            </Text>

            <View style={styles.trialFeatureGrid}>
              {TRIAL_FEATURES.map((feature) => (
                <View key={feature} style={styles.trialFeatureItem}>
                  <View style={styles.trialFeatureCheck}>
                    <Text style={[styles.trialFeatureCheckMark, { color: theme.accent }]}>
                      ✓
                    </Text>
                  </View>
                  <Text style={styles.trialFeatureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.trialButton} onPress={startTrial} activeOpacity={0.8}>
              <Text style={styles.trialButtonText}>Start Free Trial</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => animateStepChange(12)} activeOpacity={0.7}>
              <Text style={styles.maybeLater}>Maybe later</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )
    }

    return (
      <View style={styles.centered}>
        <CompassHero
          accent={theme.accent}
          accentSub={theme.accentSub}
          coral={theme.coral}
          background={theme.background}
        />
        <Text style={styles.welcomeLabel}>WELCOME, EXPLORER</Text>
        <Text style={styles.finalHeadline}>Your adventure starts here.</Text>
        {welcomeGpsCoords ? (
          <Text style={styles.welcomeCoords}>
            {formatCoordinates(welcomeGpsCoords.latitude, welcomeGpsCoords.longitude)}
          </Text>
        ) : null}
        <Text style={styles.finalSubtitle}>
          Your feed is ready. Start discovering the places most people will never find.
        </Text>
        <TouchableOpacity
          style={styles.finalButton}
          onPress={finishOnboarding}
          activeOpacity={0.8}>
          <Text style={styles.trialButtonText}>Start Exploring →</Text>
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
      {showStoryDots && (
        <View style={styles.storyDots}>
          {Array.from({ length: STORY_STEPS.length }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.storyDot,
                { backgroundColor: i === step ? '#EAF6F4' : 'rgba(255,255,255,0.3)' },
              ]}
            />
          ))}
        </View>
      )}

      {showSkip && (
        <TouchableOpacity style={styles.skipButton} onPress={completeWithDefaults} activeOpacity={0.7}>
          <Text style={[styles.skipText, step <= 5 && styles.skipTextOnStory]}>Skip</Text>
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
    storyDots: {
      position: 'absolute',
      top: 68,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      zIndex: 10,
    },
    storyDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    skipButton: {
      position: 'absolute',
      top: 50,
      right: 16,
      zIndex: 10,
      padding: 4,
    },
    skipText: {
      color: theme.textSecondary,
      fontSize: 13,
    },
    skipTextOnStory: {
      color: 'rgba(255,255,255,0.55)',
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
      backgroundColor: '#0B1A1C',
    },
    storyBackground: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    storyImageOverlay: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.35,
    },
    storyProBadge: {
      position: 'absolute',
      top: 88,
      left: 20,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderColor: theme.coral,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      zIndex: 5,
    },
    storyProBadgeEmoji: {
      fontSize: 11,
    },
    storyProBadgeText: {
      color: theme.coral,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    storyNavButton: {
      position: 'absolute',
      bottom: 120,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 6,
    },
    storyNavPrev: {
      left: 16,
    },
    storyNavNext: {
      right: 16,
    },
    storyNavDisabled: {
      opacity: 0.3,
    },
    storyTextWrap: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 24,
      paddingBottom: 54,
      zIndex: 5,
    },
    storyCoordWatermark: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: 'rgba(255,255,255,0.38)',
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    storyText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 26,
      color: '#EAF6F4',
      lineHeight: 34,
    },
    storySubtitle: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.72)',
      marginTop: 10,
      lineHeight: 20,
    },
    prefsContainer: {
      flex: 1,
      paddingTop: 72,
    },
    prefsTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 24,
    },
    prefsCountBadge: {
      backgroundColor: theme.accentSub,
      borderWidth: 1,
      borderColor: theme.accent,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    prefsCountText: {
      fontFamily: 'SpaceMono-Bold',
      fontSize: 11,
      color: theme.accent,
    },
    categoryScroll: {
      flex: 1,
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
      height: 64,
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
    categoryContinueButtonDisabled: {
      backgroundColor: theme.bgTertiary,
      borderWidth: 0.5,
      borderColor: theme.border,
    },
    continueButtonText: {
      color: theme.accentText,
      fontSize: 16,
      fontWeight: '700',
    },
    categoryContinueButtonTextDisabled: {
      color: theme.textTertiary,
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
      backgroundColor: theme.accentSub,
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
    trialScreen: {
      flex: 1,
    },
    trialHero: {
      height: 140,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      overflow: 'hidden',
      position: 'relative',
    },
    trialFreeBadge: {
      backgroundColor: theme.coral,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 5,
      zIndex: 1,
    },
    trialFreeBadgeText: {
      fontFamily: 'SpaceMono-Bold',
      fontSize: 12,
      color: '#0A1F1C',
      letterSpacing: 1,
    },
    trialBody: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 32,
    },
    trialTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 22,
      color: theme.text,
      textAlign: 'center',
      marginBottom: 5,
    },
    trialPricing: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 11,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 18,
    },
    trialFeatureGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 16,
      rowGap: 8,
      marginBottom: 20,
    },
    trialFeatureItem: {
      width: (SCREEN_WIDTH - 40 - 16) / 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    trialFeatureCheck: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.accentSub,
      borderWidth: 1,
      borderColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trialFeatureCheckMark: {
      fontSize: 10,
      fontWeight: '700',
      lineHeight: 12,
    },
    trialFeatureText: {
      flex: 1,
      fontFamily: 'SpaceGrotesk-Regular',
      fontSize: 13,
      color: theme.text,
    },
    trialButton: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 12,
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
    welcomeLabel: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: theme.accent,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    finalHeadline: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 28,
      color: theme.text,
      textAlign: 'center',
      lineHeight: 34,
      marginBottom: 8,
    },
    welcomeCoords: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 11,
      color: theme.accent,
      marginBottom: 8,
    },
    finalSubtitle: {
      fontFamily: 'SpaceGrotesk-Regular',
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: 36,
      maxWidth: 280,
    },
    finalButton: {
      alignSelf: 'stretch',
      backgroundColor: theme.accent,
      borderRadius: 14,
      padding: 18,
      marginHorizontal: 16,
      alignItems: 'center',
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 6,
    },
  })
