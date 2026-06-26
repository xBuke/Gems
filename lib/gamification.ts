import { sendPushNotification } from './sendPushNotification';

export const EXPLORER_LEVELS = [
  { name: 'Wanderer', minPoints: 0, icon: 'footsteps-outline' },
  { name: 'Scout', minPoints: 50, icon: 'compass-outline' },
  { name: 'Pathfinder', minPoints: 200, icon: 'map-outline' },
  { name: 'Trailblazer', minPoints: 500, icon: 'flag-outline' },
  { name: 'Legend', minPoints: 1500, icon: 'trophy-outline' },
];

export const getExplorerLevel = (points: number) => {
  let current = EXPLORER_LEVELS[0];
  for (const level of EXPLORER_LEVELS) {
    if (points >= level.minPoints) current = level;
  }
  return current;
};

export const getNextLevel = (points: number) => {
  return EXPLORER_LEVELS.find((level) => level.minPoints > points) || null;
};

export const getExplorerLevelIndex = (points: number) =>
  EXPLORER_LEVELS.findIndex((l, i) =>
    points >= l.minPoints && (EXPLORER_LEVELS[i + 1]?.minPoints ?? Infinity) > points,
  ) + 1;

export const MASTERY_TIERS = [
  { name: 'Novice', minVisits: 0 },
  { name: 'Explorer', minVisits: 3 },
  { name: 'Enthusiast', minVisits: 7 },
  { name: 'Expert', minVisits: 15 },
  { name: 'Master', minVisits: 30 },
];

export const getMasteryTier = (visits: number) => {
  let current = MASTERY_TIERS[0];
  for (const tier of MASTERY_TIERS) {
    if (visits >= tier.minVisits) current = tier;
  }
  return current;
};

export const getNextMasteryTier = (visits: number) => {
  return MASTERY_TIERS.find((tier) => tier.minVisits > visits) || null;
};

export type AchievementType =
  | 'pioneer'
  | 'navigator'
  | 'pathfinder'
  | 'trailblazer'
  | 'local_legend'
  | 'founding_member'
  | 'secret_finder'
  | 'connector';

export const ACHIEVEMENTS: {
  type: AchievementType;
  name: string;
  description: string;
}[] = [
  { type: 'pioneer', name: 'Pioneer', description: 'First gem dropped' },
  { type: 'navigator', name: 'Navigator', description: '10 check-ins' },
  { type: 'pathfinder', name: 'Pathfinder', description: '50 check-ins' },
  { type: 'trailblazer', name: 'Trailblazer', description: '25 gems dropped' },
  { type: 'local_legend', name: 'Local Legend', description: '5 gems in one area' },
  { type: 'founding_member', name: 'Founding Member', description: 'Early supporter' },
  { type: 'secret_finder', name: 'Secret Finder', description: 'Gem with <3 visitors' },
  { type: 'connector', name: 'Connector', description: 'Joined 3 communities' },
];

const SECRET_FINDER_MIN_AGE_DAYS = 30;

const hasLocalLegendCity = (gems: { city_name: string | null }[] | null) => {
  const cityCounts = new Map<string, number>();
  for (const gem of gems ?? []) {
    const city = gem.city_name?.trim();
    if (!city) continue;
    const cityKey = city.toLowerCase();
    cityCounts.set(cityKey, (cityCounts.get(cityKey) ?? 0) + 1);
  }
  return [...cityCounts.values()].some((count) => count >= 5);
};

const hasSecretGem = (
  gems: { id: string; created_at: string }[] | null,
  visitCounts: Map<string, number>,
) => {
  const cutoff = Date.now() - SECRET_FINDER_MIN_AGE_DAYS * 24 * 60 * 60 * 1000;
  return (gems ?? []).some(
    (gem) => new Date(gem.created_at).getTime() < cutoff && (visitCounts.get(gem.id) ?? 0) < 3,
  );
};

export const checkAndUnlockAchievements = async (userId: string) => {
  const { supabase } = await import('./supabase');

  const { data: existing } = await supabase.from('achievements').select('badge_type').eq('user_id', userId);
  const unlockedTypes = existing?.map((a: { badge_type: string }) => a.badge_type) || [];

  const tryUnlock = async (type: AchievementType) => {
    if (!unlockedTypes.includes(type)) {
      await supabase.from('achievements').insert({ user_id: userId, badge_type: type });
      const badge = ACHIEVEMENTS.find((a) => a.type === type);
      sendPushNotification({
        user_id: userId,
        category: 'achievements',
        title: 'Achievement unlocked!',
        body: `You earned ${badge?.name ?? type}`,
        data: { type: 'achievement', badge_type: type },
      });
      return true;
    }
    return false;
  };

  const newlyUnlocked: AchievementType[] = [];

  const { count: gemCount } = await supabase
    .from('gems')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((gemCount || 0) >= 1 && (await tryUnlock('pioneer'))) newlyUnlocked.push('pioneer');
  if ((gemCount || 0) >= 25 && (await tryUnlock('trailblazer'))) newlyUnlocked.push('trailblazer');

  const { count: visitCount } = await supabase
    .from('gem_visits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((visitCount || 0) >= 10 && (await tryUnlock('navigator'))) newlyUnlocked.push('navigator');
  if ((visitCount || 0) >= 50 && (await tryUnlock('pathfinder'))) newlyUnlocked.push('pathfinder');

  const { data: cityGems } = await supabase
    .from('gems')
    .select('city_name')
    .eq('user_id', userId)
    .not('city_name', 'is', null);
  if (hasLocalLegendCity(cityGems) && (await tryUnlock('local_legend'))) {
    newlyUnlocked.push('local_legend');
  }

  const { data: isFoundingMember, error: foundingError } = await supabase.rpc('is_founding_member', {
    user_id: userId,
  });
  if (!foundingError && isFoundingMember === true && (await tryUnlock('founding_member'))) {
    newlyUnlocked.push('founding_member');
  }

  const { data: userGems } = await supabase
    .from('gems')
    .select('id, created_at')
    .eq('user_id', userId);
  if (userGems && userGems.length > 0) {
    const { data: visits } = await supabase
      .from('gem_visits')
      .select('gem_id')
      .in(
        'gem_id',
        userGems.map((g: { id: string }) => g.id),
      );
    const visitCounts = new Map<string, number>();
    visits?.forEach((v: { gem_id: string }) => {
      visitCounts.set(v.gem_id, (visitCounts.get(v.gem_id) ?? 0) + 1);
    });
    if (hasSecretGem(userGems, visitCounts) && (await tryUnlock('secret_finder'))) {
      newlyUnlocked.push('secret_finder');
    }
  }

  const { count: communityCount } = await supabase
    .from('community_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'accepted');
  if ((communityCount || 0) >= 3 && (await tryUnlock('connector'))) newlyUnlocked.push('connector');

  return newlyUnlocked;
};
