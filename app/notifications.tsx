import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type NotificationType = 'comment' | 'rating' | 'follow' | 'visit' | 'message' | 'like';

type Notification = {
  id: string;
  user_id: string;
  sender_id: string;
  type: NotificationType;
  gem_id: string | null;
  read: boolean;
  created_at: string;
  sender: { username: string; avatar_url: string | null } | null;
  gem: { title: string; image_url: string | null } | null;
};

const TYPE_CONFIG: Record<
  Exclude<NotificationType, 'rating'>,
  {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    bgColor: string;
    actionText: string;
  }
> = {
  like: {
    icon: 'heart',
    iconColor: '#FF4444',
    bgColor: 'rgba(255,68,68,0.2)',
    actionText: 'liked your gem',
  },
  comment: {
    icon: 'chatbubble',
    iconColor: '#185FA5',
    bgColor: 'rgba(24,95,165,0.2)',
    actionText: 'commented on your gem',
  },
  visit: {
    icon: 'location',
    iconColor: '#1D9E75',
    bgColor: 'rgba(29,158,117,0.2)',
    actionText: 'visited your gem',
  },
  follow: {
    icon: 'person-add',
    iconColor: '#534AB7',
    bgColor: 'rgba(83,74,183,0.2)',
    actionText: 'started following you',
  },
  message: {
    icon: 'chatbubble-ellipses',
    iconColor: '#BA7517',
    bgColor: 'rgba(186,117,23,0.2)',
    actionText: 'sent you a message',
  },
};

const NOTIFICATION_SELECT =
  '*, sender:profiles!notifications_sender_id_fkey(username, avatar_url), gem:gems(title, image_url)';

const timeAgo = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCurrentUserId(null);
      setNotifications([]);
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const { data } = await supabase
      .from('notifications')
      .select(NOTIFICATION_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setNotifications(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications]),
  );

  useEffect(() => {
    if (!currentUserId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    channel = supabase
      .channel('notifications-' + currentUserId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUserId}`,
        },
        async (payload) => {
          const newNotification = payload.new as Notification;
          const { data: fullNotification } = await supabase
            .from('notifications')
            .select(NOTIFICATION_SELECT)
            .eq('id', newNotification.id)
            .single();

          if (!fullNotification) return;

          setNotifications((prev) => {
            if (prev.some((n) => n.id === fullNotification.id)) return prev;
            return [fullNotification, ...prev];
          });
        },
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const handleMarkAllRead = async () => {
    if (!currentUserId) return;

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', currentUserId)
      .eq('read', false);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      );
    }

    if (notification.type === 'message') {
      router.push({
        pathname: '/chat',
        params: {
          userId: notification.sender_id,
          username: notification.sender?.username,
        },
      });
    } else if (notification.type === 'follow') {
      router.push('/profile?userId=' + notification.sender_id);
    } else if (
      notification.type === 'like' ||
      notification.type === 'comment' ||
      notification.type === 'visit'
    ) {
      if (notification.gem_id) {
        router.push('/gem/' + notification.gem_id);
      }
    }
  };

  const renderRightThumbnail = (item: Notification) => {
    const username = item.sender?.username ?? 'S';

    if (item.type === 'follow' || item.type === 'message') {
      return (
        <View style={styles.initialAvatar}>
          <Text style={styles.initialText}>{username.charAt(0).toUpperCase()}</Text>
        </View>
      );
    }

    if (!item.gem) return null;

    if (item.gem.image_url) {
      return (
        <Image source={{ uri: item.gem.image_url }} style={styles.gemThumbnail} resizeMode="cover" />
      );
    }

    return (
      <View style={styles.gemThumbnailFallback}>
        <Ionicons name="location" size={20} color={theme.accent} />
      </View>
    );
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    if (item.type === 'rating') return null;

    const config = TYPE_CONFIG[item.type];
    const username = item.sender?.username ?? 'Someone';

    return (
      <TouchableOpacity
        style={[styles.notificationItem, item.read ? styles.notificationRead : styles.notificationUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}>
        <View style={[styles.iconCircle, { backgroundColor: config.bgColor }]}>
          <Ionicons name={config.icon} size={18} color={config.iconColor} />
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationTextRow}>
            <Text style={styles.username}>{username}</Text>
            <Text style={styles.actionText}> {config.actionText}</Text>
          </View>
          <Text style={styles.notificationTime}>{timeAgo(item.created_at)}</Text>
          {!item.read && <View style={styles.unreadDot} />}
        </View>
        {renderRightThumbnail(item)}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7} style={styles.headerSideRight}>
          <Text style={styles.markAllRead}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-outline" size={56} color={theme.accent} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>Interact with gems to get notified!</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
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
      width: 80,
    },
    headerSideRight: {
      width: 80,
      alignItems: 'flex-end',
    },
    headerTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
    },
    markAllRead: {
      fontSize: 13,
      color: theme.accent,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginTop: 4,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    notificationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.border,
      gap: 12,
    },
    notificationUnread: {
      backgroundColor: theme.card,
    },
    notificationRead: {
      backgroundColor: theme.background,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationContent: {
      flex: 1,
      position: 'relative',
    },
    notificationTextRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    username: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    actionText: {
      fontSize: 14,
      color: '#A8D5BA',
    },
    notificationTime: {
      fontSize: 12,
      color: theme.textTertiary,
      marginTop: 3,
    },
    unreadDot: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.accent,
    },
    gemThumbnail: {
      width: 52,
      height: 52,
      borderRadius: 8,
      overflow: 'hidden',
    },
    gemThumbnailFallback: {
      width: 52,
      height: 52,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: '#1A5C3A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    initialAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initialText: {
      fontSize: 20,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
