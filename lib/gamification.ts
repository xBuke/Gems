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

export const ACHIEVEMENTS = [
  { type: 'first_gem', name: 'First Gem', description: 'Dropped your first gem', icon: 'location' },
  { type: 'five_gems', name: 'Getting Started', description: 'Dropped 5 gems', icon: 'location' },
  { type: 'ten_visits', name: 'Verified Explorer', description: '10 verified visits', icon: 'checkmark-circle' },
  { type: 'first_follower', name: 'Making Friends', description: 'Got your first follower', icon: 'people' },
  { type: 'five_categories', name: 'Well Rounded', description: 'Added gems in 5 different categories', icon: 'grid' },
  { type: 'first_like_received', name: 'Crowd Pleaser', description: 'Received your first like', icon: 'heart' },
  { type: 'seven_day_streak', name: 'Committed', description: '7 day streak', icon: 'flame' },
  { type: 'first_to_discover', name: 'Pioneer', description: 'First to discover a spot in your area', icon: 'star' },
];

export const checkAndUnlockAchievements = async (userId: string) => {
  const { supabase } = await import('./supabase');

  const { data: existing } = await supabase.from('achievements').select('badge_type').eq('user_id', userId);
  const unlockedTypes = existing?.map((a: { badge_type: string }) => a.badge_type) || [];
  console.log('Already unlocked:', unlockedTypes);

  const tryUnlock = async (type: string) => {
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

  const newlyUnlocked: string[] = [];

  const { count: gemCount } = await supabase
    .from('gems')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((gemCount || 0) >= 1 && (await tryUnlock('first_gem'))) newlyUnlocked.push('first_gem');
  if ((gemCount || 0) >= 5 && (await tryUnlock('five_gems'))) newlyUnlocked.push('five_gems');

  const { count: visitCount } = await supabase
    .from('gem_visits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((visitCount || 0) >= 10 && (await tryUnlock('ten_visits'))) newlyUnlocked.push('ten_visits');

  const { count: followerCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId)
    .eq('status', 'accepted');
  if ((followerCount || 0) >= 1 && (await tryUnlock('first_follower'))) newlyUnlocked.push('first_follower');

  const { data: userGems } = await supabase.from('gems').select('category').eq('user_id', userId);
  const uniqueCategories = new Set(userGems?.map((g: { category: string }) => g.category?.toLowerCase()));
  if (uniqueCategories.size >= 5 && (await tryUnlock('five_categories'))) newlyUnlocked.push('five_categories');

  const { data: gemIds } = await supabase.from('gems').select('id').eq('user_id', userId);
  let likesReceived: number | null = null;
  if (gemIds && gemIds.length > 0) {
    const { count } = await supabase
      .from('gem_likes')
      .select('*', { count: 'exact', head: true })
      .in('gem_id', gemIds.map((g: { id: string }) => g.id));
    likesReceived = count;
    if ((likesReceived || 0) >= 1 && (await tryUnlock('first_like_received'))) newlyUnlocked.push('first_like_received');
  }

  const { data: profile } = await supabase.from('profiles').select('current_streak').eq('id', userId).single();
  if ((profile?.current_streak || 0) >= 7 && (await tryUnlock('seven_day_streak'))) newlyUnlocked.push('seven_day_streak');

  const { count: firstDiscoveries } = await supabase
    .from('gems')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_first_in_area', true);
  if ((firstDiscoveries || 0) >= 1 && (await tryUnlock('first_to_discover'))) newlyUnlocked.push('first_to_discover');

  console.log('gemCount:', gemCount);
  console.log('visitCount:', visitCount);
  console.log('followerCount:', followerCount);
  console.log('uniqueCategories.size:', uniqueCategories.size);
  console.log('likesReceived:', likesReceived);
  console.log('current_streak:', profile?.current_streak);
  console.log('firstDiscoveries:', firstDiscoveries);
  console.log('Newly unlocked this call:', newlyUnlocked);

  return newlyUnlocked;
};
