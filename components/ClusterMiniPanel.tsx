import type { Theme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export type ClusterGemPreview = {
  id: string;
  title: string;
  image_url?: string | null;
  likeCount: number;
};

type ClusterMiniPanelProps = {
  gems: ClusterGemPreview[];
  theme: Theme;
  overlay: string;
  screenPoint: { x: number; y: number } | null;
  onDismiss: () => void;
  onZoomIn: () => void;
  onGemPress: (gemId: string) => void;
};

const PANEL_WIDTH = 248;
const CARD_PADDING = 12;
const GRID_GAP = 8;
const NUM_COLUMNS = 2;
const THUMB_SIZE = 72;
const GRID_MAX_HEIGHT = THUMB_SIZE * 2 + GRID_GAP;
const VISIBLE_ROW_COUNT = 2;

export const ClusterMiniPanel = memo(function ClusterMiniPanel({
  gems,
  theme,
  overlay,
  screenPoint,
  onDismiss,
  onZoomIn,
  onGemPress,
}: ClusterMiniPanelProps) {
  const count = gems.length;
  const sorted = [...gems].sort((a, b) => b.likeCount - a.likeCount);
  const styles = createStyles(theme, overlay);
  const scrollEnabled = sorted.length > NUM_COLUMNS * VISIBLE_ROW_COUNT;

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const left = screenPoint
    ? Math.min(Math.max(screenPoint.x - PANEL_WIDTH / 2, 12), screenWidth - PANEL_WIDTH - 12)
    : (screenWidth - PANEL_WIDTH) / 2;
  const top = screenPoint
    ? Math.min(Math.max(screenPoint.y - 200, 120), screenHeight - 280)
    : screenHeight * 0.38;

  const renderGem = useCallback(
    ({ item }: { item: ClusterGemPreview }) => (
      <Pressable
        style={styles.thumbWrap}
        onPress={() => onGemPress(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.title}`}>
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.thumb}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="image-outline" size={22} color={theme.accent} />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={styles.thumbGradient}
        />
        <Text style={styles.thumbLabel} numberOfLines={2}>
          {item.title}
        </Text>
      </Pressable>
    ),
    [onGemPress, styles, theme.accent],
  );

  return (
    <View style={[styles.container, { left, top, width: PANEL_WIDTH }]} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>{count} gems here</Text>
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Dismiss cluster preview">
            <Text style={styles.dismiss}>×</Text>
          </Pressable>
        </View>

        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={renderGem}
          numColumns={NUM_COLUMNS}
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={scrollEnabled}
          style={styles.gridList}
          columnWrapperStyle={styles.gridRow}
          nestedScrollEnabled
        />

        <TouchableOpacity style={styles.zoomButton} onPress={onZoomIn} activeOpacity={0.85}>
          <Text style={styles.zoomButtonText}>Zoom in to separate pins</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const createStyles = (theme: Theme, overlay: string) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      zIndex: 20,
    },
    card: {
      backgroundColor: overlay,
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: theme.border,
      padding: CARD_PADDING,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLabel: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: theme.accent,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      flex: 1,
    },
    dismiss: {
      fontSize: 22,
      lineHeight: 22,
      color: theme.textSecondary,
      paddingLeft: 8,
    },
    gridList: {
      flexGrow: 0,
      maxHeight: GRID_MAX_HEIGHT,
    },
    gridRow: {
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    thumbWrap: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: theme.bgTertiary,
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
    },
    thumbPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: THUMB_SIZE * 0.55,
    },
    thumbLabel: {
      position: 'absolute',
      left: 6,
      right: 6,
      bottom: 6,
      fontSize: 10,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    zoomButton: {
      backgroundColor: theme.accent,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    zoomButtonText: {
      color: theme.accentText,
      fontSize: 13,
      fontWeight: '600',
    },
  });
