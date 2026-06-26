import { getMyBlockedUsers } from '@/lib/safety';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { markConversationRead } from '@/lib/markConversationRead';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ProfileRef = {
  username: string;
  avatar_url?: string | null;
  is_official?: boolean;
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
  isOfficial: boolean;
  lastMessage: string;
  lastMessageAt: string;
  hasUnread: boolean;
};

type ConversationSection = {
  key: 'main' | 'requests';
  data: Conversation[];
  requestCount?: number;
};

const timeAgo = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.floor((startOfToday.getTime() - startOfDate.getTime()) / 86400000);
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return `${dayDiff}d`;

  return date.toLocaleDateString();
};

const buildAcceptedFollowIds = (
  userId: string,
  rows: { follower_id: string; following_id: string }[],
): Set<string> => {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.follower_id === userId) {
      ids.add(row.following_id);
    } else {
      ids.add(row.follower_id);
    }
  }
  return ids;
};

export default function MessagesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [acceptedFollowIds, setAcceptedFollowIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    setMessagesError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setConversations([]);
      setAcceptedFollowIds(new Set());
      setLoading(false);
      return;
    }

    const [{ data: messages, error }, { data: follows }] = await Promise.all([
      supabase
        .from('messages')
        .select(
          '*, sender:profiles!messages_sender_id_fkey(username, avatar_url, is_official), receiver:profiles!messages_receiver_id_fkey(username, avatar_url, is_official)',
        )
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false }),
      supabase
        .from('follows')
        .select('follower_id, following_id')
        .eq('status', 'accepted')
        .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`),
    ]);

    setAcceptedFollowIds(buildAcceptedFollowIds(user.id, follows ?? []));

    if (error) {
      setMessagesError('Something went wrong loading your messages. Tap retry to try again.');
      setConversations([]);
      setLoading(false);
      return;
    }

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
      const otherProfile = isSentByMe ? message.receiver : message.sender;
      const otherUsername = otherProfile?.username ?? 'Unknown';
      const otherAvatarUrl = otherProfile?.avatar_url ?? null;
      const otherIsOfficial = otherProfile?.is_official === true;

      const existing = conversationMap.get(otherUserId);
      const isUnread = !isSentByMe && !message.read;

      if (!existing) {
        conversationMap.set(otherUserId, {
          otherUserId,
          otherUsername,
          otherAvatarUrl,
          isOfficial: otherIsOfficial,
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

  const { mainConversations, requestConversations } = useMemo(() => {
    const sorted = [...conversations].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );

    const main: Conversation[] = [];
    const requests: Conversation[] = [];

    for (const conversation of sorted) {
      if (acceptedFollowIds.has(conversation.otherUserId)) {
        main.push(conversation);
      } else {
        requests.push(conversation);
      }
    }

    return { mainConversations: main, requestConversations: requests };
  }, [conversations, acceptedFollowIds]);

  const sections = useMemo((): ConversationSection[] => {
    const result: ConversationSection[] = [];

    if (mainConversations.length > 0) {
      result.push({ key: 'main', data: mainConversations });
    }

    if (requestConversations.length > 0) {
      result.push({
        key: 'requests',
        data: requestConversations,
        requestCount: requestConversations.length,
      });
    }

    return result;
  }, [mainConversations, requestConversations]);

  const handleRetryMessages = useCallback(() => {
    setMessagesError(null);
    setLoading(true);
    fetchConversations();
  }, [fetchConversations]);

  const handleConversationPress = useCallback(
    async (item: Conversation) => {
      if (item.hasUnread) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await markConversationRead(user.id, item.otherUserId);

          setConversations((prev) =>
            prev.map((conversation) =>
              conversation.otherUserId === item.otherUserId
                ? { ...conversation, hasUnread: false }
                : conversation,
            ),
          );
        }
      }

      router.push({
        pathname: '/chat',
        params: { userId: item.otherUserId, username: item.otherUsername },
      });
    },
    [router],
  );

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations]),
  );

  const renderConversation = useCallback(
    (item: Conversation, isRequest: boolean) => {
      const initial = item.otherUsername.charAt(0).toUpperCase();

      return (
        <TouchableOpacity
          style={[styles.conversationItem, isRequest && styles.conversationItemRequest]}
          onPress={() => handleConversationPress(item)}
          activeOpacity={0.7}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, isRequest && styles.avatarRequest]}>
              {isRequest ? (
                <Text style={styles.avatarQuestion}>?</Text>
              ) : item.otherAvatarUrl ? (
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
            {item.hasUnread && (
              <View style={styles.unreadDotOnAvatar} />
            )}
          </View>
          <View style={styles.conversationContent}>
            <View style={styles.conversationTopRow}>
              <View style={styles.nameRow}>
                <Text
                  style={[styles.username, item.hasUnread && styles.usernameUnread]}
                  numberOfLines={1}>
                  {item.otherUsername}
                </Text>
                {item.isOfficial && (
                  <View style={styles.officialBadge}>
                    <Text style={styles.officialBadgeText}>OFFICIAL</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.timeAgo, item.hasUnread && styles.timeAgoUnread]}>
                {timeAgo(item.lastMessageAt)}
              </Text>
            </View>
            <Text
              style={[styles.preview, item.hasUnread && styles.previewUnread]}
              numberOfLines={1}>
              {item.lastMessage}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleConversationPress, styles],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ConversationSection }) => {
      if (section.key !== 'requests') return null;

      return (
        <View style={styles.requestSectionHeader}>
          <Text style={styles.requestSectionLabel}>MESSAGE REQUESTS</Text>
          <View style={styles.requestCountBadge}>
            <Text style={styles.requestCountText}>{section.requestCount ?? 0}</Text>
          </View>
        </View>
      );
    },
    [styles],
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

      {messagesError && !loading && (
        <ErrorBanner message={messagesError} onRetry={handleRetryMessages} />
      )}

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
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.otherUserId}
          renderItem={({ item, section }) =>
            renderConversation(item, section.key === 'requests')
          }
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
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
    conversationItemRequest: {
      opacity: 0.5,
    },
    avatarWrap: {
      width: 48,
      height: 48,
      position: 'relative',
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
    avatarRequest: {
      backgroundColor: theme.bgTertiary,
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
    avatarQuestion: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.textTertiary,
    },
    unreadDotOnAvatar: {
      position: 'absolute',
      top: 1,
      right: 1,
      width: 13,
      height: 13,
      borderRadius: 7,
      backgroundColor: theme.accent,
      borderWidth: 2.5,
      borderColor: theme.background,
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
      fontWeight: '400',
      color: theme.text,
    },
    usernameUnread: {
      fontWeight: '700',
    },
    officialBadge: {
      backgroundColor: theme.accentSub,
      borderWidth: 0.5,
      borderColor: theme.accent,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
      flexShrink: 0,
    },
    officialBadgeText: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 9,
      color: theme.accent,
    },
    timeAgo: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: theme.textTertiary,
      flexShrink: 0,
    },
    timeAgoUnread: {
      color: theme.accent,
    },
    preview: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    previewUnread: {
      color: theme.text,
    },
    requestSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.bgTertiary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.border,
    },
    requestSectionLabel: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 9,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: theme.textTertiary,
    },
    requestCountBadge: {
      backgroundColor: theme.accent,
      borderRadius: 8,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    requestCountText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.accentText,
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
