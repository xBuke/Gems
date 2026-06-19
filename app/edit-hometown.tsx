import { searchCities } from '@/lib/cityAutocomplete'
import { useTheme } from '@/lib/ThemeContext'
import type { Theme } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type CitySuggestion = { name: string; lat: number; lng: number }

export default function EditHomeTownScreen() {
  const { theme } = useTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [cityQuery, setCityQuery] = useState('')
  const [selectedLat, setSelectedLat] = useState<number | null>(null)
  const [selectedLng, setSelectedLng] = useState<number | null>(null)
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.back()
        return
      }

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('home_town, home_lat, home_lng')
        .eq('id', user.id)
        .single()

      if (profile) {
        setCityQuery(profile.home_town ?? '')
        setSelectedLat(profile.home_lat ?? null)
        setSelectedLng(profile.home_lng ?? null)
      }

      setLoading(false)
    }
    load()
  }, [router])

  const handleCityInput = useCallback((text: string) => {
    setCityQuery(text)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (text.length < 2) {
      setShowSuggestions(false)
      setCitySuggestions([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      const results = await searchCities(text)
      setCitySuggestions(results)
      setShowSuggestions(results.length > 0)
    }, 400)
  }, [])

  const selectCity = (city: CitySuggestion) => {
    setCityQuery(city.name)
    setSelectedLat(city.lat)
    setSelectedLng(city.lng)
    setShowSuggestions(false)
    setCitySuggestions([])
  }

  const handleSave = async () => {
    const trimmed = cityQuery.trim()
    if (!trimmed || !userId) return

    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        home_town: trimmed,
        home_lat: selectedLat,
        home_lng: selectedLng,
      })
      .eq('id', userId)

    setSaving(false)

    if (error) {
      Alert.alert('Error', 'Could not update home town')
      return
    }

    router.back()
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Home Town</Text>
        <View style={styles.headerSide} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.subtitle}>Enter your city so we can recognize you as a local</Text>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={cityQuery}
              onChangeText={handleCityInput}
              placeholder="Your city"
              placeholderTextColor={theme.textSecondary}
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

          <TouchableOpacity
            style={[styles.saveButton, (!cityQuery.trim() || saving) && styles.saveButtonDisabled]}
            disabled={!cityQuery.trim() || saving}
            onPress={handleSave}
            activeOpacity={0.8}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.accentText} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
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
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 20,
    },
    inputWrap: {
      zIndex: 10,
      position: 'relative',
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
    saveButton: {
      position: 'absolute',
      bottom: 24,
      left: 16,
      right: 16,
      backgroundColor: theme.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    saveButtonDisabled: {
      backgroundColor: theme.border,
      opacity: 0.6,
    },
    saveButtonText: {
      color: theme.accentText,
      fontSize: 16,
      fontWeight: '700',
    },
  })
