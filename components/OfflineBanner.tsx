import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type OfflineBannerProps = {
  onDismiss?: () => void;
};

export function OfflineBanner({ onDismiss }: OfflineBannerProps) {
  return (
    <View style={styles.banner}>
      <Ionicons name="warning" size={16} color="#1A1A1A" />
      <Text style={styles.text}>You're offline — browsing cached gems</Text>
      {onDismiss ? (
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}>
          <Text style={styles.dismiss}>×</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline =
        state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
      if (!offline) {
        setDismissed(false);
      }
    });

    NetInfo.fetch().then((state) => {
      const offline =
        state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });

    return unsubscribe;
  }, []);

  const showBanner = isOffline && !dismissed;

  return { showBanner, dismissBanner: () => setDismissed(true) };
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FBBF24',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    flex: 1,
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  dismiss: {
    fontSize: 18,
    lineHeight: 20,
    color: 'rgba(0,0,0,0.55)',
  },
});
