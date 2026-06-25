import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export type LoadMoreStatus = 'loading' | 'end' | 'error' | 'idle';

type LoadMoreProps = {
  status: LoadMoreStatus;
  itemLabel?: string;
  totalCount?: number;
  onRetry?: () => void;
};

function SpinnerRing() {
  const { theme } = useTheme();
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [spinValue]);

  const rotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.spinner,
        {
          borderColor: theme.accent,
          borderTopColor: 'transparent',
          transform: [{ rotate }],
        },
      ]}
    />
  );
}

export function LoadMore({
  status,
  itemLabel = 'items',
  totalCount,
  onRetry,
}: LoadMoreProps) {
  const { theme } = useTheme();

  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.card }]}>
        <SpinnerRing />
        <Text style={[styles.loadingText, { color: theme.textTertiary }]}>
          Loading more {itemLabel}…
        </Text>
      </View>
    );
  }

  if (status === 'end') {
    const endLabel =
      totalCount != null
        ? `You've seen all ${totalCount} ${itemLabel}`
        : "You've seen it all";

    return (
      <View style={styles.endContainer}>
        <View style={[styles.endDivider, { backgroundColor: theme.border }]} />
        <Text style={[styles.endText, { color: theme.textTertiary }]}>{endLabel}</Text>
        <View style={[styles.endDivider, { backgroundColor: theme.border }]} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.errorContainer,
        { backgroundColor: theme.card, borderColor: '#F87171' },
      ]}>
      <Ionicons name="alert-circle" size={18} color="#F87171" />
      <Text style={[styles.errorText, { color: theme.textSecondary }]}>
        Couldn't load more
      </Text>
      <TouchableOpacity
        style={[
          styles.retryButton,
          { backgroundColor: theme.bgTertiary, borderColor: theme.border },
        ]}
        onPress={onRetry}
        activeOpacity={0.8}>
        <Text style={[styles.retryText, { color: theme.textSecondary }]}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  loadingText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
  },
  endContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  endDivider: {
    flex: 1,
    height: 0.5,
  },
  endText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 0.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
  },
  retryButton: {
    borderRadius: 20,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
