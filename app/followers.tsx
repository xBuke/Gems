import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { sendPushNotification } from '@/lib/sendPushNotification';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
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
  const [followerIds, setFollowerIds] = useState<Set<string>>(new Set());

  const isFollowers = type === 'followers';
  const title = isFollowers ? 'Followers' : 'Following';
  const isOwnList = currentUserId === userId;

  const fetchData = useCallback(async () => {
    if (!userId) return;

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    if (user) {
      const [{ data: myFollows }, { data: myFollowers }] = await Promise.all([
        supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .eq('status', 'accepted'),
        supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id)
          .eq('status', 'accepted'),
      ]);

      setFollowingIds(new Set((myFollows ?? []).map((f: { following_id: string }) => f.following_id)));
      setFollowerIds(new Set((myFollowers ?? []).map((f: { follower_id: string }) => f.follower_id)));
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

    void (async () => {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', currentUserId)
        .single();
      sendPushNotification({
        user_id: targetId,
        category: 'social',
        title: 'New follower',
        body: `@${myProfile?.username ?? 'Someone'} started following you`,
        data: { type: 'follow', user_id: currentUserId },
      });
    })();

    setFollowingIds((prev) => new Set(prev).add(targetId));
  };

  const performUnfollow = async (targetId: string) => {
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

  const confirmUnfollow = (targetId: string, targetUsername: string, onSuccess?: () => void) => {
    Alert.alert('Unfollow', `Stop following @${targetUsername}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unfollow',
        style: 'destructive',
        onPress: async () => {
          await performUnfollow(targetId);
          onSuccess?.();
        },
      },
    ]);
  };

  const handleUnfollow = (targetId: string, targetUsername: string) => {
    confirmUnfollow(targetId, targetUsername);
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

  const handleUnfollowFromOwnList = (targetId: string, targetUsername: string) => {
    confirmUnfollow(targetId, targetUsername, () => {
      setUsers((prev) => prev.filter((user) => user.id !== targetId));
    });
  };

  const renderItem = ({ item }: { item: ProfileSummary }) => {
    const initials = (item.username ?? 'U').charAt(0).toUpperCase();
    const isSelf = item.id === currentUserId;
    const isYou = !isOwnList && isSelf;
    const isFollowing = followingIds.has(item.id);
    const followsMe = followerIds.has(item.id);
    const isMutual = isFollowing && followsMe;

    const followButtonState = isFollowing
      ? 'following'
      : followsMe
        ? 'followBack'
        : 'follow';

    const renderFollowButton = () => {
      if (isSelf || isOwnList) return null;

      if (isFollowers) {
        const buttonStyle =
          followButtonState === 'following'
            ? styles.followersFollowingButton
            : followButtonState === 'followBack'
              ? styles.followBackButton
              : styles.followDiscoverButton;
        const textStyle =
          followButtonState === 'following'
            ? styles.followersFollowingButtonText
            : followButtonState === 'followBack'
              ? styles.followBackButtonText
              : styles.followDiscoverButtonText;
        const label =
          followButtonState === 'following'
            ? 'Following'
            : followButtonState === 'followBack'
              ? 'Follow Back'
              : 'Follow';

        return (
          <Pressable
            style={({ pressed }) => [
              buttonStyle,
              pressed && Platform.OS !== 'android' && { opacity: 0.8 },
            ]}
            onPress={() => {
              if (isFollowing) {
                handleUnfollow(item.id, item.username);
              } else {
                handleFollow(item.id);
              }
            }}
            android_ripple={{ color: theme.accentSub, borderless: false }}>
            <Text style={textStyle}>{label}</Text>
          </Pressable>
        );
      }

      return (
        <Pressable
          style={({ pressed }) => [
            isFollowing ? styles.followingButton : styles.followButton,
            pressed && Platform.OS !== 'android' && { opacity: 0.8 },
          ]}
          onPress={() => {
            if (isFollowing) {
              handleUnfollow(item.id, item.username);
            } else {
              handleFollow(item.id);
            }
          }}
          android_ripple={{ color: theme.accentSub, borderless: false }}>
          <Text style={isFollowing ? styles.followingButtonText : styles.followButtonText}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      );
    };

    return (
      <TouchableOpacity
        style={[styles.userItem, isYou && styles.userItemYou]}
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
        <View style={styles.nameRow}>
          <Text style={styles.username} numberOfLines={1}>
            {item.username}
          </Text>
          {isYou ? (
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>YOU</Text>
            </View>
          ) : null}
          {isMutual ? (
            <View style={styles.mutualBadge}>
              <Text style={styles.mutualBadgeText}>MUTUAL</Text>
            </View>
          ) : null}
        </View>
        {renderFollowButton()}
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
            onPress={() => handleUnfollowFromOwnList(item.id, item.username)}
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
        <EmptyState
          icon="people-outline"
          title={`No ${title.toLowerCase()} yet`}
          subtitle={
            isFollowers
              ? "When people follow you, they'll show up here"
              : "When you follow people, they'll show up here"
          }
        />
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
    nameRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
    },
    username: {
      flexShrink: 1,
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    mutualBadge: {
      backgroundColor: theme.accentSub,
      borderWidth: 0.5,
      borderColor: theme.accent,
      borderRadius: 5,
      paddingHorizontal: 5,
      paddingVertical: 1,
      flexShrink: 0,
    },
    mutualBadgeText: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 8,
      color: theme.accent,
    },
    youBadge: {
      backgroundColor: theme.accent,
      borderRadius: 5,
      paddingHorizontal: 6,
      paddingVertical: 1,
      flexShrink: 0,
    },
    youBadgeText: {
      fontFamily: 'SpaceMono-Bold',
      fontSize: 8,
      color: theme.accentText,
    },
    userItemYou: {
      backgroundColor: theme.accentSub,
    },
    followBackButton: {
      backgroundColor: theme.accent,
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    followBackButtonText: {
      fontFamily: 'SpaceGrotesk-SemiBold',
      fontSize: 12,
      fontWeight: '600',
      color: theme.accentText,
    },
    followersFollowingButton: {
      backgroundColor: theme.bgTertiary,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    followersFollowingButtonText: {
      fontFamily: 'SpaceGrotesk-SemiBold',
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    followDiscoverButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.accent,
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    followDiscoverButtonText: {
      fontFamily: 'SpaceGrotesk-SemiBold',
      fontSize: 12,
      fontWeight: '600',
      color: theme.accent,
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
