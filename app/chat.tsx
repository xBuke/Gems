import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH * 0.75;

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

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateLabel = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
  const { userId, username } = useLocalSearchParams<{ userId: string; username: string }>();
  const [myId, setMyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const chatItems = useMemo(() => buildChatItems(messages), [messages]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !userId) return;

    setMyId(user.id);

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

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !myId || !userId || sending) return;

    setSending(true);
    setInputText('');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: myId,
        receiver_id: userId,
        content: text,
      })
      .select('*, sender:profiles!messages_sender_id_fkey(username)')
      .single();

    setSending(false);

    if (!error && data) {
      setMessages((prev) => [...prev, data as Message]);

      await supabase.from('notifications').insert({
        user_id: userId,
        sender_id: myId,
        type: 'message',
        gem_id: null,
        read: false,
      });
    }
  };

  const goToProfile = () => {
    router.push('/profile?userId=' + userId);
  };

  const displayName = typeof username === 'string' ? username : 'User';
  const initial = displayName.charAt(0).toUpperCase();
  const canSend = inputText.trim().length > 0 && !sending;

  const renderMessage = (item: Message) => {
    const isMine = item.sender_id === myId;

    return (
      <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowTheirs]}>
        <View style={styles.messageBlock}>
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
            <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
              {item.content}
            </Text>
          </View>
          <Text style={[styles.timestamp, isMine && styles.timestampMine]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: ChatItem }) => {
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
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color="#F5F5F5" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerCenter} onPress={goToProfile} activeOpacity={0.7}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{initial}</Text>
          </View>
          <Text style={styles.headerUsername}>{displayName}</Text>
        </TouchableOpacity>
        <View style={styles.headerSideRight}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#888888" />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
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

        <SafeAreaView edges={['bottom']} style={styles.inputArea}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor="#444444"
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
              <Ionicons name="send" size={18} color={canSend ? '#0D0D0D' : '#555555'} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
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
    borderBottomColor: '#222222',
    backgroundColor: '#0D0D0D',
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
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
    backgroundColor: '#1D9E75',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 18,
  },
  bubbleTheirs: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: '#0D0D0D',
  },
  bubbleTextTheirs: {
    color: '#F5F5F5',
  },
  timestamp: {
    fontSize: 11,
    color: '#555555',
    marginTop: 4,
  },
  timestampMine: {
    textAlign: 'right',
  },
  dateSeparatorWrap: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateSeparator: {
    backgroundColor: '#141414',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#555555',
  },
  inputArea: {
    backgroundColor: '#0D0D0D',
    borderTopWidth: 0.5,
    borderTopColor: '#222222',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#141414',
    borderWidth: 0.5,
    borderColor: '#222222',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#F5F5F5',
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#333333',
  },
});
