import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PayPlan = 'monthly' | 'yearly' | 'lifetime';

const DISCOVER_FEATURES = [
  { emoji: '🃏', label: 'Gem Swipe' },
  { emoji: '🗺', label: 'Trip Planner' },
  { emoji: '💎', label: 'Hidden Gems cat.' },
] as const;

const CREATE_FEATURES = [
  { emoji: '👥', label: 'Communities' },
  { emoji: '🏷', label: 'Custom cats.' },
  { emoji: '🔒', label: 'Private pins' },
] as const;

const checkLifetimeSlotsRemaining = async () => {
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('premium_tier', 'lifetime');
  return Math.max(0, 1000 - (count || 0));
};

const showPremiumComingSoonAlert = (message: string) => {
  Alert.alert('Coming Soon', message, [
    { text: 'Not now', style: 'cancel' },
    {
      text: 'Notify me',
      onPress: async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({ wants_premium_notification: true })
            .eq('id', user.id);
        }
        Alert.alert('Got it!', "We'll let you know as soon as Premium is available.");
      },
    },
  ]);
};

const PREMIUM_COMING_SOON_MESSAGE =
  'In-app payments are launching soon as we prepare for our official release. Want us to notify you the moment Premium goes live?';

const LIFETIME_COMING_SOON_MESSAGE =
  'In-app payments are launching soon as we prepare for our official release. Lifetime deal slots are reserved in order of signup once payments launch. Want us to notify you the moment Premium goes live?';

function FeatureChip({
  emoji,
  label,
  color,
  backgroundColor,
}: {
  emoji: string;
  label: string;
  color: string;
  backgroundColor: string;
}) {
  return (
    <View style={[chipStyles.chip, { backgroundColor }]}>
      <Text style={chipStyles.emoji}>{emoji}</Text>
      <Text style={[chipStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  emoji: {
    fontSize: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});

function PlanRadio({ selected, color }: { selected: boolean; color: string }) {
  return (
    <View style={[radioStyles.outer, { borderColor: color }]}>
      {selected ? <View style={[radioStyles.inner, { backgroundColor: color }]} /> : null}
    </View>
  );
}

const radioStyles = StyleSheet.create({
  outer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default function PaywallScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [lifetimeSlotsLeft, setLifetimeSlotsLeft] = useState<number | null>(null);
  const [payPlan, setPayPlan] = useState<PayPlan>('yearly');

  useEffect(() => {
    checkLifetimeSlotsRemaining().then(setLifetimeSlotsLeft);
  }, []);

  const showLifetimeCard = lifetimeSlotsLeft !== null && lifetimeSlotsLeft > 0;
  const lifetimeSlotsUsed = lifetimeSlotsLeft !== null ? 1000 - lifetimeSlotsLeft : 0;

  const ctaText =
    payPlan === 'monthly'
      ? 'Start Monthly'
      : payPlan === 'yearly'
        ? 'Start Yearly — Save 37%'
        : 'Claim Founding Member Deal';

  const handlePurchase = () => {
    if (payPlan === 'lifetime') {
      Alert.alert(
        'Confirm Lifetime Purchase',
        'This is a one-time purchase with no refunds. Confirm?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: () => showPremiumComingSoonAlert(LIFETIME_COMING_SOON_MESSAGE),
          },
        ],
      );
      return;
    }
    showPremiumComingSoonAlert(PREMIUM_COMING_SOON_MESSAGE);
  };

  const isMonthly = payPlan === 'monthly';
  const isYearly = payPlan === 'yearly';
  const isLifetime = payPlan === 'lifetime';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => router.back()}
        activeOpacity={0.7}>
        <Ionicons name="close" size={18} color={theme.textSecondary} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <View style={styles.diamondGlow}>
            <View style={styles.diamondGlowRing} />
            <Text style={styles.diamondEmoji}>💎</Text>
          </View>
          <Text style={styles.title}>Hidden Gems Premium</Text>
          <Text style={styles.subtitle}>Unlock the full explorer experience</Text>
        </View>

        <View style={styles.featureGroup}>
          <Text style={styles.groupLabelAccent}>Discover More</Text>
          <View style={styles.chipRow}>
            {DISCOVER_FEATURES.map((f) => (
              <FeatureChip
                key={f.label}
                emoji={f.emoji}
                label={f.label}
                color={theme.accent}
                backgroundColor={theme.accentSub}
              />
            ))}
          </View>
        </View>

        <View style={styles.featureGroup}>
          <Text style={styles.groupLabelCoral}>Create + Share</Text>
          <View style={styles.chipRow}>
            {CREATE_FEATURES.map((f) => (
              <FeatureChip
                key={f.label}
                emoji={f.emoji}
                label={f.label}
                color={theme.coral}
                backgroundColor={theme.coralSubtle}
              />
            ))}
          </View>
        </View>

        <Pressable
          style={[
            styles.planCard,
            {
              backgroundColor: isMonthly ? theme.accentSub : theme.card,
              borderColor: isMonthly ? theme.accent : theme.border,
              borderWidth: isMonthly ? 1.5 : 0.5,
            },
          ]}
          onPress={() => setPayPlan('monthly')}>
          <View style={styles.planInfo}>
            <Text style={styles.planLabel}>Monthly</Text>
            <Text style={styles.planPrice}>
              5.99<Text style={styles.planPriceUnit}>€/mo</Text>
            </Text>
          </View>
          <PlanRadio selected={isMonthly} color={isMonthly ? theme.accent : theme.textTertiary} />
        </Pressable>

        <Pressable
          style={[
            styles.planCard,
            styles.planCardYearly,
            {
              backgroundColor: isYearly ? theme.accentSub : theme.card,
              borderColor: theme.accent,
              borderWidth: isYearly ? 2 : 1,
            },
          ]}
          onPress={() => setPayPlan('yearly')}>
          <View style={styles.bestValueBadge}>
            <Text style={styles.bestValueText}>BEST VALUE</Text>
          </View>
          <View style={styles.planInfo}>
            <Text style={styles.planLabel}>Yearly</Text>
            <Text style={styles.planPriceLarge}>
              44.99<Text style={styles.planPriceUnit}>€/yr</Text>
            </Text>
            <Text style={styles.saveLine}>3.75€/mo · Save 37%</Text>
          </View>
          <PlanRadio selected={isYearly} color={isYearly ? theme.accent : theme.textTertiary} />
        </Pressable>

        {showLifetimeCard && (
          <Pressable
            style={[
              styles.planCard,
              styles.planCardLifetime,
              {
                backgroundColor: isLifetime ? theme.coralSubtle : theme.card,
                borderColor: theme.coral,
                borderWidth: isLifetime ? 1.5 : 0.5,
              },
            ]}
            onPress={() => setPayPlan('lifetime')}>
            <View style={styles.lifetimeHeader}>
              <View style={styles.planInfo}>
                <View style={styles.lifetimeLabelRow}>
                  <Text style={styles.planLabel}>Lifetime</Text>
                  <View style={styles.foundingBadge}>
                    <Text style={styles.foundingBadgeText}>FOUNDING MEMBER</Text>
                  </View>
                </View>
                <Text style={styles.planPrice}>
                  119<Text style={styles.planPriceUnit}>€</Text>
                </Text>
              </View>
              <PlanRadio
                selected={isLifetime}
                color={isLifetime ? theme.coral : theme.textTertiary}
              />
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
              {lifetimeSlotsLeft} of 1000 founding spots left
            </Text>
          </Pressable>
        )}

        <PressableScale
          style={[
            styles.ctaButton,
            { backgroundColor: isLifetime ? theme.coral : theme.accent },
          ]}
          onPress={handlePurchase}>
          <Text style={styles.ctaButtonText}>{ctaText}</Text>
        </PressableScale>

        <Text style={styles.footerNote}>Cancel anytime · Secure payment</Text>
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
      top: 12,
      right: 18,
      zIndex: 10,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.bgTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 32,
    },
    heroSection: {
      alignItems: 'center',
      marginBottom: 16,
    },
    diamondGlow: {
      position: 'relative',
      marginBottom: 12,
      alignItems: 'center',
      justifyContent: 'center',
      width: 96,
      height: 96,
    },
    diamondGlowRing: {
      position: 'absolute',
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.coralSubtle,
      opacity: 0.9,
    },
    diamondEmoji: {
      fontSize: 56,
      zIndex: 1,
    },
    title: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 24,
      color: theme.text,
      marginBottom: 4,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 11,
      color: theme.textSecondary,
      letterSpacing: 0.3,
      textAlign: 'center',
      marginBottom: 16,
    },
    featureGroup: {
      width: '100%',
      backgroundColor: theme.card,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12,
      borderWidth: 0.5,
      borderColor: theme.border,
    },
    groupLabelAccent: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 9,
      color: theme.textSecondary,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    groupLabelCoral: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 9,
      color: theme.coral,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    planCard: {
      width: '100%',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'hidden',
    },
    planCardYearly: {
      paddingVertical: 14,
    },
    planCardLifetime: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    bestValueBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      backgroundColor: theme.accent,
      borderBottomLeftRadius: 10,
      borderTopRightRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    bestValueText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.accentText,
    },
    planInfo: {
      flex: 1,
    },
    planLabel: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    planPrice: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 20,
      color: theme.text,
    },
    planPriceLarge: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 24,
      color: theme.text,
    },
    planPriceUnit: {
      fontSize: 13,
      fontWeight: '500',
    },
    saveLine: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 2,
    },
    lifetimeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: 8,
    },
    lifetimeLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    foundingBadge: {
      backgroundColor: theme.coral,
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    foundingBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    slotsProgressTrack: {
      height: 4,
      backgroundColor: theme.bgTertiary,
      borderRadius: 2,
      overflow: 'hidden',
      width: '100%',
      marginBottom: 4,
    },
    slotsProgressFill: {
      height: '100%',
      backgroundColor: theme.coral,
      borderRadius: 2,
    },
    slotsText: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: theme.textSecondary,
    },
    ctaButton: {
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 4,
      marginBottom: 8,
    },
    ctaButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.accentText,
    },
    footerNote: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: theme.textTertiary,
      textAlign: 'center',
    },
  });
