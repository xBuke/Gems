import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
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
  rating_avg: number | null;
  rating_count: number | null;
  user_id: string;
  profiles: { username: string } | null;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  profiles: { username: string } | null;
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
  const [userRating, setUserRating] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchComments = async () => {
    if (!id) return;

    const { data: commentsData } = await supabase
      .from('comments')
      .select('*, profiles(username)')
      .eq('gem_id', id)
      .order('created_at', { ascending: true });

    if (commentsData) setComments(commentsData);
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

      if (data) setGem(data);
      if (error) console.log('Error details:', JSON.stringify(error));
      setLoading(false);
    };

    fetchGem();
  }, [id]);

  useEffect(() => {
    const gemId = Array.isArray(id) ? id[0] : id;
    if (gemId) fetchComments();
  }, [id]);

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('comments')
      .insert({ gem_id: id, user_id: user.id, content: text });

    if (!error) {
      setCommentText('');
      fetchComments();
    }
  };

  const handleSubmitRating = async () => {
    if (!userRating || !id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('ratings').upsert(
      {
        gem_id: id,
        user_id: user.id,
        rating: userRating,
      },
      { onConflict: 'gem_id,user_id' }
    );

    if (error) return;

    const { data: ratingsData } = await supabase
      .from('ratings')
      .select('rating')
      .eq('gem_id', id);

    if (ratingsData && ratingsData.length > 0) {
      const count = ratingsData.length;
      const average = ratingsData.reduce((sum, r) => sum + r.rating, 0) / count;

      await supabase
        .from('gems')
        .update({ rating_avg: average, rating_count: count })
        .eq('id', id);
    }

    Alert.alert('Rating saved!');
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

          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{gem.category}</Text>
          </View>

          <TouchableOpacity style={styles.saveButton} activeOpacity={0.8}>
            <Ionicons name="heart-outline" size={24} color="#FFFFFF" />
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

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.statText}>
                {gem.rating_avg != null && gem.rating_avg > 0
                  ? gem.rating_avg.toFixed(1)
                  : 'No ratings'}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="eye-outline" size={16} color="#888888" />
              <Text style={styles.statText}>{gem.rating_count ?? 0}</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="heart-outline" size={16} color="#888888" />
              <Text style={styles.statText}>0</Text>
            </View>
          </View>

          <View style={styles.ratingSection}>
            <Text style={styles.ratingLabel}>Rate this gem</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setUserRating(star)}
                  activeOpacity={0.7}>
                  <Ionicons
                    name={star <= userRating ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= userRating ? '#FFD700' : '#555555'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {userRating > 0 && (
              <TouchableOpacity
                style={styles.submitRatingButton}
                onPress={handleSubmitRating}
                activeOpacity={0.8}>
                <Text style={styles.submitRatingText}>Submit rating</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          <Text style={styles.description}>{gem.description || 'No description provided.'}</Text>

          <TouchableOpacity style={styles.navigateButton} onPress={openMaps} activeOpacity={0.8}>
            <Ionicons name="navigate" size={20} color="#0D0D0D" />
            <Text style={styles.navigateButtonText}>Navigate</Text>
          </TouchableOpacity>

          <Text style={styles.commentsTitle}>Comments</Text>
          {comments.length === 0 ? (
            <Text style={styles.emptyComments}>Be the first to comment!</Text>
          ) : (
            comments.map((comment) => {
              const username = comment.profiles?.username ?? 'Anonymous';
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
                    <Text style={styles.commentTime}>
                      {new Date(comment.created_at).toLocaleDateString()}
                    </Text>
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
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => console.log('Share gem', gem.id)}
          activeOpacity={0.8}>
          <Ionicons name="share-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
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
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: '#0F3D25',
    borderWidth: 0.5,
    borderColor: '#1D9E75',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
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
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#141414',
    borderWidth: 0.5,
    borderColor: '#222222',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  statText: {
    color: '#888888',
    fontSize: 13,
  },
  ratingSection: {
    marginBottom: 20,
  },
  ratingLabel: {
    color: '#F5F5F5',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  submitRatingButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#1D9E75',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  submitRatingText: {
    color: '#0D0D0D',
    fontSize: 14,
    fontWeight: '600',
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
    marginBottom: 24,
  },
  navigateButtonText: {
    color: '#0D0D0D',
    fontSize: 14,
    fontWeight: '600',
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
  commentTime: {
    color: '#555555',
    fontSize: 11,
    marginTop: 6,
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
