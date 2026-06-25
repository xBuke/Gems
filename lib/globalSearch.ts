import { applyCommunityGemFilter, fetchMyCommunityIds } from '@/lib/gemVisibility';
import { getDistance } from '@/lib/distance';
import { getMyBlockedUsers } from '@/lib/safety';
import { supabase } from '@/lib/supabase';

export type SearchFilter = 'all' | 'gems' | 'people' | 'places';

export type GemSearchResult = {
  type: 'gem';
  id: string;
  title: string;
  image_url: string | null;
  category: string;
  city_name: string | null;
  latitude: number;
  longitude: number;
  likeCount: number;
  distanceMeters: number | null;
};

export type PersonSearchResult = {
  type: 'person';
  id: string;
  username: string;
  avatar_url: string | null;
  followerCount: number;
};

export type PlaceSearchResult = {
  type: 'place';
  cityName: string;
  gemCount: number;
  latitude: number;
  longitude: number;
};

export type SearchResult = GemSearchResult | PersonSearchResult | PlaceSearchResult;

export type SearchPageResult = {
  results: SearchResult[];
  hasMore: boolean;
};

const RESULT_LIMIT = 20;
const MIN_QUERY_LENGTH = 2;

const sanitizeIlike = (query: string) => query.replace(/[%_]/g, '').trim();

const fetchGemLikeCounts = async (gemIds: string[]): Promise<Record<string, number>> => {
  if (gemIds.length === 0) return {};

  const { data } = await supabase.from('gem_likes').select('gem_id').in('gem_id', gemIds);
  const counts: Record<string, number> = {};
  for (const gemId of gemIds) counts[gemId] = 0;
  for (const row of data ?? []) {
    counts[row.gem_id] = (counts[row.gem_id] ?? 0) + 1;
  }
  return counts;
};

const fetchFollowerCounts = async (userIds: string[]): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  await Promise.all(
    userIds.map(async (userId) => {
      const { count } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId)
        .eq('status', 'accepted');
      counts[userId] = count ?? 0;
    }),
  );
  return counts;
};

type GemSearchRow = {
  id: string;
  title: string;
  image_url: string | null;
  category: string;
  city_name: string | null;
  latitude: number;
  longitude: number;
  user_id: string;
};

type ProfileSearchRow = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export const searchGems = async (
  query: string,
  userCoords: { latitude: number; longitude: number } | null,
  offset = 0,
): Promise<GemSearchResult[]> => {
  const q = sanitizeIlike(query);
  if (q.length < MIN_QUERY_LENGTH) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myCommunityIds = await fetchMyCommunityIds(user?.id ?? null);
  const blocked = user ? await getMyBlockedUsers(user.id) : [];
  const blockedIds = new Set(blocked.map((row: { blocked_id: string }) => row.blocked_id));

  const from = offset;
  const to = offset + RESULT_LIMIT - 1;

  let gemQuery = supabase
    .from('gems')
    .select('id, title, image_url, category, city_name, latitude, longitude, user_id, created_at')
    .eq('is_private', false)
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .range(from, to);

  gemQuery = applyCommunityGemFilter(gemQuery, myCommunityIds);

  const { data, error } = await gemQuery;
  if (error || !data) return [];

  const gems = (data as GemSearchRow[]).filter((gem) => !blockedIds.has(gem.user_id));
  const likeCounts = await fetchGemLikeCounts(gems.map((gem) => gem.id));

  return gems.map((gem) => ({
    type: 'gem' as const,
    id: gem.id,
    title: gem.title,
    image_url: gem.image_url,
    category: gem.category,
    city_name: gem.city_name,
    latitude: gem.latitude,
    longitude: gem.longitude,
    likeCount: likeCounts[gem.id] ?? 0,
    distanceMeters: userCoords
      ? getDistance(userCoords.latitude, userCoords.longitude, gem.latitude, gem.longitude)
      : null,
  }));
};

export const searchPeople = async (query: string, offset = 0): Promise<PersonSearchResult[]> => {
  const q = sanitizeIlike(query);
  if (q.length < MIN_QUERY_LENGTH) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const blocked = user ? await getMyBlockedUsers(user.id) : [];
  const blockedIds = new Set(blocked.map((row: { blocked_id: string }) => row.blocked_id));

  const from = offset;
  const to = offset + RESULT_LIMIT - 1;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .ilike('username', `%${q}%`)
    .range(from, to);

  if (error || !data) return [];

  const profiles = (data as ProfileSearchRow[]).filter(
    (profile) => profile.id !== user?.id && !blockedIds.has(profile.id),
  );
  const followerCounts = await fetchFollowerCounts(profiles.map((profile) => profile.id));

  return profiles.map((profile) => ({
    type: 'person' as const,
    id: profile.id,
    username: profile.username,
    avatar_url: profile.avatar_url ?? null,
    followerCount: followerCounts[profile.id] ?? 0,
  }));
};

export const searchPlaces = async (query: string, offset = 0): Promise<PlaceSearchResult[]> => {
  const q = sanitizeIlike(query);
  if (q.length < MIN_QUERY_LENGTH) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myCommunityIds = await fetchMyCommunityIds(user?.id ?? null);

  const gemFetchLimit = Math.min(200 + offset * 50, 500);

  let placeQuery = supabase
    .from('gems')
    .select('city_name, latitude, longitude')
    .eq('is_private', false)
    .not('city_name', 'is', null)
    .ilike('city_name', `%${q}%`)
    .limit(gemFetchLimit);

  placeQuery = applyCommunityGemFilter(placeQuery, myCommunityIds);

  const { data, error } = await placeQuery;
  if (error || !data) return [];

  const grouped = new Map<string, { gemCount: number; latitude: number; longitude: number }>();

  for (const row of data) {
    const cityName = row.city_name?.trim();
    if (!cityName) continue;

    const existing = grouped.get(cityName);
    if (existing) {
      existing.gemCount += 1;
    } else {
      grouped.set(cityName, {
        gemCount: 1,
        latitude: row.latitude,
        longitude: row.longitude,
      });
    }
  }

  return Array.from(grouped.entries())
    .map(([cityName, info]) => ({
      type: 'place' as const,
      cityName,
      gemCount: info.gemCount,
      latitude: info.latitude,
      longitude: info.longitude,
    }))
    .sort((a, b) => b.gemCount - a.gemCount)
    .slice(offset, offset + RESULT_LIMIT);
};

export const runGlobalSearch = async (
  query: string,
  filter: SearchFilter,
  userCoords: { latitude: number; longitude: number } | null,
): Promise<SearchResult[]> => {
  const { results } = await runGlobalSearchPage(query, filter, userCoords, 0);
  return results;
};

export const runGlobalSearchPage = async (
  query: string,
  filter: SearchFilter,
  userCoords: { latitude: number; longitude: number } | null,
  page = 0,
): Promise<SearchPageResult> => {
  const q = sanitizeIlike(query);
  if (q.length < MIN_QUERY_LENGTH) return { results: [], hasMore: false };

  const offset = page * RESULT_LIMIT;

  if (filter === 'gems') {
    const results = await searchGems(q, userCoords, offset);
    return { results, hasMore: results.length === RESULT_LIMIT };
  }

  if (filter === 'people') {
    const results = await searchPeople(q, offset);
    return { results, hasMore: results.length === RESULT_LIMIT };
  }

  if (filter === 'places') {
    const results = await searchPlaces(q, offset);
    return { results, hasMore: results.length === RESULT_LIMIT };
  }

  const [gems, people, places] = await Promise.all([
    searchGems(q, userCoords, offset),
    searchPeople(q, offset),
    searchPlaces(q, offset),
  ]);

  const results = [...gems, ...people, ...places];
  const hasMore =
    gems.length === RESULT_LIMIT ||
    people.length === RESULT_LIMIT ||
    places.length === RESULT_LIMIT;

  return { results, hasMore };
};
