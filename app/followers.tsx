import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ProfileSummary = {
  id: string;
  username: string;
  avatar_url?: string | null;
};

type FollowRow = {
  id: string;
  follower?: ProfileSummary;
  following?: ProfileSummary;
};

export default function FollowersScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { userId, type } = useLocalSearchParams<{ userId: string; type: 'followers' | 'following' }>();
  const [users, setUsers] = useState<ProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  const isFollowers = type === 'followers';
  const title = isFollowers ? 'Followers' : 'Following';
  const isOwnList = currentUserId === userId;

  const fetchData = useCallback(async () => {
    if (!userId) return;

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    if (user) {
      const { data: myFollows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .eq('status', 'accepted');

      setFollowingIds(new Set((myFollows ?? []).map((f: { following_id: string }) => f.following_id)));
    }

    if (isFollowers) {
      const { data } = await supabase
        .from('follows')
        .select('*, follower:profiles!follows_follower_id_fkey(id, username, avatar_url)')
        .eq('following_id', userId)
        .eq('status', 'accepted');

      const list = (data as FollowRow[] | null)?.map((row) => row.follower).filter(Boolean) as ProfileSummary[];
      setUsers(list ?? []);
    } else {
      const { data } = await supabase
        .from('follows')
        .select('*, following:profiles!follows_following_id_fkey(id, username, avatar_url)')
        .eq('follower_id', userId)
        .eq('status', 'accepted');

      const list = (data as FollowRow[] | null)?.map((row) => row.following).filter(Boolean) as ProfileSummary[];
      setUsers(list ?? []);
    }

    setLoading(false);
  }, [userId, isFollowers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const handleFollow = async (targetId: string) => {
    if (!currentUserId) return;

    await supabase.from('follows').insert({
      follower_id: currentUserId,
      following_id: targetId,
    });

    await supabase.from('notifications').insert({
      user_id: targetId,
      sender_id: currentUserId,
      type: 'follow',
      gem_id: null,
      read: false,
    });

    setFollowingIds((prev) => new Set(prev).add(targetId));
  };

  const handleUnfollow = async (targetId: string) => {
    if (!currentUserId) return;

    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', targetId);

    setFollowingIds((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
  };

  const handleRemoveFollower = (followerId: string, followerUsername: string) => {
    if (!currentUserId) return;

    Alert.alert(
      'Remove follower',
      `Remove ${followerUsername} from your followers?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('follows')
              .delete()
              .eq('follower_id', followerId)
              .eq('following_id', currentUserId);

            setUsers((prev) => prev.filter((user) => user.id !== followerId));
          },
        },
      ],
    );
  };

  const handleUnfollowFromOwnList = async (targetId: string) => {
    if (!currentUserId) return;

    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', targetId);

    setUsers((prev) => prev.filter((user) => user.id !== targetId));
    setFollowingIds((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
  };

  const renderItem = ({ item }: { item: ProfileSummary }) => {
    const initials = (item.username ?? 'U').charAt(0).toUpperCase();
    const isSelf = item.id === currentUserId;
    const isFollowing = followingIds.has(item.id);

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => router.push({ pathname: '/profile', params: { userId: item.id } })}
        activeOpacity={0.7}>
        <View style={styles.avatar}>
          {item.avatar_url ? (
            <Image
              source={{ uri: item.avatar_url }}
              style={styles.avatarImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>
        <Text style={styles.username} numberOfLines={1}>
          {item.username}
        </Text>
        {!isSelf && !isOwnList ? (
          <TouchableOpacity
            style={isFollowing ? styles.followingButton : styles.followButton}
            onPress={() => {
              if (isFollowing) {
                handleUnfollow(item.id);
              } else {
                handleFollow(item.id);
              }
            }}
            activeOpacity={0.8}>
            <Text style={isFollowing ? styles.followingButtonText : styles.followButtonText}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        ) : null}
        {isOwnList && isFollowers && !isSelf ? (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveFollower(item.id, item.username)}
            activeOpacity={0.8}>
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        ) : null}
        {isOwnList && !isFollowers && !isSelf ? (
          <TouchableOpacity
            style={styles.unfollowButton}
            onPress={() => handleUnfollowFromOwnList(item.id)}
            activeOpacity={0.8}>
            <Text style={styles.unfollowButtonText}>Unfollow</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSide} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No {title.toLowerCase()} yet</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    listContent: {
      paddingVertical: 8,
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.card,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.border,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    username: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    followButton: {
      backgroundColor: theme.accent,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    followButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.background,
    },
    followingButton: {
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.accent,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    followingButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.accent,
    },
    removeButton: {
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.danger,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    removeButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.danger,
    },
    unfollowButton: {
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.accent,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    unfollowButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.accent,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: 15,
      color: theme.textSecondary,
    },
  });
