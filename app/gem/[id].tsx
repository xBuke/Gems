import { requireAuth } from '@/lib/authGuard';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { getDistance } from '@/lib/distance';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { SafeAreaView } from 'react-native-safe-area-context';

const ACCENT_MUTED = '#A8D5BA';
const IMAGE_PLACEHOLDER = '#1A5C3A';
const COMMENT_BLUE = '#185FA5';

type Gem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  verified: boolean;
  user_id: string;
  profiles: { username: string } | null;
};

type Comment = {
  id: string;
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

export default function GemDetailScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [gem, setGem] = useState<Gem | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [visitVerified, setVisitVerified] = useState(false);
  const [visitCount, setVisitCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentLikes, setCommentLikes] = useState<Record<string, CommentLikeState>>({});
  const [isOwner, setIsOwner] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);

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

  const fetchComments = async () => {
    if (!gemId) return;

    const { data: commentsData } = await supabase
      .from('comments')
      .select('*, profiles(username)')
      .eq('gem_id', gemId)
      .order('created_at', { ascending: true });

    if (commentsData) {
      setComments(commentsData);
      await fetchCommentLikes(commentsData.map((comment) => comment.id));
    }
  };

  useEffect(() => {
    if (!id) return;

    const fetchGem = async () => {
      const resolvedGemId = Array.isArray(id) ? id[0] : id;

      const { data, error } = await supabase
        .from('gems')
        .select('*, profiles!gems_user_id_fkey(username)')
        .eq('id', resolvedGemId)
        .single();

      if (data) {
        setGem(data);
        const { data: { user } } = await supabase.auth.getUser();
        setIsOwner(user?.id === data.user_id);
      }
      if (error) console.log('Error details:', JSON.stringify(error));
      setLoading(false);
    };

    fetchGem();
  }, [id]);

  useEffect(() => {
    if (gemId) {
      fetchComments();
      fetchVisitCount();
    }
  }, [gemId]);

  useEffect(() => {
    if (!gemId) return;

    const fetchLikes = async () => {
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
    };

    fetchLikes();
  }, [gemId]);

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
      .insert({ gem_id: resolvedGemId, user_id: user.id, content: text });

    if (!error) {
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
      fetchComments();
    }
  };

  const handleToggleLike = async () => {
    if (!gem || !gemId) return;

    const proceed = await requireAuth();
    if (!proceed) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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
      },
      { onConflict: 'gem_id,user_id' },
    );

    if (!error) {
      await supabase.from('notifications').insert({
        user_id: gem.user_id,
        sender_id: user.id,
        type: 'visit',
        gem_id: resolvedGemId,
        read: false,
      });
      setVisitVerified(true);
      fetchVisitCount();
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {gem.image_url ? (
            <Image source={{ uri: gem.image_url }} style={styles.heroImage} resizeMode="cover" />
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
            </View>
            <Text style={styles.heroTitle}>{gem.title}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.authorRow}>
            <TouchableOpacity
              style={styles.authorLeft}
              onPress={() => router.push('/profile?userId=' + gem.user_id)}
              activeOpacity={0.7}>
              <View style={styles.authorAvatar}>
                <Text style={styles.authorAvatarText}>{username.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.authorName}>@{username}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.likeButton} onPress={handleToggleLike} activeOpacity={0.7}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={22}
                color={isLiked ? theme.danger : theme.textSecondary}
              />
              <Text style={[styles.likeCountText, isLiked && styles.likeCountTextActive]}>
                {likeCount}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={theme.accent} />
            <Text style={styles.locationText}>
              {locationName ?? `${gem.latitude.toFixed(4)}, ${gem.longitude.toFixed(4)}`}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="heart" size={16} color={theme.danger} />
              <Text style={styles.statCount}>{likeCount}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="location" size={16} color={theme.accent} />
              <Text style={styles.statCount}>{visitCount}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="chatbubble-outline" size={16} color={COMMENT_BLUE} />
              <Text style={styles.statCount}>{comments.length}</Text>
            </View>
          </View>

          {gem.description ? (
            <Text style={styles.description}>{gem.description}</Text>
          ) : null}

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.navigateButton} onPress={openMaps} activeOpacity={0.8}>
              <Ionicons name="navigate" size={18} color={theme.background} />
              <Text style={styles.navigateButtonText}>Navigate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.beenHereButton, visitVerified && styles.beenHereButtonVerified]}
              onPress={handleBeenHere}
              disabled={visitVerified}
              activeOpacity={0.8}>
              <Text
                style={[
                  styles.beenHereButtonText,
                  visitVerified && styles.beenHereButtonTextVerified,
                ]}>
                {visitVerified ? 'Visit verified! ✓' : "I've been here"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.commentsTitle}>Comments ({comments.length})</Text>
          {comments.length === 0 ? (
            <Text style={styles.emptyComments}>Be the first to comment!</Text>
          ) : (
            comments.map((comment) => {
              const commentUsername = comment.profiles?.username ?? 'Anonymous';
              const likeState = commentLikes[comment.id] ?? { count: 0, likedByMe: false };
              return (
                <View key={comment.id} style={styles.commentCard}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>
                      {commentUsername.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentUsername}>{commentUsername}</Text>
                      <Text style={styles.commentTime}>{formatTimeAgo(comment.created_at)}</Text>
                    </View>
                    <Text style={styles.commentContent}>{comment.content}</Text>
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
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <SafeAreaView style={styles.header} edges={['top']} pointerEvents="box-none">
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          {isOwner && (
            <TouchableOpacity style={styles.headerButton} onPress={confirmDelete} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={18} color={theme.danger} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => console.log('Share gem', gem.id)}
            activeOpacity={0.8}>
            <Ionicons name="share-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.commentInputBar} edges={['bottom']}>
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          placeholderTextColor={theme.textSecondary}
          value={commentText}
          onChangeText={setCommentText}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSendComment} activeOpacity={0.8}>
          <Ionicons name="send" size={18} color={theme.background} />
        </TouchableOpacity>
      </SafeAreaView>
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
    backgroundColor: IMAGE_PLACEHOLDER,
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
    backgroundColor: IMAGE_PLACEHOLDER,
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
    backgroundColor: theme.accentSubtle,
    borderWidth: 0.5,
    borderColor: theme.accent,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.accent,
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
    borderRadius: 20,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.coral,
  },
  heroTitle: {
    color: theme.text,
    fontSize: 22,
    fontFamily: 'SpaceGrotesk-Bold',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
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
    fontSize: 13,
    fontFamily: 'SpaceMono-Regular',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    marginVertical: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statCount: {
    color: theme.text,
    fontSize: 14,
    fontFamily: 'SpaceMono-Regular',
    fontWeight: '600',
  },
  description: {
    color: theme.text,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
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
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 14,
  },
  navigateButtonText: {
    color: theme.background,
    fontSize: 14,
    fontWeight: '600',
  },
  beenHereButton: {
    flex: 1,
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beenHereButtonVerified: {
    opacity: 0.7,
  },
  beenHereButtonText: {
    color: theme.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  beenHereButtonTextVerified: {
    color: theme.accent,
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
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
    color: ACCENT_MUTED,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  commentLikeWrap: {
    alignItems: 'flex-end',
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
  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.background,
    borderTopWidth: 0.5,
    borderTopColor: theme.border,
    gap: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
