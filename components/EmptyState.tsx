import { HapticPressable } from '@/components/HapticPressable';
import { useTheme } from '@/lib/ThemeContext';
import { typography } from '@/lib/typography';
import { radii, spacing } from '@/lib/spacing';
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

type EmptyStateProps = {
  icon?: string;
  iconNode?: ReactNode;
  title: string;
  subtitle?: string;
  overline?: string;
  accentLine?: string;
  cta?: string;
  onCta?: () => void;
  secondaryCta?: string;
  onSecondaryCta?: () => void;
  secondaryOutline?: boolean;
  footer?: ReactNode;
  /** @deprecated use cta */
  ctaText?: string;
  /** @deprecated use onCta */
  onCtaPress?: () => void;
};

export const EmptyState = ({
  icon,
  iconNode,
  title,
  subtitle,
  overline,
  accentLine,
  cta,
  onCta,
  secondaryCta,
  onSecondaryCta,
  secondaryOutline,
  footer,
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
        {iconNode ??
          (icon ? (
            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={36} color={theme.accent} />
          ) : null)}
      </View>
      {overline ? (
        <Text
          style={[
            typography.monoXS,
            { color: theme.accent, marginTop: spacing.sm, textAlign: 'center' },
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
            accentLine ? typography.bodyS : typography.body,
            {
              color: theme.textSecondary,
              textAlign: 'center',
              marginTop: spacing.sm,
              lineHeight: accentLine ? 20 : 22,
            },
          ]}>
          {subtitle}
        </Text>
      ) : null}
      {accentLine ? (
        <Text
          style={[
            typography.monoM,
            {
              color: theme.accent,
              textAlign: 'center',
              marginTop: spacing.sm,
            },
          ]}>
          {accentLine}
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
        secondaryOutline ? (
          <HapticPressable
            haptic="light"
            onPress={onSecondaryCta}
            style={{
              marginTop: spacing.md,
              width: '100%',
              height: 50,
              borderRadius: radii.lg,
              borderWidth: 1.5,
              borderColor: theme.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={[typography.bodyS, { color: theme.textSecondary }]}>{secondaryCta}</Text>
          </HapticPressable>
        ) : (
          <HapticPressable onPress={onSecondaryCta} style={{ marginTop: spacing.md }}>
            <Text style={[typography.bodyS, { color: theme.textSecondary }]}>{secondaryCta}</Text>
          </HapticPressable>
        )
      ) : null}
      {footer ? <View style={{ marginTop: spacing.lg, width: '100%', alignItems: 'center' }}>{footer}</View> : null}
    </View>
  );
};
