import { CompassIcon } from '@/components/CompassIcon';
import { formatCoordinates } from '@/lib/coordinates';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { useEffect, useMemo } from 'react';
import {
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

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
  const overlayOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(400);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) });
      sheetTranslateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    } else {
      overlayOpacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
      sheetTranslateY.value = withTiming(400, { duration: 250, easing: Easing.in(Easing.cubic) });
    }
  }, [visible, overlayOpacity, sheetTranslateY]);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const handleShare = async () => {
    try {
      await Share.share({ message: `Just checked in at ${gemTitle}! 📍` });
    } catch {
      // User dismissed share sheet
    }
  };

  if (!checkedInAt) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.overlay, overlayAnimatedStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} />
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
            <TouchableOpacity style={styles.doneButton} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 32,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 18,
    },
    compassWrap: {
      alignItems: 'center',
      marginBottom: 16,
    },
    checkedInLabel: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 9,
      color: theme.accent,
      letterSpacing: 2,
      textTransform: 'uppercase',
      textAlign: 'center',
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
      paddingVertical: 12,
      alignItems: 'center',
    },
    doneButtonText: {
      fontFamily: 'SpaceGrotesk-Regular',
      fontSize: 14,
      color: theme.textSecondary,
    },
  });
