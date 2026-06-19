import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
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

import { supabase } from '@/lib/supabase';

type AuthMode = 'login' | 'register';

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
    setLoading(true);

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      setLoading(false);
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
        setError('This account has been suspended.');
        return;
      }
    }

    setLoading(false);
    router.replace(redirectTo ? String(redirectTo) : '/');
  };

  const handleRegister = async () => {
    setError('');
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      setLoading(false);
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
        setError(profileError.message);
        return;
      }
    }

    setLoading(false);
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
            <Text style={styles.title}>Hidden Gems</Text>
            <Text style={styles.subtitle}>Discover secret places near you</Text>

            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, mode === 'login' ? styles.tabActive : styles.tabInactive]}
                onPress={() => switchMode('login')}
                activeOpacity={0.7}>
                <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
                  Login
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, mode === 'register' ? styles.tabActive : styles.tabInactive]}
                onPress={() => switchMode('register')}
                activeOpacity={0.7}>
                <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>
                  Register
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'register' && (
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={theme.textSecondary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}

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
      fontSize: 24,
      fontWeight: '600',
      color: theme.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
      marginBottom: 32,
    },
    tabRow: {
      flexDirection: 'row',
      backgroundColor: theme.card,
      borderRadius: 10,
      padding: 4,
      marginBottom: 24,
    },
    tab: {
      flex: 1,
      padding: 10,
      borderRadius: 8,
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
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    tabTextActive: {
      color: theme.background,
      fontWeight: '600',
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
