import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FEATURES = [
  'Unlimited gem drops',
  'Hidden Gems exclusive category',
  'Private pins — share only with friends',
  'Advanced filters & tags',
  'Support indie development ❤️',
];

export default function PaywallScreen() {
  const router = useRouter();
  const styles = useMemo(() => createStyles(), []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => router.back()}
        activeOpacity={0.7}>
        <Ionicons name="close" size={24} color="#888888" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Ionicons name="diamond" size={64} color="#FFD700" style={styles.diamondIcon} />

        <Text style={styles.title}>Hidden Gems Premium</Text>
        <Text style={styles.subtitle}>Unlock the full explorer experience</Text>

        <View style={styles.featuresList}>
          {FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#1D9E75" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={styles.pricing}>
          <Text style={styles.price}>4.99€</Text>
          <Text style={styles.pricePeriod}>/month</Text>
          <Text style={styles.priceYearly}>or 39.99€/year (save 33%)</Text>
        </View>

        <TouchableOpacity
          style={styles.monthlyButton}
          onPress={() => Alert.alert('Payment coming soon! 🚀')}
          activeOpacity={0.8}>
          <Text style={styles.monthlyButtonText}>Go Premium Monthly</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.yearlyButton}
          onPress={() => Alert.alert('Payment coming soon! 🚀')}
          activeOpacity={0.8}>
          <Text style={styles.yearlyButtonText}>Go Premium Yearly</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.laterButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Text style={styles.laterButtonText}>Maybe later</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0D0D0D',
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 10,
      padding: 8,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
      alignItems: 'center',
    },
    diamondIcon: {
      marginTop: 60,
    },
    title: {
      color: '#FFFFFF',
      fontSize: 28,
      fontWeight: '700',
      marginTop: 16,
      textAlign: 'center',
    },
    subtitle: {
      color: '#888888',
      fontSize: 16,
      textAlign: 'center',
      marginTop: 8,
    },
    featuresList: {
      alignSelf: 'stretch',
      marginTop: 32,
      paddingHorizontal: 8,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    featureText: {
      color: '#FFFFFF',
      fontSize: 15,
      flex: 1,
    },
    pricing: {
      marginTop: 32,
      alignItems: 'center',
    },
    price: {
      color: '#FFFFFF',
      fontSize: 48,
      fontWeight: '700',
    },
    pricePeriod: {
      color: '#888888',
      fontSize: 18,
    },
    priceYearly: {
      color: '#1D9E75',
      fontSize: 14,
      marginTop: 4,
    },
    monthlyButton: {
      alignSelf: 'stretch',
      backgroundColor: '#1D9E75',
      borderRadius: 12,
      padding: 16,
      marginTop: 32,
      marginHorizontal: 16,
      marginBottom: 8,
      alignItems: 'center',
    },
    monthlyButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    yearlyButton: {
      alignSelf: 'stretch',
      backgroundColor: '#FFD700',
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 16,
      alignItems: 'center',
    },
    yearlyButtonText: {
      color: '#0D0D0D',
      fontSize: 16,
      fontWeight: '700',
    },
    laterButton: {
      marginTop: 16,
      padding: 8,
    },
    laterButtonText: {
      color: '#555555',
      fontSize: 14,
      textAlign: 'center',
    },
  });
