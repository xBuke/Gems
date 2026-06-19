import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Linking,
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
      {value ? <Text style={[styles.settingValue, { color: theme.textTertiary }]}>{value}</Text> : null}
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

function SectionHeader({ title, theme }: { title: string; theme: Theme }) {
  return <Text style={[styles.sectionHeader, { color: theme.textTertiary }]}>{title}</Text>;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, isDark, toggleTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [homeTown, setHomeTown] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [language, setLanguage] = useState('en');
  const [userId, setUserId] = useState<string | null>(null);
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptMode, setPromptMode] = useState<'username' | 'password' | null>(null);
  const [promptValue, setPromptValue] = useState('');

  const languageLabel = language === 'hr' ? 'Hrvatski' : 'English';

  const loadSettings = useCallback(async () => {
    const storedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

    if (storedLanguage) setLanguage(storedLanguage);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, home_town, is_private, language')
      .eq('id', user.id)
      .single();

    if (profile) {
      setUsername(profile.username ?? '');
      setHomeTown(profile.home_town ?? '');
      setIsPrivate(profile.is_private ?? false);
      if (profile.language) {
        setLanguage(profile.language);
        await AsyncStorage.setItem(LANGUAGE_KEY, profile.language);
      }
    }
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
      'This cannot be undone. Are you sure you want to delete your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => console.log('Delete account requested'),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
            onPress={() => Linking.openURL('https://apps.apple.com/app/id0000000000')}
            theme={theme}
          />
          <SettingItem
            icon="document-outline"
            label="Privacy Policy"
            showChevron
            onPress={() => console.log('Privacy Policy')}
            theme={theme}
          />
          <SettingItem
            icon="document-text-outline"
            label="Terms of Service"
            showChevron
            onPress={() => console.log('Terms of Service')}
            theme={theme}
          />
        </View>

        <SectionHeader title="Danger Zone" theme={theme} />
        <View style={styles.sectionGroup}>
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
      </ScrollView>

      <Modal visible={promptVisible} transparent animationType="fade">
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
  sectionHeader: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingBottom: 8,
    marginTop: 8,
  },
  sectionGroup: {
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
    fontSize: 14,
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
