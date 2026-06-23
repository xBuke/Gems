import { AppBottomSheetModal, type AppBottomSheetModalRef } from '@/components/AppBottomSheetModal';
import { createReport, REPORT_REASONS } from '@/lib/safety';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';

type ReportSheetProps = {
  visible: boolean;
  onClose: () => void;
  targetType: 'gem' | 'comment' | 'message' | 'user';
  targetId: string;
  reporterId: string;
  onReportSuccess?: () => void;
};

export default function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
  reporterId,
  onReportSuccess,
}: ReportSheetProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sheetRef = useRef<AppBottomSheetModalRef>(null);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
      return;
    }
    sheetRef.current?.dismiss();
  }, [visible]);

  const handleClose = useCallback(() => {
    sheetRef.current?.dismiss();
    onClose();
  }, [onClose]);

  const handleSelectReason = async (reason: string) => {
    const result = await createReport(reporterId, targetType, targetId, reason);
    const { error } = result;
    handleClose();
    if (error) {
      Alert.alert('Error', 'Could not submit report. Please try again.');
      return;
    }
    onReportSuccess?.();
    Alert.alert('Report submitted. Thank you for keeping the community safe.');
  };

  return (
    <AppBottomSheetModal ref={sheetRef} onClose={onClose} snapPoints={['55%']}>
      <BottomSheetScrollView
        overScrollMode="never"
        bounces={Platform.OS === 'ios' ? false : undefined}
        contentContainerStyle={styles.content}>
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

        <TouchableOpacity style={styles.cancelButton} onPress={handleClose} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 20,
      paddingBottom: 32,
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
  });
