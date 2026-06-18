import { requireAuth } from '@/lib/authGuard';
import { getDistance } from '@/lib/distance';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Beach: 'sunny-outline',
  Graffiti: 'color-palette-outline',
  Viewpoint: 'eye-outline',
  Food: 'restaurant-outline',
  Skate: 'bicycle-outline',
  Nature: 'leaf-outline',
};

export default function GemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [gem, setGem] = useState<Gem | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [visitVerified, setVisitVerified] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentLikes, setCommentLikes] = useState<Record<string, CommentLikeState>>({});
  const [isOwner, setIsOwner] = useState(false);

  const gemId = Array.isArray(id) ? id[0] : id;

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
      const gemId = Array.isArray(id) ? id[0] : id;
      console.log('Fetching gem with id:', gemId);

      const { data, error } = await supabase
        .from('gems')
        .select('*, profiles!gems_user_id_fkey(username)')
        .eq('id', gemId)
        .single();

      console.log('Gem data:', data);
      console.log('Gem error:', error);

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
    if (gemId) fetchComments();
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

    const gemId = Array.isArray(id) ? id[0] : id;
    const { error } = await supabase
      .from('comments')
      .insert({ gem_id: gemId, user_id: user.id, content: text });

    if (!error) {
      if (gem && user.id !== gem.user_id) {
        await supabase.from('notifications').insert({
          user_id: gem.user_id,
          sender_id: user.id,
          type: 'comment',
          gem_id: gemId,
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
      await supabase
        .from('gem_likes')
        .delete()
        .eq('gem_id', gemId)
        .eq('user_id', user.id);
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
      gem.longitude
    );

    if (distance > 1000) {
      Alert.alert('You need to be within 1km to verify your visit');
      return;
    }

    const gemId = Array.isArray(id) ? id[0] : id;
    const { error } = await supabase.from('gem_visits').upsert(
      {
        gem_id: gemId,
        user_id: user.id,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
      { onConflict: 'gem_id,user_id' }
    );

    if (!error) {
      await supabase.from('notifications').insert({
        user_id: gem.user_id,
        sender_id: user.id,
        type: 'visit',
        gem_id: gemId,
        read: false,
      });
      setVisitVerified(true);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0D0D0D', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#1D9E75" size="large" />
      </View>
    );
  }

  if (!gem) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0D0D0D', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#F5F5F5' }}>Gem not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#1D9E75', marginTop: 12 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const categoryIcon = CATEGORY_ICONS[gem.category] ?? 'location-outline';

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
              <Ionicons name={categoryIcon} size={64} color="#1D9E75" />
            </View>
          )}

          <View style={styles.badgeRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{gem.category}</Text>
            </View>
            {gem.verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>✓ Verified</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleToggleLike} activeOpacity={0.8}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={24}
              color={isLiked ? '#FF4444' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{gem.title}</Text>

          {gem.profiles?.username && (
            <TouchableOpacity
              style={styles.authorRow}
              onPress={() => router.push('/profile?userId=' + gem.user_id)}
              activeOpacity={0.7}>
              <View style={styles.authorAvatar}>
                <Text style={styles.authorAvatarText}>
                  {gem.profiles.username.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.authorName}>{gem.profiles.username}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#888888" />
            <Text style={styles.locationText}>
              {gem.latitude}, {gem.longitude}
            </Text>
          </View>

          <TouchableOpacity style={styles.likeRow} onPress={handleToggleLike} activeOpacity={0.7}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={24}
              color={isLiked ? '#FF4444' : '#888888'}
            />
            <Text style={[styles.likeCountText, isLiked && styles.likeCountTextActive]}>
              {likeCount}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.description}>{gem.description || 'No description provided.'}</Text>

          <TouchableOpacity style={styles.navigateButton} onPress={openMaps} activeOpacity={0.8}>
            <Ionicons name="navigate" size={20} color="#0D0D0D" />
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

          <Text style={styles.commentsTitle}>Comments</Text>
          {comments.length === 0 ? (
            <Text style={styles.emptyComments}>Be the first to comment!</Text>
          ) : (
            comments.map((comment) => {
              const username = comment.profiles?.username ?? 'Anonymous';
              const likeState = commentLikes[comment.id] ?? { count: 0, likedByMe: false };
              return (
                <View key={comment.id} style={styles.commentItem}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>
                      {username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.commentBubble}>
                    <Text style={styles.commentUsername}>{username}</Text>
                    <Text style={styles.commentContent}>{comment.content}</Text>
                    <View style={styles.commentFooter}>
                      <Text style={styles.commentTime}>
                        {new Date(comment.created_at).toLocaleDateString()}
                      </Text>
                      <TouchableOpacity
                        style={styles.commentLikeRow}
                        onPress={() => handleToggleCommentLike(comment.id)}
                        activeOpacity={0.7}>
                        <Ionicons
                          name={likeState.likedByMe ? 'heart' : 'heart-outline'}
                          size={14}
                          color={likeState.likedByMe ? '#FF4444' : '#555555'}
                        />
                        {likeState.count > 0 && (
                          <Text style={styles.commentLikeCount}>{likeState.count}</Text>
                        )}
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
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          {isOwner && (
            <TouchableOpacity style={styles.headerButton} onPress={confirmDelete} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={22} color="#FF4444" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => console.log('Share gem', gem.id)}
            activeOpacity={0.8}>
            <Ionicons name="share-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.commentInputBar} edges={['bottom']}>
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          placeholderTextColor="#888888"
          value={commentText}
          onChangeText={setCommentText}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSendComment} activeOpacity={0.8}>
          <Ionicons name="send" size={18} color="#0D0D0D" />
        </TouchableOpacity>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#F5F5F5',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  notFoundBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#141414',
    borderWidth: 0.5,
    borderColor: '#222222',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  notFoundBackText: {
    color: '#F5F5F5',
    fontSize: 14,
    fontWeight: '600',
  },
  backLink: {
    color: '#1D9E75',
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
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderWidth: 0.5,
    borderColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    height: 280,
    backgroundColor: '#1A1A1A',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    backgroundColor: '#0F3D25',
    borderWidth: 0.5,
    borderColor: '#1D9E75',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  badgeRow: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    gap: 8,
  },
  verifiedBadge: {
    backgroundColor: '#0F3D25',
    borderWidth: 0.5,
    borderColor: '#1D9E75',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D9E75',
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D9E75',
  },
  saveButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderWidth: 0.5,
    borderColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  title: {
    color: '#F5F5F5',
    fontSize: 22,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarText: {
    color: '#0D0D0D',
    fontSize: 11,
    fontWeight: '600',
  },
  authorName: {
    color: '#888888',
    fontSize: 13,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  locationText: {
    color: '#888888',
    fontSize: 13,
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  likeCountText: {
    color: '#888888',
    fontSize: 16,
    fontWeight: '600',
  },
  likeCountTextActive: {
    color: '#FFFFFF',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#222222',
    marginBottom: 16,
  },
  description: {
    color: '#888888',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1D9E75',
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 12,
  },
  navigateButtonText: {
    color: '#0D0D0D',
    fontSize: 14,
    fontWeight: '600',
  },
  beenHereButton: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#1D9E75',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  beenHereButtonVerified: {
    borderColor: '#1D9E75',
    opacity: 0.7,
  },
  beenHereButtonText: {
    color: '#1D9E75',
    fontSize: 14,
    fontWeight: '600',
  },
  beenHereButtonTextVerified: {
    color: '#1D9E75',
  },
  commentsTitle: {
    color: '#F5F5F5',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyComments: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    color: '#0D0D0D',
    fontSize: 14,
    fontWeight: '600',
  },
  commentBubble: {
    flex: 1,
    backgroundColor: '#141414',
    borderWidth: 0.5,
    borderColor: '#222222',
    borderRadius: 12,
    padding: 12,
  },
  commentUsername: {
    color: '#F5F5F5',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  commentContent: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 18,
  },
  commentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  commentTime: {
    color: '#555555',
    fontSize: 11,
  },
  commentLikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentLikeCount: {
    color: '#555555',
    fontSize: 11,
  },
  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#0D0D0D',
    borderTopWidth: 0.5,
    borderTopColor: '#222222',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#141414',
    borderWidth: 0.5,
    borderColor: '#222222',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#F5F5F5',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
