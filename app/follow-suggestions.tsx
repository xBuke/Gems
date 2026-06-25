import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { hapticLight } from '@/lib/haptics';
import { sendPushNotification } from '@/lib/sendPushNotification';
import { supabase } from '@/lib/supabase';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FollowSuggestion = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  gem_count: number;
  is_private?: boolean;
};

type FollowState = 'none' | 'following' | 'requested';

export default function FollowSuggestionsScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<FollowSuggestion[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followStates, setFollowStates] = useState<Record<string, FollowState>>({});
  const skippedRef = useRef(false);

  const enterApp = useCallback(() => {
    router.replace('/');
  }, [router]);

  const skipIfEmpty = useCallback(
    (items: FollowSuggestion[]) => {
      if (items.length === 0 && !skippedRef.current) {
        skippedRef.current = true;
        enterApp();
      }
    },
    [enterApp],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) enterApp();
        return;
      }

      setCurrentUserId(user.id);

      const { data, error } = await supabase.rpc('get_follow_suggestions', {
        p_user_id: user.id,
        p_limit: 10,
      });

      if (cancelled) return;

      if (error) {
        console.warn('[follow-suggestions] RPC failed:', error.message);
        skipIfEmpty([]);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as FollowSuggestion[];

      if (rows.length === 0) {
        skipIfEmpty([]);
        setLoading(false);
        return;
      }

      const missingPrivacy = rows.some((row) => row.is_private === undefined);
      if (missingPrivacy) {
        const ids = rows.map((row) => row.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, is_private')
          .in('id', ids);

        if (cancelled) return;

        const privacyById = new Map(
          (profiles ?? []).map((p: { id: string; is_private?: boolean }) => [p.id, p.is_private === true]),
        );

        const enriched = rows.map((row) => ({
          ...row,
          is_private: row.is_private ?? privacyById.get(row.user_id) ?? false,
        }));
        setSuggestions(enriched);
        skipIfEmpty(enriched);
      } else {
        setSuggestions(rows);
        skipIfEmpty(rows);
      }

      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [enterApp, skipIfEmpty]);

  const setFollowState = (targetId: string, state: FollowState) => {
    setFollowStates((prev) => ({ ...prev, [targetId]: state }));
  };

  const handleFollowToggle = async (suggestion: FollowSuggestion) => {
    if (!currentUserId) return;

    const currentState = followStates[suggestion.user_id] ?? 'none';
    hapticLight();

    if (currentState === 'following' || currentState === 'requested') {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', suggestion.user_id);
      setFollowState(suggestion.user_id, 'none');
      return;
    }

    const isPrivate = suggestion.is_private === true;

    await supabase.from('follows').insert({
      follower_id: currentUserId,
      following_id: suggestion.user_id,
      status: isPrivate ? 'pending' : 'accepted',
    });

    await supabase.from('notifications').insert({
      user_id: suggestion.user_id,
      sender_id: currentUserId,
      type: isPrivate ? 'follow_request' : 'follow',
      gem_id: null,
      read: false,
    });

    void (async () => {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', currentUserId)
        .single();
      const followerUsername = myProfile?.username ?? 'Someone';

      if (isPrivate) {
        sendPushNotification({
          user_id: suggestion.user_id,
          category: 'social',
          title: 'Follow request',
          body: `@${followerUsername} wants to follow you`,
          data: { type: 'follow_request', user_id: currentUserId },
        });
      } else {
        sendPushNotification({
          user_id: suggestion.user_id,
          category: 'social',
          title: 'New follower',
          body: `@${followerUsername} started following you`,
          data: { type: 'follow', user_id: currentUserId },
        });
      }
    })();

    setFollowState(suggestion.user_id, isPrivate ? 'requested' : 'following');
  };

  const renderSuggestion = (suggestion: FollowSuggestion) => {
    const initial = (suggestion.username ?? 'U').charAt(0).toUpperCase();
    const followState = followStates[suggestion.user_id] ?? 'none';
    const isFollowing = followState === 'following';
    const isRequested = followState === 'requested';

    return (
      <View key={suggestion.user_id} style={styles.row}>
        <View style={styles.avatar}>
          {suggestion.avatar_url ? (
            <Image
              source={{ uri: suggestion.avatar_url }}
              style={styles.avatarImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient
              colors={[theme.accent, theme.coral]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarImage}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </LinearGradient>
          )}
        </View>

        <View style={styles.rowText}>
          <Text style={styles.rowUsername} numberOfLines={1}>
            {suggestion.username}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            @{suggestion.username} · {suggestion.gem_count} gems
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            isFollowing || isRequested ? styles.followingButton : styles.followButton,
            pressed && Platform.OS !== 'android' && { opacity: 0.8 },
            isRequested && styles.requestedButton,
          ]}
          onPress={() => handleFollowToggle(suggestion)}
          disabled={isRequested}
          android_ripple={{ color: theme.accentSub, borderless: false }}>
          <Text
            style={
              isFollowing
                ? styles.followingButtonText
                : isRequested
                  ? styles.requestedButtonText
                  : styles.followButtonText
            }>
            {isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow'}
          </Text>
        </Pressable>
      </View>
    );
  };

  if (loading || suggestions.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.overline}>WELCOME TO HIDDEN GEMS</Text>
        <Text style={styles.title}>Follow some explorers</Text>
        <Text style={styles.subtitle}>Your Discover feed gets better as you follow more people</Text>

        <View style={styles.list}>{suggestions.map(renderSuggestion)}</View>

        <TouchableOpacity style={styles.primaryCta} onPress={enterApp} activeOpacity={0.8}>
          <Text style={styles.primaryCtaText}>Start exploring →</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={enterApp} activeOpacity={0.7} style={styles.skipLink}>
          <Text style={styles.skipLinkText}>Skip for now</Text>
        </TouchableOpacity>
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
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 32,
      paddingBottom: 28,
    },
    overline: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 9,
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: theme.accent,
      marginBottom: 10,
    },
    title: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 22,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: 'SpaceGrotesk-Regular',
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 19,
      marginBottom: 24,
    },
    list: {
      gap: 4,
      marginBottom: 28,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      overflow: 'hidden',
    },
    avatarImage: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontFamily: 'SpaceGrotesk-Bold',
      fontSize: 18,
      color: theme.accentText,
    },
    rowText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    rowUsername: {
      fontFamily: 'SpaceGrotesk-SemiBold',
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    rowMeta: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: theme.textSecondary,
    },
    followButton: {
      backgroundColor: theme.accent,
      borderRadius: 20,
      paddingVertical: 7,
      paddingHorizontal: 16,
    },
    followButtonText: {
      fontFamily: 'SpaceGrotesk-SemiBold',
      fontSize: 12,
      fontWeight: '600',
      color: theme.accentText,
    },
    followingButton: {
      backgroundColor: theme.bgTertiary,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 20,
      paddingVertical: 7,
      paddingHorizontal: 16,
    },
    followingButtonText: {
      fontFamily: 'SpaceGrotesk-SemiBold',
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    requestedButton: {
      opacity: 0.7,
    },
    requestedButtonText: {
      fontFamily: 'SpaceGrotesk-SemiBold',
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    primaryCta: {
      backgroundColor: theme.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 14,
    },
    primaryCtaText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.accentText,
    },
    skipLink: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    skipLinkText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
  });
