import { PressableScale } from '@/components/PressableScale'
import { ModalEntryWrapper } from '@/components/ModalEntryWrapper'
import { CATEGORIES } from '@/lib/categories'
import { checkIsPremium } from '@/lib/paywall'
import { useTheme } from '@/lib/ThemeContext'
import type { Theme } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
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
type JoinType = 'open' | 'invite_only'

const isIconName = (value: string): value is IconName =>
  (ICON_OPTIONS as readonly string[]).includes(value)

export default function CreateCommunityScreen() {
  const { theme } = useTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const router = useRouter()
  const { communityId: communityIdParam } = useLocalSearchParams<{ communityId?: string }>()
  const editCommunityId = Array.isArray(communityIdParam) ? communityIdParam[0] : communityIdParam
  const isEditMode = !!editCommunityId

  const [checkingPremium, setCheckingPremium] = useState(!isEditMode)
  const [loadingCommunity, setLoadingCommunity] = useState(isEditMode)
  const [isPremium, setIsPremium] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [locationFocus, setLocationFocus] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].id)
  const [selectedIcon, setSelectedIcon] = useState<IconName>('people')
  const [selectedColor, setSelectedColor] = useState(theme.accent)
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [joinType, setJoinType] = useState<JoinType>('open')
  const [submitting, setSubmitting] = useState(false)

  const previewColor = selectedColor || theme.accent

  const colorOptions = useMemo(
    () => [theme.accent, theme.coral, '#7F77DD', '#E24B4A', '#378ADD', '#BA7517'],
    [theme.accent, theme.coral],
  )

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (isEditMode && editCommunityId) {
        setLoadingCommunity(true)

        if (!user) {
          setLoadingCommunity(false)
          Alert.alert('Error', 'You must be logged in to edit a community.', [
            { text: 'OK', onPress: () => router.back() },
          ])
          return
        }

        setUserId(user.id)

        const { data: community, error } = await supabase
          .from('communities')
          .select(
            'id, creator_id, name, description, location_focus, category, icon, color, visibility, join_type',
          )
          .eq('id', editCommunityId)
          .single()

        if (error || !community) {
          setLoadingCommunity(false)
          Alert.alert('Error', 'Could not load this community.', [
            { text: 'OK', onPress: () => router.back() },
          ])
          return
        }

        if (community.creator_id !== user.id) {
          setLoadingCommunity(false)
          Alert.alert('Error', 'You can only edit communities you created.', [
            { text: 'OK', onPress: () => router.back() },
          ])
          return
        }

        setName(community.name ?? '')
        setDescription(community.description ?? '')
        setLocationFocus(community.location_focus ?? '')

        const categoryExists = CATEGORIES.some((cat) => cat.id === community.category)
        setSelectedCategory(
          categoryExists && community.category ? community.category : CATEGORIES[0].id,
        )

        setSelectedIcon(
          community.icon && isIconName(community.icon) ? community.icon : 'people',
        )
        setSelectedColor(community.color ?? theme.accent)

        const nextVisibility: Visibility =
          community.visibility === 'private' ? 'private' : 'public'
        setVisibility(nextVisibility)

        const nextJoinType: JoinType =
          community.join_type === 'invite_only' ? 'invite_only' : 'open'
        setJoinType(nextVisibility === 'private' ? 'invite_only' : nextJoinType)

        setLoadingCommunity(false)
        return
      }

      setCheckingPremium(true)
      const premium = await checkIsPremium()
      setIsPremium(premium)
      setCheckingPremium(false)

      if (!premium) return

      if (user) setUserId(user.id)
    }

    init()
  }, [editCommunityId, isEditMode, router, theme.accent])

  const handleVisibilityChange = (next: Visibility) => {
    setVisibility(next)
    if (next === 'public') {
      setJoinType('open')
    } else {
      setJoinType('invite_only')
    }
  }

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a community name.')
      return false
    }
    return true
  }

  const buildCommunityPayload = () => {
    const resolvedJoinType: JoinType = visibility === 'private' ? 'invite_only' : joinType

    return {
      name: name.trim(),
      description: description.trim() || null,
      location_focus: locationFocus.trim() || null,
      category: selectedCategory,
      icon: selectedIcon,
      color: selectedColor,
      visibility,
      join_type: resolvedJoinType,
    }
  }

  const handleSaveEdit = async () => {
    if (!userId || !editCommunityId || !validateForm()) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('communities')
        .update(buildCommunityPayload())
        .eq('id', editCommunityId)

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      router.replace('/community/' + editCommunityId)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    if (!userId || !validateForm()) return

    setSubmitting(true)
    try {
      const { data: community, error } = await supabase
        .from('communities')
        .insert({
          creator_id: userId,
          ...buildCommunityPayload(),
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
        status: 'accepted',
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

  if (isEditMode && loadingCommunity) {
    return (
      <ModalEntryWrapper>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        </SafeAreaView>
      </ModalEntryWrapper>
    )
  }

  if (checkingPremium) {
    return (
      <ModalEntryWrapper>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
      </ModalEntryWrapper>
    )
  }

  if (!isEditMode && !isPremium) {
    return (
      <ModalEntryWrapper>
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
      </ModalEntryWrapper>
    )
  }

  return (
    <ModalEntryWrapper>
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {isEditMode ? (
          <>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerAction}>
              <Text style={styles.headerActionText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Community</Text>
            <TouchableOpacity
              onPress={handleSaveEdit}
              activeOpacity={0.7}
              style={styles.headerAction}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={theme.accent} size="small" />
              ) : (
                <Text style={[styles.headerActionText, styles.headerSaveText]}>Save</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
              <Ionicons name="arrow-back" size={22} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Community</Text>
            <View style={styles.headerSide} />
          </>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.coverPreview}>
          <View style={[styles.coverIconCircle, { backgroundColor: previewColor }]}>
            <Ionicons
              name={selectedIcon as keyof typeof Ionicons.glyphMap}
              size={32}
              color="#FFFFFF"
            />
          </View>
          <Text style={styles.coverName} numberOfLines={2}>
            {name.trim() || 'Community name'}
          </Text>
        </View>

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
            onPress={() => handleVisibilityChange('public')}
            activeOpacity={0.8}>
            <Ionicons name="globe" size={22} color={theme.accent} />
            <Text style={styles.visibilityTitle}>Public</Text>
            <Text style={styles.visibilitySubtitle}>Visible in Discover for everyone to join</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.visibilityCard, visibility === 'private' && { borderColor: theme.accent }]}
            onPress={() => handleVisibilityChange('private')}
            activeOpacity={0.8}>
            <Ionicons name="lock-closed" size={22} color={theme.accent} />
            <Text style={styles.visibilityTitle}>Private</Text>
            <Text style={styles.visibilitySubtitle}>Hidden from Discover, joinable via direct link</Text>
          </TouchableOpacity>
        </View>

        {visibility === 'public' ? (
          <>
            <Text style={styles.fieldLabel}>Who can join</Text>
            <View style={styles.visibilityRow}>
              <TouchableOpacity
                style={[styles.visibilityCard, joinType === 'open' && { borderColor: theme.accent }]}
                onPress={() => setJoinType('open')}
                activeOpacity={0.8}>
                <Ionicons name="enter-outline" size={22} color={theme.accent} />
                <Text style={styles.visibilityTitle}>Open</Text>
                <Text style={styles.visibilitySubtitle}>Anyone can join instantly</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.visibilityCard, joinType === 'invite_only' && { borderColor: theme.accent }]}
                onPress={() => setJoinType('invite_only')}
                activeOpacity={0.8}>
                <Ionicons name="mail-unread-outline" size={22} color={theme.accent} />
                <Text style={styles.visibilityTitle}>Invite only</Text>
                <Text style={styles.visibilitySubtitle}>You approve each join request</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {!isEditMode ? (
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
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </ModalEntryWrapper>
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
    headerAction: {
      minWidth: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerActionText: {
      fontSize: 15,
      color: theme.textSecondary,
    },
    headerSaveText: {
      color: theme.accent,
      fontWeight: '600',
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
    coverPreview: {
      alignItems: 'center',
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 16,
      paddingVertical: 24,
      paddingHorizontal: 16,
      marginTop: 8,
      gap: 12,
    },
    coverIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coverName: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 20,
      color: theme.text,
      textAlign: 'center',
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
