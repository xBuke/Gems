import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FullScreenPhotoViewerProps = {
  visible: boolean;
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FullScreenPhotoViewer({
  visible,
  photos,
  initialIndex = 0,
  onClose,
}: FullScreenPhotoViewerProps) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<string>>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    if (!visible) return;
    setActiveIndex(initialIndex);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    });
  }, [visible, initialIndex]);

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setActiveIndex(index);
    },
    [],
  );

  const styles = useMemo(() => createStyles(), []);

  if (!visible || photos.length === 0) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable
          style={[styles.closeButton, { top: insets.top + 8 }]}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>

        <FlatList
          ref={listRef}
          data={photos}
          keyExtractor={(uri, index) => `${uri}-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onMomentumScrollEnd={onMomentumScrollEnd}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Image
                source={{ uri: item }}
                style={styles.image}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            </View>
          )}
        />

        {photos.length > 1 ? (
          <View style={[styles.dotsRow, { bottom: insets.bottom + 16 }]}>
            {photos.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, index === activeIndex && styles.dotActive]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    closeButton: {
      position: 'absolute',
      right: 16,
      zIndex: 10,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    slide: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
    },
    dotsRow: {
      position: 'absolute',
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.35)',
    },
    dotActive: {
      backgroundColor: '#FFFFFF',
      width: 8,
      height: 8,
      borderRadius: 4,
    },
  });
