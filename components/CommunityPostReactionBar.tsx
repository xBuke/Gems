import {
  REACTION_EMOJI,
  REACTION_TYPES,
  type ReactionSummary,
  type ReactionType,
} from '@/lib/communityPosts'
import { hapticLight } from '@/lib/haptics'
import { useTheme } from '@/lib/ThemeContext'
import type { Theme } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'
import { useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

type CommunityPostReactionBarProps = {
  summary: ReactionSummary
  myReaction: ReactionType | null
  onReact: (type: ReactionType) => void
  disabled?: boolean
}

export function CommunityPostReactionBar({
  summary,
  myReaction,
  onReact,
  disabled = false,
}: CommunityPostReactionBarProps) {
  const { theme } = useTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const [pickerOpen, setPickerOpen] = useState(false)

  const visibleTypes = REACTION_TYPES.filter((type) => summary[type] > 0)

  const handleReact = (type: ReactionType) => {
    hapticLight()
    onReact(type)
    setPickerOpen(false)
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {visibleTypes.map((type) => {
          const isMine = myReaction === type
          return (
            <TouchableOpacity
              key={type}
              style={[styles.reactionButton, isMine && styles.reactionButtonActive]}
              onPress={() => handleReact(type)}
              activeOpacity={0.7}
              disabled={disabled}>
              <Text style={styles.reactionEmoji}>{REACTION_EMOJI[type]}</Text>
              <Text style={styles.reactionCount}>{summary[type]}</Text>
            </TouchableOpacity>
          )
        })}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setPickerOpen((open) => !open)}
          activeOpacity={0.7}
          disabled={disabled}>
          <Ionicons
            name={pickerOpen ? 'close' : 'add'}
            size={14}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      </View>
      {pickerOpen ? (
        <View style={styles.pickerRow}>
          {REACTION_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.pickerButton,
                myReaction === type && styles.reactionButtonActive,
              ]}
              onPress={() => handleReact(type)}
              activeOpacity={0.7}
              disabled={disabled}>
              <Text style={styles.pickerEmoji}>{REACTION_EMOJI[type]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      gap: 8,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    reactionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.bgTertiary,
      borderRadius: 20,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    reactionButtonActive: {
      borderColor: theme.accent,
    },
    reactionEmoji: {
      fontSize: 12,
    },
    reactionCount: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: theme.textSecondary,
    },
    addButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.bgTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    pickerButton: {
      backgroundColor: theme.bgTertiary,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    pickerEmoji: {
      fontSize: 16,
    },
  })
