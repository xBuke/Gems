import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  average_rating: number | null;
  rating_count: number | null;
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const [gem, setGem] = useState<Gem | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchGem = async () => {
      const { data } = await supabase.from('gems').select('*').eq('id', id).single();
      if (data) setGem(data);
      setLoading(false);
    };

    const fetchComments = async () => {
      const { data } = await supabase
        .from('comments')
        .select('*, profiles(username)')
        .eq('gem_id', id);
      if (data) setComments(data);
    };

    fetchGem();
    fetchComments();
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
    if (!commentText.trim() || !id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('comments')
      .insert({ gem_id: id, user_id: user.id, content: commentText.trim() })
      .select('*, profiles(username)')
      .single();

    if (!error && data) {
      setComments((prev) => [...prev, data]);
      setCommentText('');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1D9E75" />
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

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#A8D5BA" />
            <Text style={styles.locationText}>
              {gem.latitude}, {gem.longitude}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.statText}>
                {gem.average_rating != null ? gem.average_rating.toFixed(1) : 'No ratings yet'}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="eye-outline" size={16} color="#A8D5BA" />
              <Text style={styles.statText}>{gem.rating_count ?? 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="heart-outline" size={16} color="#A8D5BA" />
              <Text style={styles.statText}>0</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.description}>{gem.description || 'No description provided.'}</Text>

          <TouchableOpacity style={styles.navigateButton} onPress={openMaps} activeOpacity={0.8}>
            <Ionicons name="navigate" size={20} color="#FFFFFF" />
            <Text style={styles.navigateButtonText}>Navigate</Text>
          </TouchableOpacity>

          <Text style={styles.commentsTitle}>Comments</Text>
          {comments.length === 0 ? (
            <Text style={styles.emptyComments}>Be the first to comment!</Text>
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={styles.commentItem}>
                <Text style={styles.commentUsername}>
                  {comment.profiles?.username ?? 'Anonymous'}
                </Text>
                <Text style={styles.commentContent}>{comment.content}</Text>
              </View>
            ))
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
          <Ionicons name="send" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A2E1F',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A2E1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 12,
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
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    height: 280,
    backgroundColor: '#1A5C3A',
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
    backgroundColor: '#1D9E75',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  locationText: {
    color: '#A8D5BA',
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: '#A8D5BA',
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: '#1D9E75',
    marginBottom: 16,
  },
  description: {
    color: '#A8D5BA',
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
    borderRadius: 25,
    paddingVertical: 14,
    marginBottom: 24,
  },
  navigateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  commentsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyComments: {
    color: '#A8D5BA',
    fontSize: 14,
    marginBottom: 16,
  },
  commentItem: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#0F3D25',
    borderRadius: 8,
  },
  commentUsername: {
    color: '#1D9E75',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  commentContent: {
    color: '#A8D5BA',
    fontSize: 14,
  },
  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#0A2E1F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333333',
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
