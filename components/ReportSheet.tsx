import { createReport, REPORT_REASONS } from '@/lib/safety'
import { useTheme } from '@/lib/ThemeContext'
import type { Theme } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'
import { useMemo } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

type ReportSheetProps = {
  visible: boolean
  onClose: () => void
  targetType: 'gem' | 'comment' | 'message' | 'user'
  targetId: string
  reporterId: string
  onReportSuccess?: () => void
}

export default function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
  reporterId,
  onReportSuccess,
}: ReportSheetProps) {
  const { theme } = useTheme()
  const styles = useMemo(() => createStyles(theme), [theme])

  const handleSelectReason = async (reason: string) => {
    const result = await createReport(reporterId, targetType, targetId, reason);
    const { error } = result;
    onClose();
    if (error) {
      Alert.alert('Error', 'Could not submit report. Please try again.');
      return;
    }
    onReportSuccess?.();
    Alert.alert('Report submitted. Thank you for keeping the community safe.');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Report</Text>
          <Text style={styles.subtitle}>Why are you reporting this?</Text>

          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={styles.reasonRow}
              onPress={() => handleSelectReason(reason)}
              activeOpacity={0.7}>
              <Text style={styles.reasonText}>{reason}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: 32,
      paddingTop: 12,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      alignSelf: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 16,
    },
    reasonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.background,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    reasonText: {
      fontSize: 15,
      color: theme.text,
    },
    cancelButton: {
      marginTop: 8,
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textSecondary,
    },
  })
