import {
  ensureNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/pushNotifications';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PrefKey = keyof Omit<NotificationPreferences, 'user_id'>;

type ToggleRowProps = {
  label: string;
  sublabel: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  theme: Theme;
};

function SectionHeader({ title, theme }: { title: string; theme: Theme }) {
  return (
    <View style={[styles.sectionHeaderStrip, { backgroundColor: theme.bgTertiary }]}>
      <Text style={[styles.sectionHeaderText, { color: theme.textTertiary }]}>{title}</Text>
    </View>
  );
}

function ToggleRow({ label, sublabel, value, onValueChange, theme }: ToggleRowProps) {
  return (
    <View style={[styles.toggleRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
      <View style={styles.toggleRowText}>
        <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.toggleSublabel, { color: theme.textTertiary }]}>{sublabel}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const [preferences, profileResult] = await Promise.all([
      ensureNotificationPreferences(user.id),
      supabase.from('profiles').select('is_private').eq('id', user.id).single(),
    ]);

    setPrefs(preferences);
    setIsPrivate(profileResult.data?.is_private ?? false);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadSettings();
    }, [loadSettings]),
  );

  const updatePref = useCallback(
    async (key: PrefKey, value: boolean) => {
      if (!userId || !prefs) return;

      const previous = prefs[key];
      setPrefs({ ...prefs, [key]: value });

      const { error } = await supabase
        .from('notification_preferences')
        .update({ [key]: value })
        .eq('user_id', userId);

      if (error) {
        setPrefs({ ...prefs, [key]: previous });
        Alert.alert('Error', 'Could not update notification preference');
      }
    },
    [userId, prefs],
  );

  const handlePrivateToggle = useCallback(
    async (value: boolean) => {
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
    },
    [userId],
  );

  const prefValue = useMemo(
    () => (key: PrefKey) => prefs?.[key] ?? true,
    [prefs],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
        <View style={styles.headerSide} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <SectionHeader title="ACTIVITY" theme={theme} />
          <ToggleRow
            label="New followers"
            sublabel="Push + in-app"
            value={prefValue('new_followers_enabled')}
            onValueChange={(value) => updatePref('new_followers_enabled', value)}
            theme={theme}
          />
          <ToggleRow
            label="Gem likes"
            sublabel="In-app only"
            value={prefValue('gem_likes_enabled')}
            onValueChange={(value) => updatePref('gem_likes_enabled', value)}
            theme={theme}
          />
          <ToggleRow
            label="Comments on my gems"
            sublabel="Push + in-app"
            value={prefValue('gem_comments_enabled')}
            onValueChange={(value) => updatePref('gem_comments_enabled', value)}
            theme={theme}
          />

          <SectionHeader title="NEARBY" theme={theme} />
          <ToggleRow
            label="New gems near you"
            sublabel="Push only"
            value={prefValue('nearby_gems_enabled')}
            onValueChange={(value) => updatePref('nearby_gems_enabled', value)}
            theme={theme}
          />
          <ToggleRow
            label="Community activity"
            sublabel="Push + in-app"
            value={prefValue('community_activity_enabled')}
            onValueChange={(value) => updatePref('community_activity_enabled', value)}
            theme={theme}
          />

          <SectionHeader title="PRIVACY" theme={theme} />
          <ToggleRow
            label="Private account"
            sublabel="Approve all followers"
            value={isPrivate}
            onValueChange={handlePrivateToggle}
            theme={theme}
          />
        </ScrollView>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  sectionHeaderStrip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 2,
  },
  sectionHeaderText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 0.5,
  },
  toggleRowText: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 14,
  },
  toggleSublabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    marginTop: 2,
  },
});
