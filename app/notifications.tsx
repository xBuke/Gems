import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
  sender: { username: string } | null;
};

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: keyof typeof Ionicons.glyphMap; color: string; text: string }
> = {
  comment: {
    icon: 'chatbubble',
    color: '#1D9E75',
    text: ' commented on your gem',
  },
  rating: {
    icon: 'star',
    color: '#FFD700',
    text: ' rated your gem ⭐',
  },
  like: {
    icon: 'heart',
    color: '#FF4444',
    text: ' liked your gem',
  },
  follow: {
    icon: 'person-add',
    color: '#185FA5',
    text: ' started following you',
  },
  visit: {
    icon: 'location',
    color: '#D85A30',
    text: ' visited your gem',
  },
  message: {
    icon: 'chatbubble',
    color: '#185FA5',
    text: ' sent you a message',
  },
};

const timeAgo = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const hexWithOpacity = (hex: string, opacity: number) => {
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${alpha}`;
};

export default function NotificationsScreen() {
  const router = useRouter();
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
      .select('*, sender:profiles!notifications_sender_id_fkey(username)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setNotifications(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!currentUserId) return;

    let channel: any = null;

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
          const { data: sender } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', newNotification.sender_id)
            .single();

          setNotifications((prev) => {
            if (prev.some((n) => n.id === newNotification.id)) return prev;
            return [{ ...newNotification, sender }, ...prev];
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
    } else if (notification.gem_id) {
      router.push('/gem/' + notification.gem_id);
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const config = TYPE_CONFIG[item.type];

    return (
      <TouchableOpacity
        style={[styles.notificationItem, item.read ? styles.notificationRead : styles.notificationUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}>
        <View style={[styles.iconCircle, { backgroundColor: hexWithOpacity(config.color, 0.2) }]}>
          <Ionicons name={config.icon} size={20} color={config.color} />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationText}>
            <Text style={styles.usernameBold}>{item.sender?.username ?? 'Someone'}</Text>
            {config.text}
          </Text>
          <Text style={styles.notificationTime}>{timeAgo(item.created_at)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
          <Text style={styles.markAllRead}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#1D9E75" size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-outline" size={48} color="#1D9E75" />
          <Text style={styles.emptyText}>No notifications yet</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  markAllRead: {
    fontSize: 13,
    color: '#1D9E75',
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
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#888888',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222222',
    gap: 12,
  },
  notificationUnread: {
    backgroundColor: '#141414',
  },
  notificationRead: {
    backgroundColor: '#0D0D0D',
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
    gap: 4,
  },
  notificationText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  usernameBold: {
    fontWeight: '700',
  },
  notificationTime: {
    fontSize: 12,
    color: '#555555',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4A9EFF',
  },
});
