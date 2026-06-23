import { useTheme } from '@/lib/ThemeContext';
import type { BottomSheetHandleProps } from '@gorhom/bottom-sheet';
import { StyleSheet, View } from 'react-native';

export function BottomSheetHandle({ style }: BottomSheetHandleProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});
