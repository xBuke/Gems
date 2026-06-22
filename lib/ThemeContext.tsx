import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, Theme } from './theme';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme,
  isDark: true,
  mode: 'system',
  toggleTheme: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = 'theme';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'light' || val === 'dark' || val === 'system') {
        setMode(val);
      }
    });
  }, []);

  const isDark = useMemo(() => {
    if (mode === 'system') return systemScheme !== 'light';
    return mode === 'dark';
  }, [mode, systemScheme]);

  const theme = isDark ? darkTheme : lightTheme;

  const setTheme = useCallback(async (next: ThemeMode) => {
    setMode(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = isDark ? 'light' : 'dark';
    await setTheme(next);
  }, [isDark, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, mode, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
