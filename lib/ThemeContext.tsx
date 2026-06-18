import React, { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { darkTheme, lightTheme, Theme } from './theme'

type ThemeContextType = {
  theme: Theme
  isDark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme,
  isDark: true,
  toggleTheme: () => {},
})

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem('theme').then(val => {
      if (val === 'light') setIsDark(false)
    })
  }, [])

  const toggleTheme = async () => {
    const newVal = !isDark
    setIsDark(newVal)
    await AsyncStorage.setItem('theme', newVal ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme: isDark ? darkTheme : lightTheme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
