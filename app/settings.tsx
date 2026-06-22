import { stopTracking } from '@/lib/locationTracker';
import { getExplorerLevelIndex } from '@/lib/gamification';
import { checkIsPremium } from '@/lib/paywall';
import { SUPABASE_URL, supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LANGUAGE_KEY = '@hiddengems_language';

type SettingItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  showChevron?: boolean;
  danger?: boolean;
  onPress?: () => void;
  rightElement?: ReactNode;
  theme: Theme;
};

function SettingItem({
  icon,
  label,
  value,
  showChevron,
  danger,
  onPress,
  rightElement,
  theme,
}: SettingItemProps) {
  const content = (
    <View style={[styles.settingItem, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
      <Ionicons
        name={icon}
        size={20}
        color={danger ? theme.danger : theme.textSecondary}
      />
      <Text style={[styles.settingLabel, { color: danger ? theme.danger : theme.text }, { flex: 1 }]}>
        {label}
      </Text>
      {value ? (
        <Text style={[styles.settingValue, { color: theme.textTertiary }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {rightElement}
      {showChevron ? <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} /> : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

function SectionHeader({ title, theme, danger }: { title: string; theme: Theme; danger?: boolean }) {
  return (
    <Text
      style={[
        styles.sectionHeader,
        { color: danger ? theme.danger : theme.textTertiary },
      ]}>
      {title}
    </Text>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, isDark, toggleTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [homeTown, setHomeTown] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [language, setLanguage] = useState('en');
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptMode, setPromptMode] = useState<'username' | 'password' | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [explorerLevelIndex, setExplorerLevelIndex] = useState(1);
  const [streakPoints, setStreakPoints] = useState(0);

  const languageLabel = language === 'hr' ? 'Hrvatski' : 'English';

  const loadSettings = useCallback(async () => {
    const storedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

    if (storedLanguage) setLanguage(storedLanguage);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSettingsLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, home_town, is_private, language, is_admin, streak_points')
      .eq('id', user.id)
      .single();

    const premium = await checkIsPremium();
    setIsPremium(premium);

    if (profile) {
      setUsername(profile.username ?? '');
      setHomeTown(profile.home_town ?? '');
      setIsPrivate(profile.is_private ?? false);
      setIsAdmin(profile.is_admin ?? false);
      const points = profile.streak_points ?? 0;
      setStreakPoints(points);
      setExplorerLevelIndex(getExplorerLevelIndex(points));
      if (profile.language) {
        setLanguage(profile.language);
        await AsyncStorage.setItem(LANGUAGE_KEY, profile.language);
      }
    }

    setSettingsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings]),
  );

  const handlePrivateToggle = async (value: boolean) => {
    if (!userId) return;

    setIsPrivate(value);
    const { error } = await supabase
      .from('profiles')
      .update({ is_private: value })
      .eq('id', userId);

    if (error) {
      setIsPrivate(!value);
      Alert.alert('Error', 'Could not update privacy setting');
    }
  };

  const handleUpdateUsername = async (newUsername: string) => {
    const trimmed = newUsername.trim();
    if (!trimmed || !userId) return;

    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('id', userId);

    if (error) {
      Alert.alert('Error', 'Could not update username');
      return;
    }

    setUsername(trimmed);
  };

  const handleChangePassword = async (newPassword: string) => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Success', 'Password updated');
  };

  const showUsernamePrompt = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Edit Username',
        'Enter your new username',
        async (value) => {
          if (value) await handleUpdateUsername(value);
        },
        'plain-text',
        username,
      );
      return;
    }

    setPromptValue(username);
    setPromptMode('username');
    setPromptVisible(true);
  };

  const showPasswordPrompt = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Change Password',
        'Enter your new password',
        async (value) => {
          if (value) await handleChangePassword(value);
        },
        'secure-text',
      );
      return;
    }

    setPromptValue('');
    setPromptMode('password');
    setPromptVisible(true);
  };

  const handlePromptSubmit = async () => {
    const value = promptValue;
    const mode = promptMode;
    setPromptVisible(false);
    setPromptMode(null);
    setPromptValue('');

    if (mode === 'username') {
      await handleUpdateUsername(value);
    } else if (mode === 'password') {
      await handleChangePassword(value);
    }
  };

  const setLanguagePreference = async (code: 'en' | 'hr') => {
    setLanguage(code);
    await AsyncStorage.setItem(LANGUAGE_KEY, code);

    if (userId) {
      await supabase.from('profiles').update({ language: code }).eq('id', userId);
    }
  };

  const showLanguagePicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'English', 'Hrvatski'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) setLanguagePreference('en');
          if (buttonIndex === 2) setLanguagePreference('hr');
        },
      );
      return;
    }

    Alert.alert('Language', 'Choose a language', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'English', onPress: () => setLanguagePreference('en') },
      { text: 'Hrvatski', onPress: () => setLanguagePreference('hr') },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, all your gems, comments, messages, and data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const userId = user.id;

            const { data: ownedCommunities } = await supabase
              .from('communities')
              .select('id')
              .eq('creator_id', userId);

            if (ownedCommunities?.length) {
              for (const community of ownedCommunities) {
                await supabase.from('community_messages').delete().eq('community_id', community.id);
                await supabase.from('community_members').delete().eq('community_id', community.id);
                await supabase.from('communities').delete().eq('id', community.id);
              }
            }

            await Promise.all([
              supabase.from('saved_gems').delete().eq('user_id', userId),
              supabase.from('gem_likes').delete().eq('user_id', userId),
              supabase.from('gem_visits').delete().eq('user_id', userId),
              supabase.from('comment_likes').delete().eq('user_id', userId),
              supabase.from('comments').delete().eq('user_id', userId),
              supabase.from('notifications').delete().or(`user_id.eq.${userId},sender_id.eq.${userId}`),
              supabase.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
              supabase.from('follows').delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`),
              supabase.from('blocked_users').delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
              supabase.from('community_members').delete().eq('user_id', userId),
              supabase.from('community_messages').delete().eq('user_id', userId),
              supabase.from('custom_categories').delete().eq('creator_id', userId),
              supabase.from('user_locations').delete().eq('user_id', userId),
              supabase.from('reports').delete().eq('reporter_id', userId),
            ]);

            await supabase.from('gems').delete().eq('user_id', userId);

            const { error } = await supabase.from('profiles').delete().eq('id', userId);

            if (error) {
              Alert.alert('Error', 'Could not delete your account. Please try again or contact support.');
              return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (!response.ok) {
                console.log('Auth user deletion failed, but app data was removed');
              }
            }

            stopTracking();
            await AsyncStorage.removeItem(LANGUAGE_KEY);
            await supabase.auth.signOut();
            router.replace('/auth');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
        <View style={styles.headerSide} />
      </View>

      {settingsLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View
          style={[
            styles.premiumBanner,
            {
              backgroundColor: isPremium ? theme.accentSub : theme.card,
              borderColor: isPremium ? theme.accent : theme.coral,
            },
          ]}>
          <View style={styles.premiumBannerLeft}>
            <View>
              {isPremium ? (
                <>
                  <Text style={[styles.premiumBannerLevel, { color: theme.textSecondary }]}>
                    EXPLORER LV. {explorerLevelIndex}
                  </Text>
                  <Text style={[styles.premiumBannerTitle, { color: theme.text }]}>
                    Premium Active
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.premiumBannerTitle, { color: theme.text }]}>
                    Upgrade to Premium
                  </Text>
                  <Text style={[styles.premiumBannerSubtitle, { color: theme.textSecondary }]}>
                    Unlock swipe, communities, trip planner & more
                  </Text>
                </>
              )}
            </View>
          </View>
          {isPremium ? (
            <TouchableOpacity
              style={[styles.manageButton, { backgroundColor: theme.accent }]}
              onPress={() => router.push('/paywall')}
              activeOpacity={0.8}>
              <Text style={[styles.manageButtonText, { color: theme.accentText }]}>Manage</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.push('/paywall')} activeOpacity={0.8}>
              <Ionicons name="chevron-forward" size={16} color={theme.coral} />
            </TouchableOpacity>
          )}
        </View>

        <SectionHeader title="Account" theme={theme} />
        <View style={styles.sectionGroup}>
          <SettingItem
            icon="person-outline"
            label="Username"
            value={username}
            showChevron
            onPress={showUsernamePrompt}
            theme={theme}
          />
          <SettingItem
            icon="home-outline"
            label="Home Town"
            value={homeTown || 'Not set'}
            showChevron
            onPress={() => router.push('/edit-hometown')}
            theme={theme}
          />
          <SettingItem
            icon="lock-closed-outline"
            label="Change Password"
            showChevron
            onPress={showPasswordPrompt}
            theme={theme}
          />
        </View>

        <SectionHeader title="Privacy" theme={theme} />
        <View style={styles.sectionGroup}>
          <SettingItem
            icon="eye-off-outline"
            label="Private Profile"
            theme={theme}
            rightElement={
              <Switch
                value={isPrivate}
                onValueChange={handlePrivateToggle}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingItem
            icon="ban-outline"
            label="Blocked Users"
            showChevron
            onPress={() => router.push('/blocked-users')}
            theme={theme}
          />
        </View>

        <SectionHeader title="Appearance" theme={theme} />
        <View style={styles.sectionGroup}>
          <SettingItem
            icon="moon-outline"
            label="Dark Mode"
            theme={theme}
            rightElement={
              <Switch
                value={isDark}
                onValueChange={(value) => {
                  if (value !== isDark) toggleTheme();
                }}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingItem
            icon="language-outline"
            label="Language"
            value={languageLabel}
            showChevron
            onPress={showLanguagePicker}
            theme={theme}
          />
        </View>

        <SectionHeader title="About" theme={theme} />
        <View style={styles.sectionGroup}>
          <SettingItem icon="information-circle-outline" label="Version" value="1.0.0" theme={theme} />
          <SettingItem
            icon="star-outline"
            label="Rate Hidden Gems"
            showChevron
            onPress={() => {
              // TODO: Replace with real App Store/Play Store URL once published
              Alert.alert(
                'Coming soon!',
                "We'll let you know once we're live on the App Store.",
              );
            }}
            theme={theme}
          />
          <SettingItem
            icon="document-outline"
            label="Privacy Policy"
            showChevron
            onPress={() => router.push({ pathname: '/legal-document', params: { type: 'privacy' } })}
            theme={theme}
          />
          <SettingItem
            icon="document-text-outline"
            label="Terms of Service"
            showChevron
            onPress={() => router.push({ pathname: '/legal-document', params: { type: 'terms' } })}
            theme={theme}
          />
        </View>

        <SectionHeader title="Danger Zone" theme={theme} danger />
        <View style={[styles.sectionGroup, styles.dangerSection]}>
          <SettingItem
            icon="log-out-outline"
            label="Log Out"
            danger
            onPress={handleLogout}
            theme={theme}
          />
          <SettingItem
            icon="trash-outline"
            label="Delete Account"
            danger
            onPress={handleDeleteAccount}
            theme={theme}
          />
        </View>

        {isAdmin ? (
          <>
            <SectionHeader title="Admin" theme={theme} />
            <View style={styles.sectionGroup}>
              <TouchableOpacity onPress={() => router.push('/admin')} activeOpacity={0.7}>
                <View style={[styles.settingItem, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={theme.accent} />
                  <Text style={[styles.settingLabel, { color: theme.text, flex: 1 }]}>
                    Admin Dashboard
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                </View>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </ScrollView>
      )}

      <Modal visible={promptVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'center' }}>
        <View style={styles.promptOverlay}>
          <View style={[styles.promptBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.promptTitle, { color: theme.text }]}>
              {promptMode === 'password' ? 'Change Password' : 'Edit Username'}
            </Text>
            <Text style={[styles.promptMessage, { color: theme.textSecondary }]}>
              {promptMode === 'password'
                ? 'Enter your new password'
                : 'Enter your new username'}
            </Text>
            <TextInput
              style={[
                styles.promptInput,
                { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
              ]}
              value={promptValue}
              onChangeText={setPromptValue}
              secureTextEntry={promptMode === 'password'}
              maxLength={promptMode === 'username' ? 20 : undefined}
              autoFocus
              placeholderTextColor={theme.textSecondary}
            />
            <View style={styles.promptButtons}>
              <TouchableOpacity
                style={[styles.promptCancelButton, { borderColor: theme.border }]}
                onPress={() => {
                  setPromptVisible(false);
                  setPromptMode(null);
                  setPromptValue('');
                }}
                activeOpacity={0.8}>
                <Text style={[styles.promptCancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.promptSubmitButton, { backgroundColor: theme.accent }]} onPress={handlePromptSubmit} activeOpacity={0.8}>
                <Text style={[styles.promptSubmitText, { color: theme.background }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSide: {
    width: 22,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  premiumBannerLeft: {
    flex: 1,
  },
  premiumBannerLevel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  premiumBannerTitle: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 14,
  },
  premiumBannerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  manageButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  manageButtonText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 12,
  },
  sectionHeader: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 5,
  },
  sectionGroup: {
    overflow: 'hidden',
  },
  dangerSection: {
    backgroundColor: 'rgba(255, 68, 68, 0.06)',
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 0.5,
  },
  settingLabel: {
    fontSize: 15,
  },
  settingValue: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    maxWidth: 140,
  },
  promptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  promptBox: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 20,
  },
  promptTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  promptMessage: {
    fontSize: 13,
    marginBottom: 12,
  },
  promptInput: {
    borderWidth: 0.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
  },
  promptButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  promptCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 0.5,
    alignItems: 'center',
  },
  promptCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  promptSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  promptSubmitText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
