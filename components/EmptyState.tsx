import { HapticPressable } from '@/components/HapticPressable';
import { useTheme } from '@/lib/ThemeContext';
import { typography } from '@/lib/typography';
import { radii, spacing } from '@/lib/spacing';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

type EmptyStateProps = {
  icon: string;
  title: string;
  subtitle?: string;
  overline?: string;
  cta?: string;
  onCta?: () => void;
  secondaryCta?: string;
  onSecondaryCta?: () => void;
  /** @deprecated use cta */
  ctaText?: string;
  /** @deprecated use onCta */
  onCtaPress?: () => void;
};

export const EmptyState = ({
  icon,
  title,
  subtitle,
  overline,
  cta,
  onCta,
  secondaryCta,
  onSecondaryCta,
  ctaText,
  onCtaPress,
}: EmptyStateProps) => {
  const { theme } = useTheme();
  const primaryLabel = cta ?? ctaText;
  const primaryAction = onCta ?? onCtaPress;

  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: 32 }}>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: theme.bgTertiary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: theme.accentSub,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 12,
        }}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={36} color={theme.accent} />
      </View>
      {overline ? (
        <Text
          style={[
            typography.monoXS,
            { color: theme.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
          ]}>
          {overline}
        </Text>
      ) : null}
      <Text
        style={[
          typography.h3,
          {
            color: theme.text,
            textAlign: 'center',
            marginTop: overline ? spacing.sm : spacing.lg,
            lineHeight: 28,
          },
        ]}>
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[
            typography.body,
            {
              color: theme.textSecondary,
              textAlign: 'center',
              marginTop: spacing.sm,
              lineHeight: 22,
            },
          ]}>
          {subtitle}
        </Text>
      ) : null}
      {primaryLabel && primaryAction ? (
        <HapticPressable
          haptic="medium"
          onPress={primaryAction}
          style={{
            marginTop: spacing.xl,
            width: '100%',
            height: 50,
            borderRadius: radii.lg,
            backgroundColor: theme.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={[typography.label, { color: theme.accentText, fontFamily: 'SpaceGrotesk-Bold' }]}>
            {primaryLabel}
          </Text>
        </HapticPressable>
      ) : null}
      {secondaryCta && onSecondaryCta ? (
        <HapticPressable onPress={onSecondaryCta} style={{ marginTop: spacing.md }}>
          <Text style={[typography.bodyS, { color: theme.textSecondary }]}>{secondaryCta}</Text>
        </HapticPressable>
      ) : null}
    </View>
  );
};
