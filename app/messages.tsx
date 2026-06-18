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
            <Text
              style={[styles.username, item.hasUnread && styles.usernameUnread]}
              numberOfLines={1}>
              {item.otherUsername}
            </Text>
            <Text style={styles.timeAgo}>{timeAgo(item.lastMessageAt)}</Text>
          </View>
          <Text style={styles.preview} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        </View>
        {item.hasUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color="#F5F5F5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity onPress={() => console.log('New message')} activeOpacity={0.7} style={styles.headerSideRight}>
          <Ionicons name="create-outline" size={22} color="#1D9E75" />
        </TouchableOpacity>
      </View>

      {!loading && conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={64} color="#1D9E75" style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtitle}>Connect with other explorers!</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.otherUserId}
          renderItem={renderConversation}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSide: {
    width: 40,
  },
  headerSideRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222222',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  conversationContent: {
    flex: 1,
  },
  conversationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  username: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  usernameUnread: {
    fontWeight: '700',
  },
  timeAgo: {
    fontSize: 12,
    color: '#555555',
  },
  preview: {
    fontSize: 13,
    color: '#888888',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1D9E75',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888888',
    marginTop: 6,
    textAlign: 'center',
  },
});
