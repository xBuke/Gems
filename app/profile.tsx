import { requireAuth } from '@/lib/authGuard';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptMode, setPromptMode] = useState<'username' | 'password' | null>(null);
  const [promptValue, setPromptValue] = useState('');
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

  const handleUpdateUsername = async (newUsername: string) => {
    const trimmed = newUsername.trim();
    if (!trimmed) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('id', user.id);

    if (error) {
      Alert.alert('Error', 'Could not update username');
      return;
    }

    setProfile((prev) => (prev ? { ...prev, username: trimmed } : prev));
  };

  const handleChangePassword = async (newPassword: string) => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Success', 'Password updated');
  };

  const showUsernamePrompt = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Edit Username',
        'Enter your new username',
        async (value) => {
          if (value) await handleUpdateUsername(value);
        },
        'plain-text',
        profile?.username ?? '',
      );
      return;
    }

    setPromptValue(profile?.username ?? '');
    setPromptMode('username');
    setPromptVisible(true);
  };

  const showPasswordPrompt = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Change Password',
        'Enter your new password',
        async (value) => {
          if (value) await handleChangePassword(value);
        },
        'secure-text',
      );
      return;
    }

    setPromptValue('');
    setPromptMode('password');
    setPromptVisible(true);
  };

  const handlePromptSubmit = async () => {
    const value = promptValue;
    const mode = promptMode;
    setPromptVisible(false);
    setPromptMode(null);
    setPromptValue('');

    if (mode === 'username') {
      await handleUpdateUsername(value);
    } else if (mode === 'password') {
      await handleChangePassword(value);
    }
  };

  const handleSettings = () => {
    Alert.alert('Settings', undefined, [
      { text: 'Edit Username', onPress: showUsernamePrompt },
      { text: 'Change Password', onPress: showPasswordPrompt },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

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
          <TouchableOpacity onPress={handleSettings} activeOpacity={0.7}>
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

      <Modal visible={promptVisible} transparent animationType="fade">
        <View style={styles.promptOverlay}>
          <View style={styles.promptBox}>
            <Text style={styles.promptTitle}>
              {promptMode === 'password' ? 'Change Password' : 'Edit Username'}
            </Text>
            <Text style={styles.promptMessage}>
              {promptMode === 'password'
                ? 'Enter your new password'
                : 'Enter your new username'}
            </Text>
            <TextInput
              style={styles.promptInput}
              value={promptValue}
              onChangeText={setPromptValue}
              secureTextEntry={promptMode === 'password'}
              autoFocus
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={styles.promptButtons}>
              <TouchableOpacity
                style={styles.promptCancelButton}
                onPress={() => {
                  setPromptVisible(false);
                  setPromptMode(null);
                  setPromptValue('');
                }}
                activeOpacity={0.8}>
                <Text style={styles.promptCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.promptSubmitButton}
                onPress={handlePromptSubmit}
                activeOpacity={0.8}>
                <Text style={styles.promptSubmitText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  promptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  promptBox: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 20,
  },
  promptTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  promptMessage: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  promptInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 16,
  },
  promptButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  promptCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  promptCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  promptSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
  },
  promptSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.bg,
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
