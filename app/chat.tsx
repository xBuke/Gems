import { formatCoordinates } from '@/lib/coordinates';
import { blockUser } from '@/lib/safety';
import { hapticLight } from '@/lib/haptics';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import ReportSheet from '@/components/ReportSheet';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH * 0.75;
// Custom header row height (paddingVertical 12 × 2 + avatar row). Tune after visual testing on device.
const HEADER_HEIGHT = 56;

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
};

type ChatItem =
  | { type: 'message'; id: string; data: Message }
  | { type: 'date'; id: string; label: string };

type ShareableGem = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  category: string;
};

const COORD_LINE_REGEX = /^\d+\.\d{4}° [NS], \d+\.\d{4}° [EW]$/;

const isCoordLine = (line: string) => COORD_LINE_REGEX.test(line.trim());

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateLabel = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'TODAY';
  if (date.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
  return date
    .toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    .toUpperCase();
};

const buildChatItems = (messages: Message[]): ChatItem[] => {
  const items: ChatItem[] = [];
  let lastDate: string | null = null;

  for (const message of messages) {
    const dateKey = new Date(message.created_at).toDateString();
    if (dateKey !== lastDate) {
      items.push({
        type: 'date',
        id: `date-${dateKey}`,
        label: formatDateLabel(message.created_at),
      });
      lastDate = dateKey;
    }
    items.push({ type: 'message', id: message.id, data: message });
  }

  return items.reverse();
};

export default function ChatScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { userId, username } = useLocalSearchParams<{ userId: string; username: string }>();
  const [myId, setMyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [otherAvatarUrl, setOtherAvatarUrl] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [gemPickerVisible, setGemPickerVisible] = useState(false);
  const [myGems, setMyGems] = useState<ShareableGem[]>([]);
  const [gemsLoading, setGemsLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const chatItems = useMemo(() => buildChatItems(messages), [messages]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !userId) {
      setMessagesLoading(false);
      return;
    }

    setMyId(user.id);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    setOtherAvatarUrl(profileData?.avatar_url ?? null);

    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(username)')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`,
      )
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data as Message[]);
    }

    await supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', user.id)
      .eq('sender_id', userId);

    setMessagesLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!myId || !userId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    channel = supabase
      .channel('messages-' + myId + '-' + userId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${myId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          if (
            newMessage.sender_id === userId ||
            (newMessage.sender_id === myId && newMessage.receiver_id === userId)
          ) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMessage.id)) return prev;
              return [...prev, newMessage];
            });
            if (newMessage.sender_id === userId) {
              supabase
                .from('messages')
                .update({ read: true })
                .eq('receiver_id', myId)
                .eq('sender_id', userId);
            }
          }
        },
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [myId, userId]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  const sendMessage = useCallback(
    async (textToSend: string) => {
      if (!textToSend.trim() || !myId || !userId || sending) return false;

      setSending(true);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: myId,
          receiver_id: userId,
          content: textToSend.trim(),
        })
        .select('*, sender:profiles!messages_sender_id_fkey(username)')
        .single();

      setSending(false);

      if (error) {
        console.log('Send message error:', error);
        Alert.alert('Message not sent', 'Please check your connection and try again.');
        return false;
      }

      if (data) {
        hapticLight();
        setMessages((prev) => [...prev, data as Message]);

        await supabase.from('notifications').insert({
          user_id: userId,
          sender_id: myId,
          type: 'message',
          gem_id: null,
          read: false,
        });
      }

      return true;
    },
    [myId, sending, userId],
  );

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const textToSend = inputText.trim();
    setInputText('');
    const sent = await sendMessage(textToSend);
    if (!sent) setInputText(textToSend);
  };

  const loadMyGems = useCallback(async () => {
    if (!myId) return;
    setGemsLoading(true);
    const { data } = await supabase
      .from('gems')
      .select('id, title, latitude, longitude, image_url, category')
      .eq('user_id', myId)
      .order('created_at', { ascending: false });
    setMyGems((data as ShareableGem[] | null) ?? []);
    setGemsLoading(false);
  }, [myId]);

  const openGemPicker = async () => {
    hapticLight();
    setGemPickerVisible(true);
    await loadMyGems();
  };

  const handleShareGem = async (gem: ShareableGem) => {
    setGemPickerVisible(false);
    const coords = formatCoordinates(gem.latitude, gem.longitude);
    const content = `${gem.title}\n${coords}`;
    await sendMessage(content);
  };

  const goToProfile = () => {
    router.push('/profile?userId=' + userId);
  };

  const showChatMenu = () => {
    if (!myId || !userId) return;

    const options = ['Report User', 'Block User', 'Cancel'];
    const cancelIndex = 2;

    const handleSelection = (index: number) => {
      if (index === 0) setReportVisible(true);
      if (index === 1) {
        Alert.alert(
          `Block ${displayName}?`,
          'They won\'t be able to message you and you won\'t see their content.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                await blockUser(myId, userId);
                router.back();
              },
            },
          ],
        );
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: 1 },
        handleSelection,
      );
    } else {
      Alert.alert('Options', undefined, [
        { text: 'Report User', onPress: () => setReportVisible(true) },
        {
          text: 'Block User',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              `Block ${displayName}?`,
              'They won\'t be able to message you and you won\'t see their content.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Block',
                  style: 'destructive',
                  onPress: async () => {
                    await blockUser(myId, userId);
                    router.back();
                  },
                },
              ],
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const displayName = typeof username === 'string' ? username : 'User';
  const initial = displayName.charAt(0).toUpperCase();
  const canSend = inputText.trim().length > 0 && !sending;

  const renderMessageContent = useCallback(
    (content: string, isMine: boolean) => {
      const lines = content.split('\n');

      return lines.map((line, index) => {
        const isLast = index === lines.length - 1;

        if (isCoordLine(line)) {
          return (
            <Text
              key={`${index}-${line}`}
              style={[
                styles.coordText,
                isMine ? styles.coordTextMine : styles.coordTextTheirs,
                index > 0 && styles.coordTextSpaced,
              ]}>
              {line.trim()}
            </Text>
          );
        }

        return (
          <Text
            key={`${index}-${line}`}
            style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
            {line}
            {!isLast ? '\n' : ''}
          </Text>
        );
      });
    },
    [styles],
  );

  const renderMessage = useCallback(
    (item: Message) => {
      const isMine = item.sender_id === myId;

      return (
        <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowTheirs]}>
          <View style={styles.messageBlock}>
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
              {renderMessageContent(item.content, isMine)}
            </View>
            <Text style={[styles.timestamp, isMine && styles.timestampMine]}>
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>
      );
    },
    [myId, renderMessageContent, styles],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatItem }) => {
      if (item.type === 'date') {
        return (
          <View style={styles.dateSeparatorWrap}>
            <View style={styles.dateSeparator}>
              <Text style={styles.dateSeparatorText}>{item.label}</Text>
            </View>
          </View>
        );
      }

      return renderMessage(item.data);
    },
    [renderMessage, styles],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerCenter} onPress={goToProfile} activeOpacity={0.7}>
          <View style={styles.headerAvatarRing}>
            <View style={styles.headerAvatar}>
              {otherAvatarUrl ? (
                <Image
                  source={{ uri: otherAvatarUrl }}
                  style={styles.headerAvatarImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ) : (
                <Text style={styles.headerAvatarText}>{initial}</Text>
              )}
            </View>
          </View>
          <Text style={styles.headerUsername}>{displayName}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={showChatMenu} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSideRight}>
          <Ionicons name="ellipsis-horizontal" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + HEADER_HEIGHT : 0}>
        {messagesLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : (
        <FlatList
          ref={listRef}
          data={chatItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          inverted
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        />
        )}

        <SafeAreaView edges={['bottom']} style={styles.inputArea}>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.gemShareButton}
              onPress={openGemPicker}
              activeOpacity={0.8}
              accessibilityLabel="Share a gem">
              <Text style={styles.gemShareEmoji}>📍</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor={theme.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
              onPress={handleSend}
              activeOpacity={0.8}
              disabled={!canSend}>
              <Ionicons name="send" size={18} color={canSend ? theme.background : theme.textTertiary} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {myId && userId && (
        <ReportSheet
          visible={reportVisible}
          onClose={() => setReportVisible(false)}
          targetType="user"
          targetId={userId}
          reporterId={myId}
        />
      )}

      <Modal
        visible={gemPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGemPickerVisible(false)}>
        <Pressable style={styles.gemPickerOverlay} onPress={() => setGemPickerVisible(false)}>
          <Pressable style={styles.gemPickerSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.gemPickerHandle} />
            <Text style={styles.gemPickerTitle}>Share a gem</Text>
            <Text style={styles.gemPickerSubtitle}>Pick one of your gems to send coordinates</Text>

            {gemsLoading ? (
              <ActivityIndicator size="small" color={theme.accent} style={styles.gemPickerLoader} />
            ) : myGems.length === 0 ? (
              <Text style={styles.gemPickerEmpty}>You haven&apos;t added any gems yet.</Text>
            ) : (
              <FlatList
                data={myGems}
                keyExtractor={(item) => item.id}
                style={styles.gemPickerList}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.gemPickerRow}
                    onPress={() => handleShareGem(item)}
                    activeOpacity={0.7}>
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={styles.gemPickerThumb}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={[styles.gemPickerThumb, styles.gemPickerThumbPlaceholder]}>
                        <Ionicons name="diamond-outline" size={18} color={theme.textTertiary} />
                      </View>
                    )}
                    <View style={styles.gemPickerMeta}>
                      <Text style={styles.gemPickerName} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.gemPickerCoords} numberOfLines={1}>
                        {formatCoordinates(item.latitude, item.longitude)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              style={styles.gemPickerCancel}
              onPress={() => setGemPickerVisible(false)}
              activeOpacity={0.7}>
              <Text style={styles.gemPickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    flex: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    headerSide: {
      width: 40,
    },
    headerSideRight: {
      width: 40,
      alignItems: 'flex-end',
    },
    headerCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    headerAvatarRing: {
      borderRadius: 22.5,
      borderWidth: 3.5,
      borderColor: theme.coral,
      padding: 2,
      backgroundColor: theme.background,
    },
    headerAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    headerAvatarImage: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    headerAvatarText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.accentText,
    },
    headerUsername: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    messagesList: {
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    messageRow: {
      marginBottom: 12,
    },
    messageRowMine: {
      alignItems: 'flex-end',
    },
    messageRowTheirs: {
      alignItems: 'flex-start',
    },
    messageBlock: {
      maxWidth: BUBBLE_MAX_WIDTH,
    },
    bubble: {
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleMine: {
      backgroundColor: theme.accent,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomRightRadius: 4,
      borderBottomLeftRadius: 18,
    },
    bubbleTheirs: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 18,
    },
    bubbleText: {
      fontSize: 15,
      lineHeight: 20,
      flexShrink: 1,
    },
    bubbleTextMine: {
      color: theme.background,
    },
    bubbleTextTheirs: {
      color: theme.text,
    },
    coordText: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 13,
      lineHeight: 20,
      letterSpacing: 0.3,
    },
    coordTextMine: {
      color: theme.accentText,
    },
    coordTextTheirs: {
      color: theme.accent,
    },
    coordTextSpaced: {
      marginTop: 4,
    },
    timestamp: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      color: theme.textTertiary,
      marginTop: 3,
    },
    timestampMine: {
      textAlign: 'right',
    },
    dateSeparatorWrap: {
      alignItems: 'center',
      marginVertical: 12,
    },
    dateSeparator: {
      backgroundColor: theme.card,
      borderRadius: 10,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    dateSeparatorText: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      letterSpacing: 1,
      color: theme.textTertiary,
    },
    inputArea: {
      backgroundColor: theme.background,
      borderTopWidth: 0.5,
      borderTopColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    gemShareButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.bgTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gemShareEmoji: {
      fontSize: 17,
    },
    input: {
      flex: 1,
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.text,
      maxHeight: 100,
    },
    sendButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: theme.border,
    },
    gemPickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    gemPickerSheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: 24,
      maxHeight: '70%',
    },
    gemPickerHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 16,
    },
    gemPickerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
    },
    gemPickerSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 16,
    },
    gemPickerLoader: {
      marginVertical: 24,
    },
    gemPickerEmpty: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      marginVertical: 24,
    },
    gemPickerList: {
      maxHeight: 320,
    },
    gemPickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.border,
    },
    gemPickerThumb: {
      width: 44,
      height: 44,
      borderRadius: 10,
    },
    gemPickerThumbPlaceholder: {
      backgroundColor: theme.bgTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gemPickerMeta: {
      flex: 1,
      gap: 2,
    },
    gemPickerName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    gemPickerCoords: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 11,
      color: theme.textTertiary,
    },
    gemPickerCancel: {
      marginTop: 16,
      paddingVertical: 14,
      alignItems: 'center',
    },
    gemPickerCancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textSecondary,
    },
  });
