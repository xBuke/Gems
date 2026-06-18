import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  bg: '#0D0D0D',
  accent: '#1D9E75',
  text: '#F5F5F5',
  textMuted: '#888888',
  textDim: '#555555',
  unread: '#4A9EFF',
};

type ProfileRef = {
  username: string;
};

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
  sender: ProfileRef | null;
  receiver: ProfileRef | null;
};

type Conversation = {
  otherUserId: string;
  otherUsername: string;
  lastMessage: string;
  lastMessageAt: string;
  hasUnread: boolean;
};

const timeAgo = (dateString: string) => {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateString).toLocaleDateString();
};

export default function MessagesScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const { data: messages } = await supabase
      .from('messages')
      .select(
        '*, sender:profiles!messages_sender_id_fkey(username), receiver:profiles!messages_receiver_id_fkey(username)',
      )
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!messages) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const conversationMap = new Map<string, Conversation>();

    for (const message of messages as Message[]) {
      const isSentByMe = message.sender_id === user.id;
      const otherUserId = isSentByMe ? message.receiver_id : message.sender_id;
      const otherUsername = isSentByMe
        ? message.receiver?.username ?? 'Unknown'
        : message.sender?.username ?? 'Unknown';

      const existing = conversationMap.get(otherUserId);
      const isUnread = !isSentByMe && !message.read;

      if (!existing) {
        conversationMap.set(otherUserId, {
          otherUserId,
          otherUsername,
          lastMessage: message.content,
          lastMessageAt: message.created_at,
          hasUnread: isUnread,
        });
      } else if (isUnread) {
        existing.hasUnread = true;
      }
    }

    setConversations(Array.from(conversationMap.values()));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const renderConversation = ({ item }: { item: Conversation }) => {
    const initial = item.otherUsername.charAt(0).toUpperCase();

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() =>
          router.push({
            pathname: '/chat',
            params: { userId: item.otherUserId, username: item.otherUsername },
          })
        }
        activeOpacity={0.7}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationTopRow}>
            <Text style={styles.username} numberOfLines={1}>
              {item.otherUsername}
            </Text>
            <Text style={styles.timeAgo}>{timeAgo(item.lastMessageAt)}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.preview} numberOfLines={1}>
              {item.lastMessage}
            </Text>
            {item.hasUnread && <View style={styles.unreadDot} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => console.log('New message')} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={24} color={COLORS.accent} />
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Messages</Text>

      {!loading && conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={48} color={COLORS.accent} />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtitle}>Find gems and connect with explorers!</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.otherUserId}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  conversationContent: {
    flex: 1,
  },
  conversationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  username: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: 8,
  },
  timeAgo: {
    fontSize: 12,
    color: COLORS.textDim,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  preview: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.unread,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textDim,
    textAlign: 'center',
  },
});
