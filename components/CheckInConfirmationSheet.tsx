import { AppBottomSheetModal, type AppBottomSheetModalRef } from '@/components/AppBottomSheetModal';
import { CompassIcon } from '@/components/CompassIcon';
import { formatCoordinates } from '@/lib/coordinates';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type CheckInConfirmationSheetProps = {
  visible: boolean;
  onClose: () => void;
  gemTitle: string;
  latitude: number;
  longitude: number;
  checkedInAt: Date | null;
  checkInCount: number;
};

const formatCheckInTimestamp = (date: Date): string => {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today at ${time}`;
  return `${date.toLocaleDateString()} at ${time}`;
};

export default function CheckInConfirmationSheet({
  visible,
  onClose,
  gemTitle,
  latitude,
  longitude,
  checkedInAt,
  checkInCount,
}: CheckInConfirmationSheetProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sheetRef = useRef<AppBottomSheetModalRef>(null);

  useEffect(() => {
    if (!checkedInAt) return;

    if (visible) {
      sheetRef.current?.present();
      return;
    }
    sheetRef.current?.dismiss();
  }, [visible, checkedInAt]);

  const handleClose = useCallback(() => {
    sheetRef.current?.dismiss();
    onClose();
  }, [onClose]);

  const handleShare = async () => {
    try {
      await Share.share({ message: `Just checked in at ${gemTitle}! 📍` });
    } catch {
      // User dismissed share sheet
    }
  };

  if (!checkedInAt) return null;

  return (
    <AppBottomSheetModal ref={sheetRef} onClose={onClose} snapPoints={['52%']}>
      <BottomSheetView style={styles.content}>
        <Pressable onPress={(event) => event.stopPropagation()}>
          <View style={styles.compassWrap}>
            <CompassIcon size={64} />
          </View>
          <Text style={styles.checkedInLabel}>CHECKED IN</Text>
          <Text style={styles.gemTitle}>{gemTitle}</Text>
          <Text style={styles.coordinates}>{formatCoordinates(latitude, longitude)}</Text>
          <Text style={styles.meta}>
            {formatCheckInTimestamp(checkedInAt)} · check-in #{checkInCount}
          </Text>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.85}>
            <Text style={styles.shareButtonText}>Share This Check-in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneButton} onPress={handleClose} activeOpacity={0.7}>
            <Text style={styles.doneButtonText}>Done</Text>
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
    compassWrap: {
      alignItems: 'center',
      width: '100%',
    },
    checkedInLabel: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 9,
      color: theme.accent,
      letterSpacing: 2,
      textTransform: 'uppercase',
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 8,
    },
    gemTitle: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 22,
      color: theme.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    coordinates: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 11,
      color: theme.accent,
      textAlign: 'center',
      marginBottom: 8,
    },
    meta: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: theme.textTertiary,
      textAlign: 'center',
      marginBottom: 20,
    },
    shareButton: {
      alignSelf: 'stretch',
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 8,
    },
    shareButtonText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 15,
      color: theme.accentText,
    },
    doneButton: {
      alignSelf: 'stretch',
      paddingVertical: 12,
      alignItems: 'center',
    },
    doneButtonText: {
      fontFamily: 'SpaceGrotesk-Regular',
      fontSize: 14,
      color: theme.textSecondary,
    },
  });
