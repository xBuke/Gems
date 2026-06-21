import { PressableScale } from '@/components/PressableScale'
import { CATEGORIES } from '@/lib/categories'
import { checkIsPremium } from '@/lib/paywall'
import { useTheme } from '@/lib/ThemeContext'
import type { Theme } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const ICON_OPTIONS = [
  'paw',
  'fitness',
  'bicycle',
  'water',
  'restaurant',
  'moon',
  'flame',
  'snow',
  'leaf',
  'diamond',
  'star',
  'heart',
  'people',
] as const

type IconName = (typeof ICON_OPTIONS)[number]
type Visibility = 'private' | 'public'

export default function CreateCommunityScreen() {
  const { theme } = useTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const router = useRouter()

  const [checkingPremium, setCheckingPremium] = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [locationFocus, setLocationFocus] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].id)
  const [selectedIcon, setSelectedIcon] = useState<IconName>('people')
  const [selectedColor, setSelectedColor] = useState(theme.accent)
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [submitting, setSubmitting] = useState(false)

  const colorOptions = useMemo(
    () => [theme.accent, theme.coral, '#7F77DD', '#E24B4A', '#378ADD', '#BA7517'],
    [theme.accent, theme.coral],
  )

  useEffect(() => {
    const init = async () => {
      setCheckingPremium(true)
      const premium = await checkIsPremium()
      setIsPremium(premium)
      setCheckingPremium(false)

      if (!premium) return

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }

    init()
  }, [])

  const handleSubmit = async () => {
    if (!userId) return

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a community name.')
      return
    }

    setSubmitting(true)
    try {
      const { data: community, error } = await supabase
        .from('communities')
        .insert({
          creator_id: userId,
          name: name.trim(),
          description: description.trim() || null,
          location_focus: locationFocus.trim() || null,
          category: selectedCategory,
          icon: selectedIcon,
          color: selectedColor,
          visibility,
        })
        .select('id')
        .single()

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      const { error: memberError } = await supabase.from('community_members').insert({
        user_id: userId,
        community_id: community.id,
      })

      if (memberError) {
        Alert.alert('Error', memberError.message)
        return
      }

      router.replace('/community/' + community.id)
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingPremium) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    )
  }

  if (!isPremium) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Community</Text>
          <View style={styles.headerSide} />
        </View>
        <View style={styles.premiumPrompt}>
          <Ionicons name="diamond" size={56} color={theme.coral} />
          <Text style={styles.premiumTitle}>Communities are Premium</Text>
          <Text style={styles.premiumSubtitle}>
            Create and manage your own communities to connect with fellow explorers
          </Text>
          <PressableScale
            style={[styles.upgradeButton, { backgroundColor: theme.accent }]}
            onPress={() => router.push('/paywall')}>
            <Text style={[styles.upgradeButtonText, { color: theme.accentText }]}>
              Upgrade to Premium
            </Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Community</Text>
        <View style={styles.headerSide} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Community name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Zagreb Skaters"
          placeholderTextColor={theme.textTertiary}
          value={name}
          onChangeText={setName}
          maxLength={40}
        />

        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What's this community about?"
          placeholderTextColor={theme.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          maxLength={300}
        />

        <Text style={styles.fieldLabel}>Location focus (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Zagreb, Dalmatia"
          placeholderTextColor={theme.textTertiary}
          value={locationFocus}
          onChangeText={setLocationFocus}
        />

        <Text style={styles.fieldLabel}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  isSelected && { backgroundColor: cat.color, borderColor: cat.color },
                ]}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.7}>
                <Ionicons
                  name={cat.icon as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={isSelected ? '#FFFFFF' : theme.textSecondary}
                />
                <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        <Text style={styles.fieldLabel}>Icon</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.iconRow}>
          {ICON_OPTIONS.map((icon) => {
            const isSelected = selectedIcon === icon
            return (
              <TouchableOpacity
                key={icon}
                style={[styles.iconOption, isSelected && { borderColor: theme.accent }]}
                onPress={() => setSelectedIcon(icon)}
                activeOpacity={0.7}>
                <Ionicons
                  name={icon as keyof typeof Ionicons.glyphMap}
                  size={24}
                  color={isSelected ? theme.accent : theme.textSecondary}
                />
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        <Text style={styles.fieldLabel}>Color</Text>
        <View style={styles.colorRow}>
          {colorOptions.map((color) => {
            const isSelected = selectedColor === color
            return (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color },
                  isSelected && { borderColor: theme.text, borderWidth: 3 },
                ]}
                onPress={() => setSelectedColor(color)}
                activeOpacity={0.7}
              />
            )
          })}
        </View>

        <Text style={styles.fieldLabel}>Visibility</Text>
        <View style={styles.visibilityRow}>
          <TouchableOpacity
            style={[styles.visibilityCard, visibility === 'public' && { borderColor: theme.accent }]}
            onPress={() => setVisibility('public')}
            activeOpacity={0.8}>
            <Ionicons name="globe" size={22} color={theme.accent} />
            <Text style={styles.visibilityTitle}>Public</Text>
            <Text style={styles.visibilitySubtitle}>Visible in Discover for everyone to join</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.visibilityCard, visibility === 'private' && { borderColor: theme.accent }]}
            onPress={() => setVisibility('private')}
            activeOpacity={0.8}>
            <Ionicons name="lock-closed" size={22} color={theme.accent} />
            <Text style={styles.visibilityTitle}>Private</Text>
            <Text style={styles.visibilitySubtitle}>Hidden from Discover, joinable via direct link</Text>
          </TouchableOpacity>
        </View>

        <PressableScale
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={theme.accentText} />
          ) : (
            <Text style={styles.submitButtonText}>Create Community</Text>
          )}
        </PressableScale>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
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
      fontSize: 17,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.text,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    fieldLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '500',
      marginBottom: 6,
      marginTop: 16,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 14,
      fontSize: 15,
      color: theme.text,
    },
    textArea: {
      minHeight: 90,
      paddingTop: 14,
    },
    categoryRow: {
      gap: 10,
      paddingVertical: 4,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    categoryChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    categoryChipTextSelected: {
      color: '#FFFFFF',
    },
    iconRow: {
      gap: 10,
      paddingVertical: 4,
    },
    iconOption: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.card,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorRow: {
      flexDirection: 'row',
      gap: 12,
      paddingVertical: 4,
    },
    colorSwatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    visibilityRow: {
      flexDirection: 'row',
      gap: 10,
    },
    visibilityCard: {
      flex: 1,
      backgroundColor: theme.card,
      borderWidth: 2,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 14,
      gap: 6,
    },
    visibilityTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 14,
      color: theme.text,
    },
    visibilitySubtitle: {
      fontSize: 11,
      color: theme.textSecondary,
      lineHeight: 16,
    },
    submitButton: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
      marginTop: 24,
    },
    submitButtonText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 16,
      color: theme.accentText,
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
  })
