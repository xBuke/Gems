import { AppBottomSheetModal, type AppBottomSheetModalRef } from '@/components/AppBottomSheetModal';
import { deactivateAccount } from '@/lib/accountDeactivation';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';

const DELETE_CONFIRM_TEXT = 'DELETE';
const FINAL_DELETE_RED = '#F87171';

type DeleteAccountSheetProps = {
  visible: boolean;
  onClose: () => void;
  onDeactivated: () => void | Promise<void>;
};

export function DeleteAccountSheet({ visible, onClose, onDeactivated }: DeleteAccountSheetProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sheetRef = useRef<AppBottomSheetModalRef>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetSheet = useCallback(() => {
    setStep(1);
    setConfirmText('');
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (visible) {
      resetSheet();
      sheetRef.current?.present();
      return;
    }
    sheetRef.current?.dismiss();
  }, [visible, resetSheet]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    sheetRef.current?.dismiss();
    resetSheet();
    onClose();
  }, [onClose, resetSheet, submitting]);

  const handleContinue = useCallback(() => {
    setStep(2);
  }, []);

  const handleConfirmDeactivate = useCallback(async () => {
    if (confirmText !== DELETE_CONFIRM_TEXT || submitting) return;

    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      Alert.alert('Error', 'You must be signed in to delete your account.');
      handleClose();
      return;
    }

    const { error } = await deactivateAccount(user.id);
    if (error) {
      setSubmitting(false);
      Alert.alert('Error', 'Could not deactivate your account. Please try again or contact support.');
      return;
    }

    sheetRef.current?.dismiss();
    resetSheet();
    onClose();
    await onDeactivated();
  }, [confirmText, submitting, handleClose, onClose, onDeactivated, resetSheet]);

  const confirmEnabled = confirmText === DELETE_CONFIRM_TEXT && !submitting;

  return (
    <AppBottomSheetModal
      ref={sheetRef}
      visible={visible}
      onClose={handleClose}
      snapPoints={['58%']}>
      <BottomSheetView style={styles.content}>
        {step === 1 ? (
          <>
            <Text style={styles.title}>Delete your account?</Text>
            <Text style={styles.body}>
              Your account will be deactivated immediately. You&apos;ll have 30 days to change your
              mind — just log back in to reactivate. After 30 days, everything is permanently
              deleted: your gems, photos, comments, and data. This can&apos;t be undone after that.
            </Text>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinue}
              activeOpacity={0.85}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose} activeOpacity={0.7}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Type DELETE to confirm</Text>
            <Text style={styles.stepTwoHint}>
              This deactivates your account immediately. You can reactivate by logging in within 30
              days.
            </Text>
            <BottomSheetTextInput
              style={styles.input}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="DELETE"
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              selectionColor={theme.accent}
            />
            <TouchableOpacity
              style={[
                styles.deleteButton,
                !confirmEnabled && styles.deleteButtonDisabled,
              ]}
              onPress={handleConfirmDeactivate}
              disabled={!confirmEnabled}
              activeOpacity={0.85}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteButtonText}>Delete My Account</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setConfirmText('');
                setStep(1);
              }}
              disabled={submitting}
              activeOpacity={0.7}>
              <Text style={styles.cancelButtonText}>Back</Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheetView>
    </AppBottomSheetModal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 24,
      paddingBottom: 32,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    body: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.textSecondary,
      marginBottom: 24,
      textAlign: 'center',
    },
    stepTwoHint: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.textTertiary,
      marginBottom: 16,
      textAlign: 'center',
    },
    continueButton: {
      alignSelf: 'stretch',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 8,
    },
    continueButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    input: {
      alignSelf: 'stretch',
      backgroundColor: theme.background,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.text,
      marginBottom: 16,
      fontFamily: 'SpaceMono-Regular',
      letterSpacing: 1,
    },
    deleteButton: {
      alignSelf: 'stretch',
      backgroundColor: FINAL_DELETE_RED,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 8,
      minHeight: 48,
      justifyContent: 'center',
    },
    deleteButtonDisabled: {
      opacity: 0.45,
    },
    deleteButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    cancelButton: {
      alignSelf: 'stretch',
      paddingVertical: 12,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 15,
      color: theme.textSecondary,
    },
  });
