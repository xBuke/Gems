import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { goBackOrTab, useTabRootBackHandler, useTabStackGesture } from '@/lib/navigationMotion';
import { sendPushNotification } from '@/lib/sendPushNotification';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type NotificationType = 'comment' | 'rating' | 'follow' | 'follow_request' | 'visit' | 'message' | 'like';

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

type NotificationSection = {
  title: string;
  data: Notification[];
};

const getTypeConfig = (theme: Theme) =>
  ({
    like: {
      icon: 'heart' as const,
      iconColor: '#FF4444',
      bgColor: 'rgba(255,68,68,0.2)',
      actionText: 'liked your gem',
    },
    comment: {
      icon: 'chatbubble' as const,
      iconColor: '#185FA5',
      bgColor: 'rgba(24,95,165,0.2)',
      actionText: 'commented on your gem',
    },
    visit: {
      icon: 'location' as const,
      iconColor: '#1D9E75',
      bgColor: 'rgba(29,158,117,0.2)',
      actionText: 'visited your gem',
    },
    follow: {
      icon: 'person-add' as const,
      iconColor: '#534AB7',
      bgColor: 'rgba(83,74,183,0.2)',
      actionText: 'started following you',
    },
    follow_request: {
      icon: 'person-add' as const,
      iconColor: theme.coral,
      bgColor: theme.coralSubtle,
      actionText: 'wants to follow you',
    },
    message: {
      icon: 'chatbubble-ellipses' as const,
      iconColor: '#BA7517',
      bgColor: 'rgba(186,117,23,0.2)',
      actionText: 'sent you a message',
    },
  }) as const;

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

const getDateGroupLabel = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.floor((startOfToday.getTime() - startOfDate.getTime()) / 86400000);

  if (dayDiff === 0) return 'TODAY';
  if (dayDiff === 1) return 'YESTERDAY';
  if (dayDiff <= 6) return `${dayDiff} DAYS AGO`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
};

const groupNotifications = (items: Notification[]): NotificationSection[] => {
  const filtered = items.filter((item) => item.type !== 'rating');
  const sections: NotificationSection[] = [];

  for (const item of filtered) {
    const label = getDateGroupLabel(item.created_at);
    const last = sections[sections.length - 1];
    if (last?.title === label) {
      last.data.push(item);
    } else {
      sections.push({ title: label, data: [item] });
    }
  }

  return sections;
};

export default function NotificationsScreen() {
  const router = useRouter();
  useTabRootBackHandler(true);
  useTabStackGesture(router);
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [followRequestStatus, setFollowRequestStatus] = useState<
    Record<string, 'accepted' | 'declined'>
  >({});

  const sections = useMemo(() => groupNotifications(notifications), [notifications]);

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

  const markAllReadOnVisit = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
      markAllReadOnVisit();
    }, [fetchNotifications, markAllReadOnVisit]),
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
    await markAllReadOnVisit();
  };

  const markAsRead = async (notification: Notification) => {
    if (notification.read) return;

    await supabase.from('notifications').update({ read: true }).eq('id', notification.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
    );
  };

  const handleNotificationPress = async (notification: Notification) => {
    await markAsRead(notification);

    if (notification.type === 'message') {
      router.push({
        pathname: '/chat',
        params: {
          userId: notification.sender_id,
          username: notification.sender?.username,
        },
      });
    } else if (notification.type === 'follow') {
      router.push({ pathname: '/profile', params: { userId: notification.sender_id } });
    } else if (notification.type === 'follow_request') {
      return;
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

  const handleAcceptRequest = async (notification: Notification) => {
    if (!currentUserId) return;

    const { error } = await supabase
      .from('follows')
      .update({ status: 'accepted' })
      .eq('follower_id', notification.sender_id)
      .eq('following_id', currentUserId);

    if (!error) {
      hapticSuccess();
      await markAsRead(notification);
      setFollowRequestStatus((prev) => ({ ...prev, [notification.id]: 'accepted' }));

      void (async () => {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', currentUserId)
          .single();
        sendPushNotification({
          user_id: notification.sender_id,
          category: 'social',
          title: 'Follow accepted',
          body: `@${myProfile?.username ?? 'Someone'} accepted your follow request`,
          data: { type: 'follow_accepted', user_id: currentUserId },
        });
      })();
    }
  };

  const handleDeclineRequest = async (notification: Notification) => {
    if (!currentUserId) return;

    hapticLight();

    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', notification.sender_id)
      .eq('following_id', currentUserId);

    await markAsRead(notification);
    setFollowRequestStatus((prev) => ({ ...prev, [notification.id]: 'declined' }));
  };

  const renderRightThumbnail = (item: Notification) => {
    const username = item.sender?.username ?? 'S';

    if (item.type === 'follow' || item.type === 'follow_request' || item.type === 'message') {
      return (
        <View style={styles.initialAvatar}>
          <Text style={styles.initialText}>{username.charAt(0).toUpperCase()}</Text>
        </View>
      );
    }

    if (!item.gem) return null;

    if (item.gem.image_url) {
      return (
        <Image
          source={{ uri: item.gem.image_url }}
          style={styles.gemThumbnail}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      );
    }

    return (
      <View style={styles.gemThumbnailFallback}>
        <Ionicons name="location" size={20} color={theme.accent} />
      </View>
    );
  };

  const renderFollowRequestActions = (item: Notification, username: string) => {
    const status = followRequestStatus[item.id];

    if (status === 'accepted') {
      return (
        <View style={styles.acceptConfirmation}>
          <Text style={styles.acceptConfirmationText}>✓ Now following {username}</Text>
        </View>
      );
    }

    if (status === 'declined') {
      return (
        <View style={styles.declineConfirmation}>
          <Text style={styles.declineConfirmationText}>Request declined</Text>
        </View>
      );
    }

    return (
      <View style={styles.followRequestActions}>
        <TouchableOpacity
          style={styles.declineButton}
          onPress={() => handleDeclineRequest(item)}
          activeOpacity={0.8}>
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptRequest(item)}
          activeOpacity={0.8}>
          <Text style={styles.acceptButtonText}>Accept ✓</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderNotification = (item: Notification) => {
    if (item.type === 'rating') return null;

    const typeConfig = getTypeConfig(theme);
    const config = typeConfig[item.type];
    const username = item.sender?.username ?? 'Someone';
    const isFollowRequest = item.type === 'follow_request';

    const rowStyle = [
      styles.notificationItem,
      item.read ? styles.notificationRead : styles.notificationUnread,
    ];

    const content = (
      <>
        <View style={[styles.iconCircle, { backgroundColor: config.bgColor }]}>
          <Ionicons name={config.icon} size={18} color={config.iconColor} />
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationTextRow}>
            <Text style={styles.username}>{username}</Text>
            <Text style={styles.actionText}> {config.actionText}</Text>
          </View>
          <Text style={styles.notificationTime}>{timeAgo(item.created_at)}</Text>
          {isFollowRequest && renderFollowRequestActions(item, username)}
        </View>
        {isFollowRequest ? (
          <TouchableOpacity
            onPress={() =>
              router.push({ pathname: '/profile', params: { userId: item.sender_id } })
            }
            activeOpacity={0.7}>
            {renderRightThumbnail(item)}
          </TouchableOpacity>
        ) : (
          renderRightThumbnail(item)
        )}
      </>
    );

    if (isFollowRequest) {
      return <View style={rowStyle}>{content}</View>;
    }

    return (
      <TouchableOpacity
        style={rowStyle}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => goBackOrTab(router, 'index')}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.headerSide}>
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
          data={sections}
          keyExtractor={(section) => section.title}
          renderItem={({ item: section, index }) => (
            <View>
              <Text style={[styles.dateHeader, index > 0 && styles.dateHeaderNotFirst]}>
                {section.title}
              </Text>
              {section.data.map((notification) => (
                <View key={notification.id}>{renderNotification(notification)}</View>
              ))}
            </View>
          )}
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
    dateHeader: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: theme.textTertiary,
      letterSpacing: 2,
      textTransform: 'uppercase',
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 4,
    },
    dateHeaderNotFirst: {
      paddingTop: 10,
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
      borderLeftWidth: 3,
      borderLeftColor: theme.accent,
    },
    notificationRead: {
      backgroundColor: theme.background,
      borderLeftWidth: 0,
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
      color: theme.textSecondary,
    },
    notificationTime: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 11,
      color: theme.textTertiary,
      marginTop: 3,
    },
    followRequestActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
    },
    acceptButton: {
      flex: 1,
      backgroundColor: theme.accent,
      borderRadius: 8,
      paddingVertical: 7,
      alignItems: 'center',
    },
    acceptButtonText: {
      fontFamily: 'SpaceGrotesk-SemiBold',
      fontSize: 13,
      color: theme.accentText,
    },
    declineButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingVertical: 7,
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    declineButtonText: {
      fontFamily: 'SpaceGrotesk-SemiBold',
      fontSize: 13,
      color: theme.textSecondary,
    },
    acceptConfirmation: {
      backgroundColor: theme.accentSub,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      marginTop: 10,
      alignSelf: 'flex-start',
    },
    acceptConfirmationText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.accent,
    },
    declineConfirmation: {
      backgroundColor: theme.textSecondary + '26',
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      marginTop: 10,
      alignSelf: 'flex-start',
    },
    declineConfirmationText: {
      fontSize: 12,
      color: theme.textSecondary,
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
      backgroundColor: theme.bgTertiary,
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
      color: theme.accentText,
    },
  });
