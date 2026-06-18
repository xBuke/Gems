import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
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

const THEME_KEY = '@hiddengems_theme';
const LANGUAGE_KEY = '@hiddengems_language';

const DARK = {
  bg: '#0D0D0D',
  card: '#141414',
  text: '#FFFFFF',
  textLight: '#F5F5F5',
  textMuted: '#888888',
  textDim: '#555555',
  border: '#222222',
  chevron: '#333333',
  danger: '#FF4444',
};

const LIGHT = {
  bg: '#F5F5F5',
  card: '#FFFFFF',
  text: '#0D0D0D',
  textLight: '#0D0D0D',
  textMuted: '#666666',
  textDim: '#888888',
  border: '#E0E0E0',
  chevron: '#CCCCCC',
  danger: '#FF4444',
};

type SettingItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  showChevron?: boolean;
  danger?: boolean;
  onPress?: () => void;
  rightElement?: ReactNode;
  colors: typeof DARK;
};

function SettingItem({
  icon,
  label,
  value,
  showChevron,
  danger,
  onPress,
  rightElement,
  colors,
}: SettingItemProps) {
  const content = (
    <View style={[styles.settingItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <Ionicons
        name={icon}
        size={20}
        color={danger ? colors.danger : colors.textMuted}
      />
      <Text style={[styles.settingLabel, { color: danger ? colors.danger : colors.text }, { flex: 1 }]}>
        {label}
      </Text>
      {value ? <Text style={[styles.settingValue, { color: colors.textDim }]}>{value}</Text> : null}
      {rightElement}
      {showChevron ? <Ionicons name="chevron-forward" size={16} color={colors.chevron} /> : null}
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

function SectionHeader({ title, colors }: { title: string; colors: typeof DARK }) {
  return <Text style={[styles.sectionHeader, { color: colors.textDim }]}>{title}</Text>;
}

export default function SettingsScreen() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(true);
  const [username, setUsername] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [language, setLanguage] = useState('en');
  const [userId, setUserId] = useState<string | null>(null);
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptMode, setPromptMode] = useState<'username' | 'password' | null>(null);
  const [promptValue, setPromptValue] = useState('');

  const colors = isDark ? DARK : LIGHT;
  const languageLabel = language === 'hr' ? 'Hrvatski' : 'English';

  const loadSettings = useCallback(async () => {
    const storedTheme = await AsyncStorage.getItem(THEME_KEY);
    const storedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

    if (storedTheme === 'light') setIsDark(false);
    if (storedLanguage) setLanguage(storedLanguage);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, is_private, language')
      .eq('id', user.id)
      .single();

    if (profile) {
      setUsername(profile.username ?? '');
      setIsPrivate(profile.is_private ?? false);
      if (profile.language) {
        setLanguage(profile.language);
        await AsyncStorage.setItem(LANGUAGE_KEY, profile.language);
      }
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleThemeToggle = async (value: boolean) => {
    setIsDark(value);
    await AsyncStorage.setItem(THEME_KEY, value ? 'dark' : 'light');
  };

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={colors.textLight} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <SectionHeader title="Account" colors={colors} />
        <View style={styles.sectionGroup}>
          <SettingItem
            icon="person-outline"
            label="Username"
            value={username}
            showChevron
            onPress={showUsernamePrompt}
            colors={colors}
          />
          <SettingItem
            icon="lock-closed-outline"
            label="Change Password"
            showChevron
            onPress={showPasswordPrompt}
            colors={colors}
          />
        </View>

        <SectionHeader title="Privacy" colors={colors} />
        <View style={styles.sectionGroup}>
          <SettingItem
            icon="eye-off-outline"
            label="Private Profile"
            colors={colors}
            rightElement={
              <Switch
                value={isPrivate}
                onValueChange={handlePrivateToggle}
                trackColor={{ false: colors.border, true: '#1D9E75' }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </View>

        <SectionHeader title="Appearance" colors={colors} />
        <View style={styles.sectionGroup}>
          <SettingItem
            icon="moon-outline"
            label="Dark Mode"
            colors={colors}
            rightElement={
              <Switch
                value={isDark}
                onValueChange={handleThemeToggle}
                trackColor={{ false: colors.border, true: '#1D9E75' }}
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
            colors={colors}
          />
        </View>

        <SectionHeader title="About" colors={colors} />
        <View style={styles.sectionGroup}>
          <SettingItem icon="information-circle-outline" label="Version" value="1.0.0" colors={colors} />
          <SettingItem
            icon="star-outline"
            label="Rate Hidden Gems"
            showChevron
            onPress={() => Linking.openURL('https://apps.apple.com/app/id0000000000')}
            colors={colors}
          />
          <SettingItem
            icon="document-outline"
            label="Privacy Policy"
            showChevron
            onPress={() => console.log('Privacy Policy')}
            colors={colors}
          />
          <SettingItem
            icon="document-text-outline"
            label="Terms of Service"
            showChevron
            onPress={() => console.log('Terms of Service')}
            colors={colors}
          />
        </View>

        <SectionHeader title="Danger Zone" colors={colors} />
        <View style={styles.sectionGroup}>
          <SettingItem
            icon="log-out-outline"
            label="Log Out"
            danger
            onPress={handleLogout}
            colors={colors}
          />
          <SettingItem
            icon="trash-outline"
            label="Delete Account"
            danger
            onPress={handleDeleteAccount}
            colors={colors}
          />
        </View>
      </ScrollView>

      <Modal visible={promptVisible} transparent animationType="fade">
        <View style={styles.promptOverlay}>
          <View style={[styles.promptBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.promptTitle, { color: colors.text }]}>
              {promptMode === 'password' ? 'Change Password' : 'Edit Username'}
            </Text>
            <Text style={[styles.promptMessage, { color: colors.textMuted }]}>
              {promptMode === 'password' ? 'Enter your new password' : 'Enter your new username'}
            </Text>
            <TextInput
              style={[
                styles.promptInput,
                { backgroundColor: colors.bg, borderColor: colors.border, color: colors.textLight },
              ]}
              value={promptValue}
              onChangeText={setPromptValue}
              secureTextEntry={promptMode === 'password'}
              autoFocus
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.promptButtons}>
              <TouchableOpacity
                style={[styles.promptCancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setPromptVisible(false);
                  setPromptMode(null);
                  setPromptValue('');
                }}
                activeOpacity={0.8}>
                <Text style={[styles.promptCancelText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.promptSubmitButton} onPress={handlePromptSubmit} activeOpacity={0.8}>
                <Text style={styles.promptSubmitText}>Save</Text>
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
    backgroundColor: '#1D9E75',
    alignItems: 'center',
  },
  promptSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D0D0D',
  },
});
