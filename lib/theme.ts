export const semantic = {
  error: '#F87171',
  warning: '#FBBF24',
  success: '#22C55E',
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
} as const;

export const darkTheme = {
  background: '#0B1A1C',
  card: '#142B2E',
  bgTertiary: '#1C3438',
  border: '#1C3438',
  text: '#EAF6F4',
  textSecondary: '#7FA8A8',
  textTertiary: '#5C8484',
  accent: '#2DD4BF',
  accentSub: '#1C3438',
  accentText: '#0A1F1C',
  coral: '#FF9F5A',
  coralSubtle: 'rgba(255,159,90,0.15)',
  danger: '#FF4444',
  homeIndicator: 'rgba(234,246,244,0.2)',
};

export const lightTheme = {
  background: '#F7FAF9',
  card: '#FFFFFF',
  bgTertiary: '#E3F1EF',
  border: '#DCE8E6',
  text: '#0B1A1C',
  textSecondary: '#5B7472',
  textTertiary: '#8FA3A1',
  accent: '#0F9488',
  accentSub: '#E3F1EF',
  accentText: '#FFFFFF',
  coral: '#E8723D',
  coralSubtle: 'rgba(232,114,61,0.12)',
  danger: '#FF4444',
  homeIndicator: 'rgba(11,26,28,0.18)',
};

export type Theme = typeof darkTheme;
