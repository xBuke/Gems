import { requireAuth } from '@/lib/authGuard';
import { checkAndUnlockAchievements } from '@/lib/gamification';
import {
  type CommunityGemInfo,
} from '@/lib/gemVisibility';
import { blockUser, getMyBlockedUsers } from '@/lib/safety';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { formatCoordinates } from '@/lib/coordinates';
import { getDistance } from '@/lib/distance';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { addStreakBonus } from '@/lib/streak';
import { supabase } from '@/lib/supabase';
import { AchievementUnlockModal } from '@/components/AchievementUnlockModal';
import CheckInConfirmationSheet from '@/components/CheckInConfirmationSheet';
import ReportSheet from '@/components/ReportSheet';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const LOCAL_PICK_COLOR = '#7F77DD';
const PIONEER_COLOR = '#FFD700';

const GEM_DETAIL_SELECT =
  '*, profiles!gems_user_id_fkey(username, avatar_url), communities(name, icon, color)';

type Gem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  verified: boolean;
  is_local_pick?: boolean;
  is_first_in_area?: boolean;
  best_time?: string | null;
  user_id: string;
  community_id?: string | null;
  communities?: CommunityGemInfo | null;
  profiles: { username: string; avatar_url?: string | null } | null;
};

type Comment = {
  id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  profiles: { username: string } | null;
};

type CommentLikeState = {
  count: number;
  likedByMe: boolean;
};

const formatTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const COMPOSER_BAR_HEIGHT = 54;
const REPLY_BANNER_HEIGHT = 52;

const truncatePreview = (text: string, maxLen = 40) =>
  text.length <= maxLen ? text : `${text.slice(0, maxLen).trimEnd()}…`;

export default function GemDetailScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [gem, setGem] = useState<Gem | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [commentInputFocused, setCommentInputFocused] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const commentInputRef = useRef<TextInput>(null);
  const [loading, setLoading] = useState(true);
  const [visitVerified, setVisitVerified] = useState(false);
  const [visitCount, setVisitCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentLikes, setCommentLikes] = useState<Record<string, CommentLikeState>>({});
  const [isOwner, setIsOwner] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    username: string;
    avatar_url: string | null;
  } | null>(null);
  const [checkInSheetVisible, setCheckInSheetVisible] = useState(false);
  const [checkedInAt, setCheckedInAt] = useState<Date | null>(null);
  const [checkInDisplayCount, setCheckInDisplayCount] = useState(0);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    type: 'gem' | 'comment';
    id: string;
  } | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [unlockedBadge, setUnlockedBadge] = useState<string | null>(null);
  const [unlockCoords, setUnlockCoords] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );

  const heartScale = useSharedValue(1);
  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const gemId = Array.isArray(id) ? id[0] : id;

  const fetchVisitCount = async () => {
    if (!gemId) return;

    const { count } = await supabase
      .from('gem_visits')
      .select('*', { count: 'exact', head: true })
      .eq('gem_id', gemId);

    setVisitCount(count ?? 0);
  };

  const fetchCommentLikes = async (commentIds: string[]) => {
    if (commentIds.length === 0) {
      setCommentLikes({});
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: likesData } = await supabase
      .from('comment_likes')
      .select('*')
      .in('comment_id', commentIds);

    const likesMap: Record<string, CommentLikeState> = {};
    for (const commentId of commentIds) {
      const commentLikesList = (likesData ?? []).filter((like) => like.comment_id === commentId);
      likesMap[commentId] = {
        count: commentLikesList.length,
        likedByMe: user ? commentLikesList.some((like) => like.user_id === user.id) : false,
      };
    }
    setCommentLikes(likesMap);
  };

  const fetchBlockedUsers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCurrentUserId(null);
      setCurrentUserProfile(null);
      setBlockedUserIds([]);
      return;
    }
    setCurrentUserId(user.id);
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    setCurrentUserProfile(profile ?? null);
    const blocked = await getMyBlockedUsers(user.id);
    setBlockedUserIds(blocked.map((b: { blocked_id: string }) => b.blocked_id));
  }, []);

  const fetchComments = useCallback(async () => {
    if (!gemId) return;

    const { data: commentsData } = await supabase
      .from('comments')
      .select('*, profiles(username)')
      .eq('gem_id', gemId)
      .order('created_at', { ascending: true });

    if (commentsData) {
      const filtered = commentsData.filter(
        (comment: Comment) => !blockedUserIds.includes(comment.user_id),
      );
      setComments(filtered);
      await fetchCommentLikes(filtered.map((comment: Comment) => comment.id));
    }
  }, [gemId, blockedUserIds]);

  const fetchGem = useCallback(async () => {
    if (!id) return;

    const resolvedGemId = Array.isArray(id) ? id[0] : id;

    const { data, error } = await supabase
      .from('gems')
      .select(GEM_DETAIL_SELECT)
      .eq('id', resolvedGemId)
      .single();

    if (data) {
      setGem(data);
      const { data: { user } } = await supabase.auth.getUser();
      setIsOwner(user?.id === data.user_id);
    }
    setLoading(false);
  }, [id]);

  const fetchLikes = useCallback(async () => {
    if (!gemId) return;

    const { data: { user } } = await supabase.auth.getUser();

    const { count } = await supabase
      .from('gem_likes')
      .select('*', { count: 'exact', head: true })
      .eq('gem_id', gemId);

    setLikeCount(count || 0);

    if (user) {
      const { data: existingLike } = await supabase
        .from('gem_likes')
        .select('id')
        .eq('gem_id', gemId)
        .eq('user_id', user.id)
        .maybeSingle();

      setIsLiked(!!existingLike);
    }
  }, [gemId]);

  useEffect(() => {
    setDescriptionExpanded(false);
  }, [gemId]);

  useEffect(() => {
    fetchGem();
  }, [fetchGem]);

  useFocusEffect(
    useCallback(() => {
      fetchBlockedUsers();
      fetchGem();
      fetchVisitCount();
      fetchLikes();
    }, [fetchBlockedUsers, fetchGem, fetchLikes]),
  );

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useFocusEffect(
    useCallback(() => {
      fetchComments();
    }, [fetchComments]),
  );

  useEffect(() => {
    fetchLikes();
  }, [fetchLikes]);

  useEffect(() => {
    if (!gem) return;

    const fetchLocationName = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${gem.latitude}&lon=${gem.longitude}&format=json`,
        );
        const data = await response.json();
        const name =
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          data.address?.county ||
          'Unknown location';
        setLocationName(name);
      } catch {
        setLocationName(`${gem.latitude.toFixed(4)}, ${gem.longitude.toFixed(4)}`);
      }
    };

    fetchLocationName();
  }, [gem]);

  const openMaps = () => {
    if (!gem) return;

    const { latitude, longitude, title } = gem;
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${latitude},${longitude}&q=${encodeURIComponent(title)}`,
      android: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });

    if (url) Linking.openURL(url);
  };

  const handleSendComment = async () => {
    const text = commentText.trim();
    if (!text || !id) return;

    const proceed = await requireAuth();
    if (!proceed) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const resolvedGemId = Array.isArray(id) ? id[0] : id;
    const { error } = await supabase
      .from('comments')
      .insert({
        gem_id: resolvedGemId,
        user_id: user.id,
        content: text,
        parent_comment_id: replyingTo?.id ?? null,
      });

    if (!error) {
      hapticSuccess();
      if (gem && user.id !== gem.user_id) {
        await supabase.from('notifications').insert({
          user_id: gem.user_id,
          sender_id: user.id,
          type: 'comment',
          gem_id: resolvedGemId,
          read: false,
        });
      }
      setCommentText('');
      setReplyingTo(null);
      fetchComments();
      await addStreakBonus(user.id, 3);
    }
  };

  const handleToggleLike = async () => {
    if (!gem || !gemId) return;

    heartScale.value = withSpring(1.3, { damping: 2, stiffness: 300 }, () => {
      heartScale.value = withSpring(1);
    });

    const proceed = await requireAuth();
    if (!proceed) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    hapticLight();

    if (isLiked) {
      await supabase.from('gem_likes').delete().eq('gem_id', gemId).eq('user_id', user.id);
      setIsLiked(false);
      setLikeCount((prev) => prev - 1);
    } else {
      await supabase.from('gem_likes').insert({ gem_id: gemId, user_id: user.id });
      setIsLiked(true);
      setLikeCount((prev) => prev + 1);

      if (user.id !== gem.user_id) {
        await supabase.from('notifications').insert({
          user_id: gem.user_id,
          sender_id: user.id,
          type: 'like',
          gem_id: gemId,
          read: false,
        });
      }

      await addStreakBonus(user.id, 2);
      const newAchievements = await checkAndUnlockAchievements(user.id);
      if (newAchievements.length > 0) {
        setUnlockedBadge(newAchievements[0]);
        setUnlockCoords(null);
      }
      if (user.id !== gem.user_id) {
        checkAndUnlockAchievements(gem.user_id);
      }
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    const proceed = await requireAuth();
    if (!proceed) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const current = commentLikes[commentId];
    if (current?.likedByMe) {
      await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', user.id);
      setCommentLikes((prev) => ({
        ...prev,
        [commentId]: {
          count: Math.max(0, (prev[commentId]?.count ?? 1) - 1),
          likedByMe: false,
        },
      }));
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id });
      setCommentLikes((prev) => ({
        ...prev,
        [commentId]: {
          count: (prev[commentId]?.count ?? 0) + 1,
          likedByMe: true,
        },
      }));
    }
  };

  const handleDelete = async () => {
    if (!gem || !gemId) return;

    hapticMedium();

    try {
      if (gem.image_url) {
        const fileName = gem.image_url.split('/').pop();
        if (fileName) {
          await supabase.storage.from('gem-images').remove([fileName]);
        }
      }

      const { error } = await supabase.from('gems').delete().eq('id', gemId);

      if (error) {
        Alert.alert('Error', 'Could not delete gem');
        return;
      }

      router.replace('/');
    } catch {
      Alert.alert('Error', 'Could not delete gem');
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete Gem', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: handleDelete },
    ]);
  };

  const handleBeenHere = async () => {
    if (!gem) return;

    const proceed = await requireAuth();
    if (!proceed) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const location = await Location.getCurrentPositionAsync({});
    const distance = getDistance(
      location.coords.latitude,
      location.coords.longitude,
      gem.latitude,
      gem.longitude,
    );

    if (distance > 1000) {
      Alert.alert('You need to be within 1km to verify your visit');
      return;
    }

    const resolvedGemId = Array.isArray(id) ? id[0] : id;
    const { error } = await supabase.from('gem_visits').upsert(
      {
        gem_id: resolvedGemId,
        user_id: user.id,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        category: gem.category,
      },
      { onConflict: 'gem_id,user_id' },
    );

    if (!error) {
      hapticSuccess();
      await supabase.from('notifications').insert({
        user_id: gem.user_id,
        sender_id: user.id,
        type: 'visit',
        gem_id: resolvedGemId,
        read: false,
      });
      setVisitVerified(true);

      const { count } = await supabase
        .from('gem_visits')
        .select('*', { count: 'exact', head: true })
        .eq('gem_id', resolvedGemId);
      const updatedCount = count ?? visitCount + 1;
      setVisitCount(updatedCount);
      setCheckInDisplayCount(updatedCount);
      setCheckedInAt(new Date());
      setCheckInSheetVisible(true);

      await addStreakBonus(user.id, 5);
      const newAchievements = await checkAndUnlockAchievements(user.id);
      if (newAchievements.length > 0) {
        setUnlockedBadge(newAchievements[0]);
        setUnlockCoords({ latitude: gem.latitude, longitude: gem.longitude });
      }
    }
  };

  const openReportSheet = (type: 'gem' | 'comment', targetId: string) => {
    setReportTarget({ type, id: targetId });
    setReportVisible(true);
  };

  const confirmBlockUser = (blockedId: string, blockedUsername: string) => {
    if (!currentUserId) return;

    Alert.alert(
      `Block @${blockedUsername}?`,
      'They won\'t be able to see your content and you won\'t see theirs.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            await blockUser(currentUserId, blockedId);
            router.back();
          },
        },
      ],
    );
  };

  const showGemMenu = () => {
    if (!gem || isOwner) return;

    const gemUsername = gem.profiles?.username ?? 'unknown';
    const options = [`Report Gem`, `Block @${gemUsername}`, 'Cancel'];
    const cancelIndex = 2;

    const handleSelection = (index: number) => {
      if (index === 0) openReportSheet('gem', gem.id);
      if (index === 1) confirmBlockUser(gem.user_id, gemUsername);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: 1 },
        handleSelection,
      );
    } else {
      Alert.alert('Options', undefined, [
        { text: 'Report Gem', onPress: () => openReportSheet('gem', gem.id) },
        {
          text: `Block @${gemUsername}`,
          style: 'destructive',
          onPress: () => confirmBlockUser(gem.user_id, gemUsername),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const showCommentMenu = (comment: Comment) => {
    const commentUsername = comment.profiles?.username ?? 'user';

    const options = ['Report Comment', `Block @${commentUsername}`, 'Cancel'];
    const cancelIndex = 2;

    const handleSelection = (index: number) => {
      if (index === 0) openReportSheet('comment', comment.id);
      if (index === 1) confirmBlockUser(comment.user_id, commentUsername);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: 1 },
        handleSelection,
      );
    } else {
      Alert.alert('Options', undefined, [
        { text: 'Report Comment', onPress: () => openReportSheet('comment', comment.id) },
        {
          text: `Block @${commentUsername}`,
          style: 'destructive',
          onPress: () => confirmBlockUser(comment.user_id, commentUsername),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  if (!gem) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Gem not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const username = gem.profiles?.username ?? 'unknown';
  const composerBottomPadding = Math.max(insets.bottom, 10);
  const replyBannerInset = replyingTo ? REPLY_BANNER_HEIGHT : 0;
  const scrollBottomInset = COMPOSER_BAR_HEIGHT + composerBottomPadding + replyBannerInset;

  const topLevelComments = comments.filter((comment) => comment.parent_comment_id == null);
  const repliesByParent = comments.reduce<Record<string, Comment[]>>((acc, comment) => {
    if (!comment.parent_comment_id) return acc;
    if (!acc[comment.parent_comment_id]) acc[comment.parent_comment_id] = [];
    acc[comment.parent_comment_id].push(comment);
    return acc;
  }, {});

  const handleReplyPress = (comment: Comment) => {
    setReplyingTo(comment);
    commentInputRef.current?.focus();
  };

  const handleCommentInputFocus = () => {
    setCommentInputFocused(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const renderCommentCard = (comment: Comment, isReply: boolean) => {
    const commentUsername = comment.profiles?.username ?? 'Anonymous';
    const likeState = commentLikes[comment.id] ?? { count: 0, likedByMe: false };
    const avatarSize = isReply ? 28 : 36;

    return (
      <View style={[styles.commentCard, isReply && styles.commentCardReply]}>
        <View style={[styles.commentAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
          <Text style={[styles.commentAvatarText, isReply && styles.commentAvatarTextSmall]}>
            {commentUsername.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.commentBody}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentUsername} numberOfLines={1} ellipsizeMode="tail">
              {commentUsername}
            </Text>
            <View style={styles.commentHeaderRight}>
              <Text style={styles.commentTime}>{formatTimeAgo(comment.created_at)}</Text>
              {currentUserId && comment.user_id !== currentUserId && (
                <TouchableOpacity
                  onPress={() => showCommentMenu(comment)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}>
                  <Ionicons name="ellipsis-horizontal" size={14} color={theme.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <Text style={styles.commentContent} numberOfLines={5} ellipsizeMode="tail">
            {comment.content}
          </Text>
          <View style={styles.commentLikeWrap}>
            <TouchableOpacity
              style={styles.commentLikeRow}
              onPress={() => handleToggleCommentLike(comment.id)}
              activeOpacity={0.7}>
              <Ionicons
                name={likeState.likedByMe ? 'heart' : 'heart-outline'}
                size={14}
                color={theme.textTertiary}
              />
              <Text style={styles.commentLikeCount}>{likeState.count}</Text>
            </TouchableOpacity>
            {!isReply ? (
              <TouchableOpacity
                onPress={() => handleReplyPress(comment)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={styles.commentReplyLink}>Reply</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: scrollBottomInset }}>
        <View style={styles.hero}>
          {gem.image_url ? (
            <Image
              source={{ uri: gem.image_url }}
              style={styles.heroImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="location-outline" size={64} color={theme.accent} />
            </View>
          )}

          <View style={styles.heroOverlay}>
            <View style={styles.badgeRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{gem.category}</Text>
              </View>
              {gem.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={12} color={theme.coral} />
                  <Text style={styles.verifiedBadgeText}>Verified</Text>
                </View>
              )}
              {gem.is_local_pick && (
                <View style={styles.localPickBadge}>
                  <Ionicons name="home" size={11} color={LOCAL_PICK_COLOR} />
                  <Text style={styles.localPickBadgeText}>Local&apos;s Pick</Text>
                </View>
              )}
              {gem.is_first_in_area && (
                <View style={styles.pioneerBadge}>
                  <Ionicons name="star" size={11} color={PIONEER_COLOR} />
                  <Text style={styles.pioneerBadgeText}>Pioneer</Text>
                </View>
              )}
              {gem.community_id && gem.communities && (
                <TouchableOpacity
                  style={[
                    styles.communityBadge,
                    {
                      backgroundColor: gem.communities.color + '20',
                      borderColor: gem.communities.color,
                    },
                  ]}
                  onPress={() => router.push('/community/' + gem.community_id)}
                  activeOpacity={0.7}>
                  <Ionicons
                    name={gem.communities.icon as keyof typeof Ionicons.glyphMap}
                    size={10}
                    color={gem.communities.color}
                  />
                  <Text style={[styles.communityBadgeText, { color: gem.communities.color }]}>
                    {gem.communities.name}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.heroTitle} numberOfLines={2} ellipsizeMode="tail">
              {gem.title}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.authorRow}>
            <TouchableOpacity
              style={styles.authorLeft}
              onPress={() => router.push('/profile?userId=' + gem.user_id)}
              activeOpacity={0.7}>
              <View style={styles.authorAvatar}>
                {gem.profiles?.avatar_url ? (
                  <Image
                    source={{ uri: gem.profiles.avatar_url }}
                    style={styles.authorAvatarImage}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Text style={styles.authorAvatarText}>{username.charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <Text style={styles.authorName} numberOfLines={1} ellipsizeMode="tail">
                @{username}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.likeButton} onPress={handleToggleLike} activeOpacity={0.7}>
              <Animated.View style={heartAnimatedStyle}>
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={22}
                  color={isLiked ? theme.danger : theme.textSecondary}
                />
              </Animated.View>
              <Text style={[styles.likeCountText, isLiked && styles.likeCountTextActive]}>
                {likeCount}
              </Text>
            </TouchableOpacity>
          </View>

          {gem.best_time ? (
            <View style={styles.bestTimeRow}>
              <Ionicons name="time-outline" size={14} color={theme.coral} />
              <Text style={styles.bestTimeLabel}>Best time: </Text>
              <Text style={styles.bestTimeValue}>{gem.best_time}</Text>
            </View>
          ) : null}

          <Text style={styles.primaryLocationLabel}>
            {formatCoordinates(gem.latitude, gem.longitude)}
            {locationName ? ` · ${locationName}` : ''}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statCount}>{visitCount}</Text>
              <Text style={styles.statLabel}>Visits</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statCount}>{likeCount}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statCount}>{comments.length}</Text>
              <Text style={styles.statLabel}>Comments</Text>
            </View>
          </View>

          {gem.description ? (
            <View style={styles.descriptionWrap}>
              <Text
                style={styles.description}
                numberOfLines={descriptionExpanded ? undefined : 6}
                ellipsizeMode="tail">
                {gem.description}
              </Text>
              {gem.description.length > 180 ? (
                <TouchableOpacity
                  onPress={() => setDescriptionExpanded((prev) => !prev)}
                  activeOpacity={0.7}>
                  <Text style={styles.readMoreText}>
                    {descriptionExpanded ? 'Show less' : 'Read more'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.navigateButton} onPress={openMaps} activeOpacity={0.8}>
              <Ionicons name="navigate" size={18} color={theme.accent} />
              <Text style={styles.navigateButtonText}>Navigate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.beenHereButton, visitVerified && styles.beenHereButtonVerified]}
              onPress={handleBeenHere}
              disabled={visitVerified}
              activeOpacity={0.8}>
              <Ionicons
                name={visitVerified ? 'checkmark-circle' : 'location'}
                size={18}
                color={theme.accentText}
              />
              <Text
                style={[
                  styles.beenHereButtonText,
                  visitVerified && styles.beenHereButtonTextVerified,
                ]}>
                {visitVerified ? 'Check In ✓' : 'Check In'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.commentsTitle}>Comments ({comments.length})</Text>
          {comments.length === 0 ? (
            <Text style={styles.emptyComments}>Be the first to comment!</Text>
          ) : (
            topLevelComments.map((comment) => (
              <View key={comment.id} style={styles.commentBlock}>
                {renderCommentCard(comment, false)}
                {(repliesByParent[comment.id] ?? []).map((reply) => (
                  <View key={reply.id}>{renderCommentCard(reply, true)}</View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <SafeAreaView style={styles.header} edges={['top']} pointerEvents="box-none">
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} activeOpacity={0.8} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          {!isOwner && (
            <TouchableOpacity style={styles.headerButton} onPress={showGemMenu} activeOpacity={0.8} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.text} />
            </TouchableOpacity>
          )}
          {isOwner && (
            <TouchableOpacity style={styles.headerButton} onPress={confirmDelete} activeOpacity={0.8} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="trash-outline" size={18} color={theme.danger} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => console.log('Share gem', gem.id)}
            activeOpacity={0.8}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="share-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View
        style={[
          styles.composerWrapper,
          { paddingBottom: composerBottomPadding },
        ]}>
        {replyingTo ? (
          <View style={styles.replyBanner}>
            <View style={styles.replyBannerContent}>
              <Text style={styles.replyBannerLabel}>
                Replying to @{replyingTo.profiles?.username ?? 'unknown'}
              </Text>
              <Text style={styles.replyBannerPreview} numberOfLines={1}>
                {truncatePreview(replyingTo.content)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setReplyingTo(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}>
              <Text style={styles.replyBannerDismiss}>×</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.commentInputBar}>
          <View style={styles.composerAvatar}>
            {currentUserProfile?.avatar_url ? (
              <Image
                source={{ uri: currentUserProfile.avatar_url }}
                style={styles.composerAvatarImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <Text style={styles.composerAvatarText}>
                {(currentUserProfile?.username ?? '?').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <TextInput
            ref={commentInputRef}
            style={[styles.commentInput, commentInputFocused && styles.commentInputFocused]}
            placeholder="Add a comment…"
            placeholderTextColor={theme.textTertiary}
            value={commentText}
            onChangeText={setCommentText}
            maxLength={500}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSendComment}
            selectionColor={theme.accent}
            onFocus={handleCommentInputFocus}
            onBlur={() => setCommentInputFocused(false)}
          />
        </View>
      </View>

      {currentUserId && reportTarget && (
        <ReportSheet
          visible={reportVisible}
          onClose={() => {
            setReportVisible(false);
            setReportTarget(null);
          }}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          reporterId={currentUserId}
          onReportSuccess={hapticSuccess}
        />
      )}

      <AchievementUnlockModal
        visible={!!unlockedBadge}
        badgeType={unlockedBadge}
        latitude={unlockCoords?.latitude}
        longitude={unlockCoords?.longitude}
        onClose={() => {
          setUnlockedBadge(null);
          setUnlockCoords(null);
        }}
      />

      <CheckInConfirmationSheet
        visible={checkInSheetVisible}
        onClose={() => setCheckInSheetVisible(false)}
        gemTitle={gem.title}
        latitude={gem.latitude}
        longitude={gem.longitude}
        checkedInAt={checkedInAt}
        checkInCount={checkInDisplayCount}
      />
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: theme.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  backLink: {
    color: theme.accent,
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    height: 320,
    backgroundColor: theme.bgTertiary,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bgTertiary,
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: theme.accentSub,
    borderWidth: 0.5,
    borderColor: theme.accent,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.coralSubtle,
    borderWidth: 0.5,
    borderColor: theme.coral,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.coral,
  },
  localPickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LOCAL_PICK_COLOR + '20',
    borderWidth: 0.5,
    borderColor: LOCAL_PICK_COLOR,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  localPickBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: LOCAL_PICK_COLOR,
  },
  pioneerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PIONEER_COLOR + '20',
    borderWidth: 0.5,
    borderColor: PIONEER_COLOR,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  pioneerBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: PIONEER_COLOR,
  },
  communityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  communityBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  heroTitle: {
    color: theme.text,
    fontSize: 22,
    fontFamily: 'SpaceGrotesk-Bold',
  },
  primaryLocationLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: theme.accent,
    marginBottom: 12,
  },
  content: {
    padding: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  authorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  authorAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  authorAvatarText: {
    color: theme.background,
    fontSize: 14,
    fontWeight: '700',
  },
  authorName: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '500',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeCountText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  likeCountTextActive: {
    color: theme.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  locationText: {
    color: theme.textSecondary,
    fontSize: 10,
    fontFamily: 'SpaceMono-Regular',
  },
  bestTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  bestTimeLabel: {
    color: theme.textSecondary,
    fontSize: 13,
  },
  bestTimeValue: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    padding: 11,
    alignItems: 'center',
  },
  statDivider: {
    width: 0.5,
    backgroundColor: theme.border,
    marginVertical: 10,
  },
  statCount: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    lineHeight: 18,
  },
  statLabel: {
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
  },
  descriptionWrap: {
    marginBottom: 16,
  },
  description: {
    color: theme.text,
    fontSize: 14,
    lineHeight: 22,
  },
  readMoreText: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  navigateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: 12,
    paddingVertical: 14,
  },
  navigateButtonText: {
    color: theme.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  beenHereButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingVertical: 14,
  },
  beenHereButtonVerified: {
    opacity: 0.85,
  },
  beenHereButtonText: {
    color: theme.accentText,
    fontSize: 14,
    fontWeight: '700',
  },
  beenHereButtonTextVerified: {
    color: theme.accentText,
  },
  commentsTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyComments: {
    color: theme.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  commentCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  commentCardReply: {
    marginLeft: 28,
    marginBottom: 6,
  },
  commentBlock: {
    marginBottom: 0,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    color: theme.background,
    fontSize: 14,
    fontWeight: '600',
  },
  commentAvatarTextSmall: {
    fontSize: 12,
  },
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  commentHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentUsername: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  commentTime: {
    color: theme.textTertiary,
    fontSize: 11,
    fontFamily: 'SpaceMono-Regular',
  },
  commentContent: {
    color: theme.textSecondary,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  commentLikeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  commentLikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentLikeCount: {
    color: theme.textTertiary,
    fontSize: 11,
  },
  commentReplyLink: {
    color: theme.textTertiary,
    fontSize: 11,
    fontFamily: 'SpaceGrotesk-Regular',
  },
  composerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.background,
    borderTopWidth: 0.5,
    borderTopColor: theme.border,
    zIndex: 5,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accentSub,
    borderLeftWidth: 3,
    borderLeftColor: theme.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  replyBannerContent: {
    flex: 1,
    gap: 2,
  },
  replyBannerLabel: {
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 12,
    color: theme.text,
  },
  replyBannerPreview: {
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 11,
    color: theme.textSecondary,
  },
  replyBannerDismiss: {
    fontSize: 18,
    color: theme.textTertiary,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 14,
    gap: 10,
  },
  composerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  composerAvatarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  composerAvatarText: {
    color: theme.accentText,
    fontSize: 12,
    fontWeight: '700',
  },
  commentInput: {
    flex: 1,
    backgroundColor: theme.bgTertiary,
    borderRadius: 20,
    height: 36,
    paddingHorizontal: 14,
    fontSize: 14,
    color: theme.text,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  commentInputFocused: {
    borderColor: theme.accent,
  },
});
