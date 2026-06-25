import type { Theme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

export type MapPinProps = {
  count: number;
  thumbnailUrl: string | null;
  theme: Theme;
};

type PinTier = {
  size: number;
  showRing: boolean;
  borderWidth: number;
  shadow: boolean;
  accentSubBg?: boolean;
  diamond?: boolean;
};

function getPinTier(count: number): PinTier {
  if (count >= 12) {
    return { size: 52, showRing: true, borderWidth: 3, shadow: true };
  }
  if (count >= 4) {
    return { size: 42, showRing: true, borderWidth: 3, shadow: true };
  }
  if (count >= 2) {
    return { size: 36, showRing: false, borderWidth: 2, shadow: false, accentSubBg: true };
  }
  return { size: 32, showRing: false, borderWidth: 2, shadow: false, diamond: true };
}

export const MapPin = memo(function MapPin({ count, thumbnailUrl, theme }: MapPinProps) {
  const tier = getPinTier(count);
  const innerSize = tier.size - tier.borderWidth * 2;

  const countBadge =
    count >= 2 ? (
      <View style={styles.countBadge}>
        <Text style={styles.countBadgeText}>{count}</Text>
      </View>
    ) : null;

  const proximityRing = tier.showRing ? (
    <View
      pointerEvents="none"
      style={[
        styles.proximityRing,
        {
          width: tier.size * 1.3,
          height: tier.size * 1.3,
          borderRadius: (tier.size * 1.3) / 2,
          backgroundColor: `${theme.accent}4D`,
        },
      ]}
    />
  ) : null;

  if (tier.diamond) {
    return (
      <View style={[styles.anchor, { width: tier.size + 8, height: tier.size + 8 }]}>
        <View
          style={[
            styles.diamondShell,
            {
              width: tier.size,
              height: tier.size,
              borderColor: theme.coral,
              borderWidth: tier.borderWidth,
            },
          ]}>
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={[
                styles.diamondImage,
                {
                  width: tier.size * 1.45,
                  height: tier.size * 1.45,
                  left: -(tier.size * 0.225),
                  top: -(tier.size * 0.225),
                },
              ]}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.diamondPlaceholder, { backgroundColor: theme.coralSubtle }]}>
              <Ionicons name="diamond" size={14} color={theme.coral} />
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.anchor,
        {
          width: tier.showRing ? tier.size * 1.3 : tier.size + 12,
          height: tier.showRing ? tier.size * 1.3 : tier.size + 12,
        },
      ]}>
      {proximityRing}
      <View
        style={[
          styles.circle,
          {
            width: tier.size,
            height: tier.size,
            borderRadius: tier.size / 2,
            borderWidth: tier.borderWidth,
            borderColor: theme.accent,
            backgroundColor: tier.accentSubBg ? theme.accentSub : theme.card,
          },
          tier.shadow && styles.shadow,
        ]}>
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={{
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
            }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            style={[
              styles.circlePlaceholder,
              {
                width: innerSize,
                height: innerSize,
                borderRadius: innerSize / 2,
                backgroundColor: theme.accentSub,
              },
            ]}>
            <Ionicons name="image-outline" size={tier.size * 0.32} color={theme.accent} />
          </View>
        )}
        {countBadge}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  anchor: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  proximityRing: {
    position: 'absolute',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  circlePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondShell: {
    transform: [{ rotate: '45deg' }],
    overflow: 'hidden',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondImage: {
    position: 'absolute',
    transform: [{ rotate: '-45deg' }],
  },
  diamondPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-45deg' }],
  },
  countBadge: {
    position: 'absolute',
    bottom: -5,
    alignSelf: 'center',
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(11, 26, 28, 0.88)',
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  shadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.28,
      shadowRadius: 4,
    },
    android: {
      elevation: 5,
    },
    default: {},
  }),
});
