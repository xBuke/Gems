import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import type { AchievementType } from '@/lib/gamification';

const TEAL = '#2DD4BF';
const CORAL = '#FF9F5A';
const WHITE = '#FFFFFF';
const LOCKED_GRAY = '#5C8484';

const TEAL_GRADIENT = ['#0a1e20', '#142b2e'] as const;
const CORAL_GRADIENT = ['#2a1a08', '#1a1006'] as const;

const CORAL_TYPES = new Set<AchievementType>(['local_legend', 'founding_member', 'connector']);

type Props = {
  type: AchievementType;
  locked?: boolean;
  size?: number;
};

const resolveColor = (color: string, locked: boolean) => (locked ? LOCKED_GRAY : color);

function AchievementIcon({
  type,
  locked,
  iconSize,
}: {
  type: AchievementType;
  locked: boolean;
  iconSize: number;
}) {
  const teal = resolveColor(TEAL, locked);
  const coral = resolveColor(CORAL, locked);
  const white = resolveColor(WHITE, locked);

  const icon = (() => {
    switch (type) {
      case 'pioneer':
        return (
          <>
            <Path
              d="M28 8 L48 28 L28 48 L8 28 Z"
              stroke={teal}
              strokeWidth={1.8}
              fill="none"
              strokeLinejoin="round"
            />
            <Circle cx={28} cy={28} r={3} fill={teal} />
          </>
        );
      case 'navigator':
        return (
          <>
            <Circle cx={28} cy={28} r={14} stroke={teal} strokeWidth={1.5} fill="none" />
            <Line x1={28} y1={10} x2={28} y2={16} stroke={coral} strokeWidth={2.5} strokeLinecap="round" />
            <Line x1={28} y1={40} x2={28} y2={46} stroke={teal} strokeWidth={2} strokeLinecap="round" />
            <Line x1={10} y1={28} x2={16} y2={28} stroke={teal} strokeWidth={2} strokeLinecap="round" />
            <Line x1={40} y1={28} x2={46} y2={28} stroke={teal} strokeWidth={2} strokeLinecap="round" />
            <Circle cx={28} cy={28} r={3} fill={teal} />
          </>
        );
      case 'pathfinder':
        return (
          <>
            <Circle cx={28} cy={28} r={14} stroke={teal} strokeWidth={1.5} fill="none" opacity={locked ? 0.5 : 0.5} />
            <Path d="M28 12 L32 26 L28 30 L24 26 Z" fill={coral} />
            <Path d="M28 44 L32 30 L28 26 L24 30 Z" fill={teal} opacity={locked ? 0.5 : 0.5} />
            <Circle cx={28} cy={28} r={2.5} fill={white} />
          </>
        );
      case 'trailblazer':
        return (
          <>
            <Path
              d="M8 44 L28 16 L48 44"
              stroke={teal}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
            />
            <Path
              d="M18 44 L33 26 L48 44"
              stroke={teal}
              strokeWidth={1.5}
              fill="none"
              strokeLinejoin="round"
              opacity={0.4}
            />
            <Line x1={28} y1={16} x2={28} y2={10} stroke={coral} strokeWidth={2} strokeLinecap="round" />
          </>
        );
      case 'local_legend':
        return (
          <>
            <Circle cx={22} cy={21} r={8} stroke={coral} strokeWidth={1.8} fill="none" />
            <Line x1={22} y1={29} x2={22} y2={40} stroke={coral} strokeWidth={2} strokeLinecap="round" />
            <Circle cx={36} cy={25} r={6} stroke={coral} strokeWidth={1.5} fill="none" opacity={0.55} />
            <Line x1={36} y1={31} x2={36} y2={40} stroke={coral} strokeWidth={1.5} strokeLinecap="round" opacity={0.55} />
            <Circle cx={22} cy={21} r={2.5} fill={coral} />
          </>
        );
      case 'founding_member':
        return (
          <Path
            d="M28 8 L31.5 19 L44 19 L34.5 26 L38 37 L28 30.5 L18 37 L21.5 26 L12 19 L24.5 19 Z"
            stroke={coral}
            strokeWidth={1.8}
            fill="none"
            strokeLinejoin="round"
          />
        );
      case 'secret_finder':
        return (
          <>
            <Path d="M6 28 Q28 10 50 28 Q28 46 6 28 Z" stroke={teal} strokeWidth={1.8} fill="none" />
            <Circle cx={28} cy={28} r={6} stroke={teal} strokeWidth={1.8} fill="none" />
            <Circle cx={28} cy={28} r={2.5} fill={teal} />
          </>
        );
      case 'connector':
        return (
          <>
            <Circle cx={20} cy={19} r={7} stroke={coral} strokeWidth={1.8} fill="none" />
            <Path
              d="M8 44 Q9 30 20 30 Q31 30 32 44"
              stroke={coral}
              strokeWidth={1.8}
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx={36} cy={21} r={5.5} stroke={coral} strokeWidth={1.5} fill="none" opacity={0.55} />
            <Path
              d="M27 46 Q28 35 36 35 Q44 35 45 46"
              stroke={coral}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              opacity={0.55}
            />
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <Svg width={iconSize} height={iconSize} viewBox="0 0 56 56">
      {icon}
    </Svg>
  );
}

export const getAchievementAccentColor = (type: AchievementType) =>
  CORAL_TYPES.has(type) ? CORAL : TEAL;

export const AchievementBadge = ({ type, locked = false, size = 48 }: Props) => {
  const isCoral = CORAL_TYPES.has(type);
  const borderColor = locked ? LOCKED_GRAY : isCoral ? CORAL : TEAL;
  const gradientColors = locked
    ? (['#1a2224', '#141a1c'] as const)
    : isCoral
      ? CORAL_GRADIENT
      : TEAL_GRADIENT;
  const iconSize = size * 0.58;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor,
          opacity: locked ? 0.4 : 1,
        },
      ]}>
      <LinearGradient
        colors={[...gradientColors]}
        style={[styles.gradient, { borderRadius: size / 2 }]}>
        <AchievementIcon type={type} locked={locked} iconSize={iconSize} />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
