import { getMyBlockedUsers } from '@/lib/safety';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
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

type ProfileRef = {
  username: string;
  avatar_url?: string | null;
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
  otherAvatarUrl: string | null;
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
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
        '*, sender:profiles!messages_sender_id_fkey(username, avatar_url), receiver:profiles!messages_receiver_id_fkey(username, avatar_url)',
      )
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!messages) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const blocked = await getMyBlockedUsers(user.id);
    const blockedIds = new Set(blocked.map((b: { blocked_id: string }) => b.blocked_id));

    const conversationMap = new Map<string, Conversation>();

    for (const message of messages as Message[]) {
      const isSentByMe = message.sender_id === user.id;
      const otherUserId = isSentByMe ? message.receiver_id : message.sender_id;

      if (blockedIds.has(otherUserId)) continue;
      const otherUsername = isSentByMe
        ? message.receiver?.username ?? 'Unknown'
        : message.sender?.username ?? 'Unknown';
      const otherAvatarUrl = isSentByMe
        ? message.receiver?.avatar_url ?? null
        : message.sender?.avatar_url ?? null;

      const existing = conversationMap.get(otherUserId);
      const isUnread = !isSentByMe && !message.read;

      if (!existing) {
        conversationMap.set(otherUserId, {
          otherUserId,
          otherUsername,
          otherAvatarUrl,
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

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations]),
  );

  const renderConversation = useCallback(
    ({ item }: { item: Conversation }) => {
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
            {item.otherAvatarUrl ? (
              <Image
                source={{ uri: item.otherAvatarUrl }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
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
    },
    [router, styles],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity onPress={() => Alert.alert('Coming Soon', 'Starting new conversations from here is coming soon. For now, message someone by visiting their profile and tapping "Send Message".')} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSideRight}>
          <Ionicons name="create-outline" size={22} color={theme.accent} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 }}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={64} color={theme.accent} style={styles.emptyIcon} />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
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
      color: theme.text,
      textAlign: 'center',
    },
    conversationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.border,
      gap: 12,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
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
      color: theme.text,
    },
    usernameUnread: {
      fontWeight: '700',
    },
    timeAgo: {
      fontSize: 12,
      color: theme.textTertiary,
    },
    preview: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.accent,
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
      color: theme.text,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 6,
      textAlign: 'center',
    },
  });
