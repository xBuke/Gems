import { requireAuth } from '@/lib/authGuard';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
  border: '#222222',
  danger: '#FF4444',
  dangerBg: '#1A1A1A',
  imagePlaceholder: '#1A5C3A',
  avatarText: '#0D0D0D',
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

const chunk = <T,>(items: T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gems, setGems] = useState<Gem[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isOwn = !userId || userId === user.id;
    const profileId = isOwn ? user.id : userId;

    setIsOwnProfile(isOwn);
    setCurrentUserId(user.id);
    setEmail(isOwn ? user.email ?? null : null);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();
    if (profileData) setProfile(profileData);

    const { data: gemsData } = await supabase
      .from('gems')
      .select('*')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false });
    if (gemsData) setGems(gemsData);

    const { count: following } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profileId);

    const { count: followers } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profileId);

    setFollowingCount(following ?? 0);
    setFollowersCount(followers ?? 0);

    if (!isOwn) {
      const { data: followData } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', userId);

      setIsFollowing(!!followData && followData.length > 0);
    } else {
      setIsFollowing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const username = profile?.username ?? 'User';
  const initials = username.charAt(0).toUpperCase();
  const gemRows = chunk(gems, 2);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth');
        },
      },
    ]);
  };

  const handleFollow = async () => {
    if (!currentUserId || !userId) return;

    await supabase.from('follows').insert({
      follower_id: currentUserId,
      following_id: userId,
    });

    await supabase.from('notifications').insert({
      user_id: userId,
      sender_id: currentUserId,
      type: 'follow',
      gem_id: null,
      read: false,
    });

    setIsFollowing(true);
    await fetchData();
  };

  const handleUnfollow = async () => {
    if (!currentUserId || !userId) return;

    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', userId);

    setIsFollowing(false);
    await fetchData();
  };

  const handleSendMessage = async () => {
    if (!userId) return;

    const proceed = await requireAuth();
    if (!proceed) return;

    router.push({
      pathname: '/chat',
      params: { userId, username },
    });
  };

  const renderGemCard = (gem: Gem) => (
    <TouchableOpacity
      key={gem.id}
      style={styles.gemCard}
      onPress={() => router.push('/gem/' + gem.id)}
      activeOpacity={0.8}>
      {gem.image_url ? (
        <Image source={{ uri: gem.image_url }} style={styles.gemImage} resizeMode="cover" />
      ) : (
        <View style={styles.gemImagePlaceholder}>
          <Ionicons name="location" size={24} color={COLORS.accent} />
        </View>
      )}
      <View style={styles.gemCardFooter}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{gem.category}</Text>
        </View>
        <Text style={styles.gemTitle} numberOfLines={2}>
          {gem.title}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isOwnProfile ? 'Profile' : username}</Text>
        {isOwnProfile ? (
          <TouchableOpacity onPress={() => console.log('settings')} activeOpacity={0.7}>
            <Ionicons name="settings-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.username}>{username}</Text>
          {isOwnProfile && email ? <Text style={styles.email}>{email}</Text> : null}

          {!isOwnProfile && (
            <>
              <TouchableOpacity
                style={isFollowing ? styles.followingButton : styles.followButton}
                onPress={isFollowing ? handleUnfollow : handleFollow}
                activeOpacity={0.8}>
                <Text style={isFollowing ? styles.followingButtonText : styles.followButtonText}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.messageButton}
                onPress={handleSendMessage}
                activeOpacity={0.8}>
                <Ionicons name="chatbubble-outline" size={16} color={COLORS.accent} />
                <Text style={styles.messageButtonText}>Send Message</Text>
              </TouchableOpacity>
            </>
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

        <Text style={styles.sectionTitle}>My Gems</Text>

        {gems.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={48} color={COLORS.accent} />
            <Text style={styles.emptyText}>No gems yet</Text>
            {isOwnProfile && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push('/add-gem')}
                activeOpacity={0.8}>
                <Text style={styles.addButtonText}>Add your first gem</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.gemsGrid}>
            {gemRows.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.gemRow}>
                {row.map((gem) => renderGemCard(gem))}
                {row.length === 1 ? <View style={styles.gemCardSpacer} /> : null}
              </View>
            ))}
          </View>
        )}

        {isOwnProfile && (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 22,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
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
    color: COLORS.avatarText,
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
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 16,
    padding: 16,
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
    marginHorizontal: 16,
    marginBottom: 12,
  },
  gemsGrid: {
    paddingHorizontal: 12,
  },
  gemRow: {
    flexDirection: 'row',
  },
  gemCard: {
    flex: 1,
    height: 150,
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
  },
  gemCardSpacer: {
    flex: 1,
    margin: 4,
  },
  gemImage: {
    width: '100%',
    height: 110,
  },
  gemImagePlaceholder: {
    width: '100%',
    height: 110,
    backgroundColor: COLORS.imagePlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gemCardFooter: {
    padding: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accentSubtle,
    borderWidth: 0.5,
    borderColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: COLORS.accent,
  },
  gemTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
  addButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.bg,
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 14,
    backgroundColor: COLORS.dangerBg,
    borderWidth: 0.5,
    borderColor: COLORS.danger,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.danger,
  },
});
