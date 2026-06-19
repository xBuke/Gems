import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

const checkLifetimeSlotsRemaining = async () => {
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('premium_tier', 'lifetime');
  return Math.max(0, 1000 - (count || 0));
};

export default function PaywallScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [lifetimeSlotsLeft, setLifetimeSlotsLeft] = useState<number | null>(null);

  useEffect(() => {
    checkLifetimeSlotsRemaining().then(setLifetimeSlotsLeft);
  }, []);

  const handleLifetimePurchase = () => {
    Alert.alert(
      'Confirm Lifetime Purchase',
      'This is a one-time purchase with no refunds. Confirm?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => Alert.alert('Payment integration coming soon! 🚀'),
        },
      ],
    );
  };

  const showLifetimeCard = lifetimeSlotsLeft !== null && lifetimeSlotsLeft > 0;
  const lifetimeSlotsUsed = lifetimeSlotsLeft !== null ? 1000 - lifetimeSlotsLeft : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => router.back()}
        activeOpacity={0.7}>
        <Ionicons name="close" size={24} color={theme.textSecondary} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Ionicons name="diamond" size={64} color={theme.coral} style={styles.diamondIcon} />

        <Text style={styles.title}>Hidden Gems Premium</Text>
        <Text style={styles.subtitle}>Unlock the full explorer experience</Text>

        <View style={styles.featuresList}>
          {FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={styles.pricingCards}>
          <View style={styles.pricingCard}>
            <Text style={styles.tierLabel}>Monthly</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceAmount}>4.99€</Text>
              <Text style={styles.pricePeriod}>/month</Text>
            </View>
            <TouchableOpacity
              style={styles.monthlyButton}
              onPress={() => Alert.alert('Payment integration coming soon! 🚀')}
              activeOpacity={0.8}>
              <Text style={styles.monthlyButtonText}>Start Monthly</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pricingCardFeatured}>
            <View style={styles.badgeAccent}>
              <Text style={styles.badgeText}>BEST VALUE</Text>
            </View>
            <Text style={styles.tierLabel}>Yearly</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceAmount}>39.99€</Text>
              <Text style={styles.pricePeriod}>/year · 3.33€/mo</Text>
            </View>
            <Text style={styles.saveLabel}>Save 33%</Text>
            <TouchableOpacity
              style={styles.yearlyButton}
              onPress={() => Alert.alert('Payment integration coming soon! 🚀')}
              activeOpacity={0.8}>
              <Text style={styles.yearlyButtonText}>Start Yearly</Text>
            </TouchableOpacity>
          </View>

          {showLifetimeCard && (
            <View style={styles.pricingCardLifetime}>
              <View style={styles.badgeCoral}>
                <Text style={styles.badgeText}>LIMITED</Text>
              </View>
              <Text style={styles.tierLabel}>Lifetime</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceAmount}>99€</Text>
                <Text style={styles.pricePeriod}>one-time payment</Text>
              </View>
              <View style={styles.slotsProgressTrack}>
                <View
                  style={[
                    styles.slotsProgressFill,
                    { width: `${(lifetimeSlotsUsed / 1000) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.slotsText}>
                {lifetimeSlotsLeft} of 1000 spots left
              </Text>
              <Text style={styles.lifetimeFinePrint}>
                No refunds. Early supporter pricing — won't be offered again.
              </Text>
              <TouchableOpacity
                style={styles.lifetimeButton}
                onPress={handleLifetimePurchase}
                activeOpacity={0.8}>
                <Text style={styles.lifetimeButtonText}>Claim Lifetime Deal</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
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
      color: theme.text,
      fontSize: 28,
      fontWeight: '700',
      marginTop: 16,
      textAlign: 'center',
    },
    subtitle: {
      color: theme.textSecondary,
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
      color: theme.text,
      fontSize: 15,
      flex: 1,
    },
    pricingCards: {
      alignSelf: 'stretch',
      marginTop: 32,
      gap: 12,
    },
    pricingCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      paddingTop: 24,
    },
    pricingCardFeatured: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: theme.accent,
      padding: 20,
      paddingTop: 28,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    pricingCardLifetime: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.coral,
      padding: 20,
      paddingTop: 28,
    },
    badgeAccent: {
      position: 'absolute',
      top: -10,
      alignSelf: 'center',
      left: '50%',
      marginLeft: -48,
      backgroundColor: theme.accent,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 10,
    },
    badgeCoral: {
      position: 'absolute',
      top: -10,
      alignSelf: 'center',
      left: '50%',
      marginLeft: -36,
      backgroundColor: theme.coral,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 10,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    tierLabel: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      flexWrap: 'wrap',
    },
    priceAmount: {
      color: theme.text,
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 28,
    },
    pricePeriod: {
      color: theme.textSecondary,
      fontSize: 13,
    },
    saveLabel: {
      color: theme.coral,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 6,
    },
    monthlyButton: {
      marginTop: 16,
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.accent,
      padding: 14,
      alignItems: 'center',
    },
    monthlyButtonText: {
      color: theme.accent,
      fontSize: 16,
      fontWeight: '700',
    },
    yearlyButton: {
      marginTop: 16,
      backgroundColor: theme.accent,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
    },
    yearlyButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    slotsProgressTrack: {
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      marginTop: 12,
      overflow: 'hidden',
    },
    slotsProgressFill: {
      height: '100%',
      backgroundColor: theme.coral,
      borderRadius: 2,
    },
    slotsText: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 6,
    },
    lifetimeFinePrint: {
      color: theme.textTertiary,
      fontSize: 10,
      marginTop: 8,
      lineHeight: 14,
    },
    lifetimeButton: {
      marginTop: 16,
      backgroundColor: theme.coral,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
    },
    lifetimeButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    laterButton: {
      marginTop: 16,
      padding: 8,
    },
    laterButtonText: {
      color: theme.textTertiary,
      fontSize: 14,
      textAlign: 'center',
    },
  });
