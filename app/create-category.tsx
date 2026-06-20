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
] as const

type IconName = (typeof ICON_OPTIONS)[number]
type Visibility = 'private' | 'public'

export default function CreateCategoryScreen() {
  const { theme } = useTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const router = useRouter()

  const [checkingPremium, setCheckingPremium] = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState<IconName>('paw')
  const [selectedColor, setSelectedColor] = useState(theme.accent)
  const [visibility, setVisibility] = useState<Visibility>('private')
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

      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }

    init()
  }, [])

  const handleSubmit = async () => {
    if (!userId) return

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a category name.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.from('custom_categories').insert({
        creator_id: userId,
        name: name.trim(),
        icon: selectedIcon,
        color: selectedColor,
        visibility,
      })

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      Alert.alert('Category created!', undefined, [{ text: 'OK', onPress: () => router.back() }])
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
          <Text style={styles.headerTitle}>New Category</Text>
          <View style={styles.headerSide} />
        </View>
        <View style={styles.premiumPrompt}>
          <Ionicons name="diamond" size={56} color={theme.coral} />
          <Text style={styles.premiumTitle}>Custom Categories are Premium</Text>
          <Text style={styles.premiumSubtitle}>
            Create your own categories to organize gems your way
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
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Category</Text>
        <View style={styles.headerSide} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Category name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Dog Parks, Climbing Spots"
          placeholderTextColor={theme.textTertiary}
          value={name}
          onChangeText={setName}
          maxLength={30}
        />

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
            style={[styles.visibilityCard, visibility === 'private' && { borderColor: theme.accent }]}
            onPress={() => setVisibility('private')}
            activeOpacity={0.8}>
            <Ionicons name="lock-closed" size={22} color={theme.accent} />
            <Text style={styles.visibilityTitle}>Private</Text>
            <Text style={styles.visibilitySubtitle}>
              Only your followers can see and add to it
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.visibilityCard, visibility === 'public' && { borderColor: theme.accent }]}
            onPress={() => setVisibility('public')}
            activeOpacity={0.8}>
            <Ionicons name="globe" size={22} color={theme.accent} />
            <Text style={styles.visibilityTitle}>Public</Text>
            <Text style={styles.visibilitySubtitle}>
              Everyone can see it, only Premium members can add gems
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}>
          {submitting ? (
            <ActivityIndicator color={theme.accentText} />
          ) : (
            <Text style={styles.submitButtonText}>Create Category</Text>
          )}
        </TouchableOpacity>
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
