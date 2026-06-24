import { openSubscriptionManagement } from '@/lib/subscriptionManagement';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { semantic } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type BillingFailureCardProps = {
  daysRemaining: number;
};

export function BillingFailureCard({ daysRemaining }: BillingFailureCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Ionicons name="card" size={22} color={semantic.error} />
      </View>
      <Text style={styles.title}>Payment failed</Text>
      <Text style={styles.subtitle}>
        Your Pro subscription couldn't be renewed. Update your payment to keep access.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => void openSubscriptionManagement()}
        activeOpacity={0.85}>
        <Text style={styles.buttonText}>Update payment</Text>
      </TouchableOpacity>
      <Text style={styles.graceText}>Grace period: {daysRemaining} days remaining</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 0.5,
      borderColor: theme.border,
      marginHorizontal: 20,
      marginBottom: 16,
      padding: 16,
      alignItems: 'center',
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(248,113,113,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    title: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 17,
      color: theme.text,
      marginBottom: 6,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 16,
    },
    button: {
      alignSelf: 'stretch',
      backgroundColor: semantic.error,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 10,
    },
    buttonText: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 15,
      color: '#FFFFFF',
    },
    graceText: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 11,
      color: theme.textTertiary,
      textAlign: 'center',
    },
  });
