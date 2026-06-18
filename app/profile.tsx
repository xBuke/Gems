import { requireAuth } from '@/lib/authGuard';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

const IMAGE_PLACEHOLDER = '#1A5C3A';

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
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
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

  const handleDeleteGem = async (gemId: string, imageUrl: string | null) => {
    if (imageUrl) {
      const fileName = imageUrl.split('/').pop();
      if (fileName) {
        await supabase.storage.from('gem-images').remove([fileName]);
      }
    }

    const { error } = await supabase.from('gems').delete().eq('id', gemId);

    if (error) {
      Alert.alert('Error', 'Could not delete gem');
      return;
    }

    setGems((prev) => prev.filter((g) => g.id !== gemId));
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

  const profileId = isOwnProfile ? currentUserId : userId;

  const renderGemCard = (gem: Gem) => (
    <TouchableOpacity
      key={gem.id}
      style={styles.gemCard}
      onPress={() => router.push('/gem/' + gem.id)}
      onLongPress={
        isOwnProfile
          ? () =>
              Alert.alert('Delete Gem', gem.title + ' will be deleted permanently.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => handleDeleteGem(gem.id, gem.image_url),
                },
              ])
          : undefined
      }
      activeOpacity={0.8}>
      <View style={styles.gemImageArea}>
        {gem.image_url ? (
          <Image source={{ uri: gem.image_url }} style={styles.gemImage} resizeMode="cover" />
        ) : (
          <View style={styles.gemImagePlaceholder}>
            <Ionicons name="location" size={28} color={theme.accent} />
          </View>
        )}
        <View style={styles.gemOverlay}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{gem.category}</Text>
          </View>
          <Text style={styles.gemTitle} numberOfLines={2}>
            {gem.title}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {isOwnProfile ? (
          <TouchableOpacity onPress={() => router.push('/settings')} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="settings-outline" size={22} color={theme.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSide} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.username}>{username}</Text>
          <Text style={styles.bio}>Explorer & gem hunter 🌍</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{gems.length}</Text>
            <Text style={styles.statLabel}>Gems</Text>
          </View>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.statItem}
            onPress={() =>
              profileId &&
              router.push({ pathname: '/followers', params: { userId: profileId, type: 'following' } })
            }
            activeOpacity={0.7}>
            <Text style={styles.statValue}>{followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.statItem}
            onPress={() =>
              profileId &&
              router.push({ pathname: '/followers', params: { userId: profileId, type: 'followers' } })
            }
            activeOpacity={0.7}>
            <Text style={styles.statValue}>{followersCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
        </View>

        {!isOwnProfile && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={isFollowing ? styles.followingButton : styles.followButton}
              onPress={isFollowing ? handleUnfollow : handleFollow}
              activeOpacity={0.8}>
              <Text style={isFollowing ? styles.followingButtonText : styles.followButtonText}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.messageButton} onPress={handleSendMessage} activeOpacity={0.8}>
              <Ionicons name="chatbubble-outline" size={16} color={theme.accent} />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Gems</Text>
          <Text style={styles.sectionCount}>{gems.length}</Text>
        </View>

        {gems.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={56} color={theme.accent} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No gems yet</Text>
            <Text style={styles.emptySubtitle}>Start exploring and drop your first gem!</Text>
            {isOwnProfile && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push('/add-gem')}
                activeOpacity={0.8}>
                <Text style={styles.addButtonText}>Add Gem</Text>
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSide: {
    width: 22,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.accent,
    borderWidth: 3,
    borderColor: theme.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.text,
  },
  username: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginTop: 12,
  },
  bio: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 16,
    marginHorizontal: 20,
    marginVertical: 20,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textTertiary,
    marginTop: 2,
  },
  statDivider: {
    width: 0.5,
    height: 30,
    backgroundColor: theme.border,
    alignSelf: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  followButton: {
    flex: 1,
    backgroundColor: theme.accent,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.background,
  },
  followingButton: {
    flex: 1,
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.accent,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  followingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
  },
  messageButtonText: {
    fontSize: 14,
    color: theme.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  sectionCount: {
    fontSize: 13,
    color: theme.accent,
  },
  gemsGrid: {
    paddingHorizontal: 12,
  },
  gemRow: {
    flexDirection: 'row',
  },
  gemCard: {
    flex: 1,
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.card,
  },
  gemCardSpacer: {
    flex: 1,
    margin: 4,
  },
  gemImageArea: {
    height: 140,
    position: 'relative',
  },
  gemImage: {
    width: '100%',
    height: 140,
  },
  gemImagePlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: IMAGE_PLACEHOLDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gemOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.accent,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.background,
  },
  gemTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text,
    marginTop: 3,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  addButton: {
    marginTop: 20,
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.background,
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: theme.danger,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.danger,
  },
});
