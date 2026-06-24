import { AppBottomSheetModal, type AppBottomSheetModalRef } from '@/components/AppBottomSheetModal';
import { recordRatingPromptShown } from '@/lib/appRating';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import * as StoreReview from 'expo-store-review';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type RateAppSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export default function RateAppSheet({ visible, onClose }: RateAppSheetProps) {
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

  const dismissAndRecord = useCallback(async () => {
    await recordRatingPromptShown();
    sheetRef.current?.dismiss();
    onClose();
  }, [onClose]);

  const handleRate = async () => {
    await recordRatingPromptShown();
    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
    }
    sheetRef.current?.dismiss();
    onClose();
  };

  return (
    <AppBottomSheetModal ref={sheetRef} onClose={onClose} snapPoints={['44%']}>
      <BottomSheetView style={styles.content}>
        <Pressable onPress={(event) => event.stopPropagation()}>
          <Text style={styles.emoji}>💎</Text>
          <Text style={styles.title}>Enjoying Hidden Gems?</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Text key={star} style={styles.star}>
                ★
              </Text>
            ))}
          </View>
          <TouchableOpacity style={styles.rateButton} onPress={() => void handleRate()} activeOpacity={0.85}>
            <Text style={styles.rateButtonText}>Rate us ★★★★★</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.notNowButton} onPress={() => void dismissAndRecord()} activeOpacity={0.7}>
            <Text style={styles.notNowText}>Not now</Text>
          </TouchableOpacity>
        </Pressable>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 24,
      paddingBottom: 32,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    emoji: {
      fontSize: 40,
      textAlign: 'center',
      marginBottom: 12,
    },
    title: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 22,
      color: theme.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    starsRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 20,
    },
    star: {
      fontSize: 28,
      color: theme.accent,
    },
    rateButton: {
      alignSelf: 'stretch',
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 8,
    },
    rateButtonText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 15,
      color: theme.accentText,
    },
    notNowButton: {
      alignSelf: 'stretch',
      paddingVertical: 12,
      alignItems: 'center',
    },
    notNowText: {
      fontFamily: 'SpaceGrotesk-Regular',
      fontSize: 14,
      color: theme.textSecondary,
    },
  });
