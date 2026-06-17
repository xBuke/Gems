import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  bg: '#0D0D0D',
  card: '#141414',
  accent: '#1D9E75',
  accentSubtle: '#0F3D25',
  text: '#F5F5F5',
  textMuted: '#888888',
  textDim: '#555555',
  border: '#222222',
  danger: '#FF4444',
};

type Profile = {
  id: string;
  username: string;
};

type Gem = {
  id: string;
  title: string;
  category: string;
  image_url: string | null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { userId: userIdParam } = useLocalSearchParams<{ userId?: string }>();
  const targetUserId = typeof userIdParam === 'string' ? userIdParam : null;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gems, setGems] = useState<Gem[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);

  const isOwnProfile = !targetUserId || targetUserId === currentUserId;
  const isOtherProfile = !!targetUserId && targetUserId !== currentUserId;

  const fetchFollowCounts = useCallback(async (uid: string) => {
    const { count: followers } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', uid);

    const { count: following } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', uid);

    setFollowersCount(followers ?? 0);
    setFollowingCount(following ?? 0);
  }, []);

  const checkFollowing = useCallback(async (myId: string, theirId: string) => {
    const { data } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_id', myId)
      .eq('following_id', theirId);

    setIsFollowing(!!data && data.length > 0);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      if (isOwnProfile && user) {
        setEmail(user.email ?? null);
      } else {
        setEmail(null);
      }

      const uid = targetUserId ?? user?.id;
      if (!uid) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();
      if (profileData) setProfile(profileData);

      const { data: gemsData } = await supabase
        .from('gems')
        .select('*')
        .eq('user_id', uid);
      if (gemsData) setGems(gemsData);

      await fetchFollowCounts(uid);

      if (targetUserId && user && targetUserId !== user.id) {
        await checkFollowing(user.id, targetUserId);
      } else {
        setIsFollowing(false);
      }
    };

    fetchData();
  }, [targetUserId, checkFollowing, fetchFollowCounts, isOwnProfile]);

  const username = profile?.username ?? 'User';
  const initials = username.charAt(0).toUpperCase();

  const handleFollow = async () => {
    if (!currentUserId || !targetUserId) return;

    await supabase.from('follows').insert({
      follower_id: currentUserId,
      following_id: targetUserId,
    });

    setIsFollowing(true);
    await fetchFollowCounts(targetUserId);
  };

  const handleUnfollow = async () => {
    if (!currentUserId || !targetUserId) return;

    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId);

    setIsFollowing(false);
    await fetchFollowCounts(targetUserId);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/auth');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {isOwnProfile ? (
          <TouchableOpacity onPress={() => console.log('settings')} activeOpacity={0.7}>
            <Ionicons name="settings-outline" size={24} color={COLORS.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.username}>{username}</Text>
          {isOwnProfile && email ? <Text style={styles.email}>{email}</Text> : null}

          {targetUserId && currentUserId && targetUserId !== currentUserId && (
            <TouchableOpacity
              style={isFollowing ? styles.followingButton : styles.followButton}
              onPress={isFollowing ? handleUnfollow : handleFollow}
              activeOpacity={0.8}>
              <Text style={isFollowing ? styles.followingButtonText : styles.followButtonText}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{gems.length}</Text>
            <Text style={styles.statLabel}>Gems</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{followersCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{isOwnProfile ? 'My Gems' : 'Gems'}</Text>

        {gems.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={48} color={COLORS.textDim} />
            <Text style={styles.emptyText}>No gems yet</Text>
            {isOwnProfile && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push('/add-gem')}
                activeOpacity={0.7}>
                <Text style={styles.addButtonText}>Add your first gem</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.gemsGrid}>
            {gems.map((gem) => (
              <TouchableOpacity
                key={gem.id}
                style={styles.gemCard}
                onPress={() => router.push('/gem/' + gem.id)}
                activeOpacity={0.8}>
                {gem.image_url ? (
                  <Image source={{ uri: gem.image_url }} style={styles.gemImage} />
                ) : (
                  <View style={styles.gemPlaceholder} />
                )}
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{gem.category}</Text>
                </View>
                <View style={styles.gemTitleContainer}>
                  <Text style={styles.gemTitle} numberOfLines={2}>
                    {gem.title}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {isOwnProfile && (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '600',
    color: COLORS.bg,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 12,
  },
  email: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  followButton: {
    marginTop: 16,
    backgroundColor: COLORS.accent,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.bg,
  },
  followingButton: {
    marginTop: 16,
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  followingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  statDivider: {
    width: 0.5,
    height: 32,
    backgroundColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  gemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gemCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  gemImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  gemPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1A1A1A',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 36,
    left: 8,
    backgroundColor: COLORS.accentSubtle,
    borderWidth: 0.5,
    borderColor: COLORS.accent,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.accent,
  },
  gemTitleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 4,
    backgroundColor: 'rgba(13, 13, 13, 0.8)',
  },
  gemTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  addButton: {
    marginTop: 8,
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.bg,
  },
  logoutButton: {
    alignItems: 'center',
    paddingVertical: 32,
    marginTop: 16,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.danger,
  },
});
