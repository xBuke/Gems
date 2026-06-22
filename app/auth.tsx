import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { SegmentedPill } from '@/components/SegmentedPill';
import { supabase } from '@/lib/supabase';

type AuthMode = 'login' | 'register';

function CompassLogo({ accent, coral }: { accent: string; coral: string }) {
  return (
    <View style={{ alignItems: 'center', marginBottom: 28 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          borderWidth: 2,
          borderColor: accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View
          style={{
            position: 'absolute',
            width: 2,
            height: 26,
            backgroundColor: coral,
            borderRadius: 1,
            transform: [{ rotate: '-45deg' }],
          }}
        />
        <Text
          style={{
            position: 'absolute',
            top: 10,
            fontSize: 9,
            fontFamily: 'SpaceMono-Bold',
            color: coral,
          }}>
          N
        </Text>
      </View>
    </View>
  );
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

export default function AuthScreen() {
  const router = useRouter();
  const { redirectTo } = useLocalSearchParams();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
  };

  const handleLogin = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email')
      return
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }
    if (!password) {
      setError('Please enter your password')
      return
    }

    setLoading(true);

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      setLoading(false);
      hapticError();
      setError(loginError.message);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_banned')
        .eq('id', data.user.id)
        .single();

      if (profile?.is_banned) {
        await supabase.auth.signOut();
        setLoading(false);
        hapticError();
        setError('This account has been suspended.');
        return;
      }
    }

    setLoading(false);
    hapticSuccess();
    router.replace(redirectTo ? String(redirectTo) : '/');
  };

  const handleRegister = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email')
      return
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (!username.trim()) {
      setError('Please choose a username')
      return
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    if (username.trim().length > 20) {
      setError('Username must be 20 characters or less')
      return
    }
    const usernameRegex = /^[a-zA-Z0-9_]+$/
    if (!usernameRegex.test(username.trim())) {
      setError('Username can only contain letters, numbers, and underscores')
      return
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      setLoading(false);
      hapticError();
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        username: username.trim(),
      });

      if (profileError) {
        setLoading(false);
        hapticError();
        setError(profileError.message);
        return;
      }
    }

    setLoading(false);
    hapticSuccess();
    router.replace(redirectTo ? String(redirectTo) : '/');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <CompassLogo accent={theme.accent} coral={theme.coral} />
            <Text style={styles.title}>Hidden Gems</Text>
            <Text style={styles.subtitle}>DISCOVER SECRET PLACES NEAR YOU</Text>

            <SegmentedPill
              tabs={[
                { key: 'login', label: 'Login' },
                { key: 'register', label: 'Register' },
              ]}
              activeKey={mode}
              onChange={(key) => switchMode(key as AuthMode)}
              theme={theme}
            />

            {mode === 'register' && (
              <>
                <Text style={styles.fieldLabel}>USERNAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor={theme.textSecondary}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}

            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={mode === 'login' ? handleLogin : handleRegister}
              disabled={loading}
              activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color={theme.background} />
              ) : (
                <Text style={styles.buttonText}>{mode === 'login' ? 'Login' : 'Register'}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 32,
    },
    title: {
      fontSize: 30,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.text,
    },
    subtitle: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      letterSpacing: 1.5,
      color: theme.textSecondary,
      marginTop: 6,
      marginBottom: 32,
      textTransform: 'uppercase',
    },
    fieldLabel: {
      fontFamily: 'SpaceMono-Regular',
      fontSize: 10,
      letterSpacing: 1.5,
      color: theme.textTertiary,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    tabRow: {
      flexDirection: 'row',
      alignSelf: 'center',
      width: 226,
      backgroundColor: theme.card,
      borderRadius: 24,
      borderWidth: 0.5,
      borderColor: theme.border,
      padding: 3,
      marginBottom: 24,
    },
    tab: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabActive: {
      backgroundColor: theme.accent,
    },
    tabInactive: {
      backgroundColor: 'transparent',
    },
    tabText: {
      fontSize: 13,
      fontFamily: 'SpaceGrotesk-Bold',
      color: theme.textSecondary,
      textAlign: 'center',
    },
    tabTextActive: {
      color: theme.accentText,
      fontFamily: 'SpaceGrotesk-Bold',
    },
    input: {
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 14,
      color: theme.text,
      marginBottom: 12,
    },
    errorText: {
      color: theme.danger,
      fontSize: 14,
      marginBottom: 16,
    },
    button: {
      backgroundColor: theme.accent,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: '600',
    },
  });
