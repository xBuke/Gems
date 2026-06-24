import { AppBottomSheetModal, type AppBottomSheetModalRef } from '@/components/AppBottomSheetModal';
import { createReport, getReportReasons } from '@/lib/safety';
import { useTheme } from '@/lib/ThemeContext';
import { semantic, type Theme } from '@/lib/theme';
import { useToast } from '@/lib/ToastContext';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type ReportSheetProps = {
  visible: boolean;
  onClose: () => void;
  targetType: 'gem' | 'comment' | 'message' | 'user';
  targetId: string;
  reporterId: string;
  onReportSuccess?: () => void;
};

const REPORT_COPY: Record<
  ReportSheetProps['targetType'],
  { title: string; subtitle: string }
> = {
  gem: { title: 'Report gem', subtitle: "What's wrong with this gem?" },
  comment: { title: 'Report comment', subtitle: "What's wrong with this comment?" },
  user: { title: 'Report user', subtitle: "What's wrong with this account?" },
  message: { title: 'Report message', subtitle: "What's wrong with this message?" },
};

function ReportRadio({
  selected,
  accentColor,
  borderColor,
}: {
  selected: boolean;
  accentColor: string;
  borderColor: string;
}) {
  return (
    <View style={[radioStyles.outer, { borderColor: selected ? accentColor : borderColor }]}>
      {selected ? <View style={[radioStyles.inner, { backgroundColor: accentColor }]} /> : null}
    </View>
  );
}

const radioStyles = StyleSheet.create({
  outer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  inner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

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
  const { showToast } = useToast();
  const sheetRef = useRef<AppBottomSheetModalRef>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reasons = useMemo(() => getReportReasons(targetType), [targetType]);
  const copy = REPORT_COPY[targetType];

  useEffect(() => {
    if (visible) {
      setSelectedReason(null);
      setSubmitting(false);
      sheetRef.current?.present();
      return;
    }
    sheetRef.current?.dismiss();
  }, [visible]);

  const handleClose = useCallback(() => {
    sheetRef.current?.dismiss();
    onClose();
  }, [onClose]);

  const handleSubmit = async () => {
    if (!selectedReason || submitting) return;

    setSubmitting(true);
    const result = await createReport(reporterId, targetType, targetId, selectedReason);
    setSubmitting(false);

    if (result.error) {
      Alert.alert('Error', 'Could not submit report. Please try again.');
      return;
    }

    handleClose();
    onReportSuccess?.();
    showToast({
      type: 'success',
      title: 'Report submitted',
      message: "We'll review it within 24 hours",
    });
  };

  const canSubmit = !!selectedReason && !submitting;

  return (
    <AppBottomSheetModal ref={sheetRef} onClose={onClose} snapPoints={['55%']}>
      <BottomSheetScrollView
        overScrollMode="never"
        bounces={Platform.OS === 'ios' ? false : undefined}
        contentContainerStyle={styles.content}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>

        {reasons.map((reason) => {
          const selected = selectedReason === reason;
          return (
            <TouchableOpacity
              key={reason}
              style={styles.reasonRow}
              onPress={() => setSelectedReason(reason)}
              activeOpacity={0.7}>
              <ReportRadio
                selected={selected}
                accentColor={theme.accent}
                borderColor={theme.border}
              />
              <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>
                {reason}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.8}>
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit report</Text>
          )}
        </TouchableOpacity>

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
      fontSize: 16,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 14,
    },
    reasonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    reasonText: {
      flex: 1,
      fontSize: 14,
      color: theme.textSecondary,
    },
    reasonTextSelected: {
      color: theme.text,
    },
    submitButton: {
      marginTop: 14,
      backgroundColor: semantic.error,
      borderRadius: 12,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.4,
    },
    submitText: {
      fontSize: 14,
      fontFamily: 'SpaceGrotesk-Bold',
      color: '#fff',
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
