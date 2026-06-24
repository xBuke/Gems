import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export const INSTALL_DATE_KEY = 'app_install_date';
export const LAST_RATING_PROMPT_KEY = 'last_rating_prompt_shown';

const MIN_GEMS_FOR_PROMPT = 5;
const MIN_DAYS_SINCE_INSTALL = 3;
const PROMPT_COOLDOWN_MONTHS = 6;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MONTH = 30 * MS_PER_DAY;

export async function ensureInstallDateRecorded(): Promise<void> {
  const existing = await AsyncStorage.getItem(INSTALL_DATE_KEY);
  if (existing) return;
  await AsyncStorage.setItem(INSTALL_DATE_KEY, new Date().toISOString());
}

export async function getUserCreatedGemCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('gems')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return count ?? 0;
}

export async function shouldShowRatingPrompt(userId: string): Promise<boolean> {
  const gemCount = await getUserCreatedGemCount(userId);
  if (gemCount < MIN_GEMS_FOR_PROMPT) return false;

  const installDateRaw = await AsyncStorage.getItem(INSTALL_DATE_KEY);
  if (!installDateRaw) return false;

  const installDate = new Date(installDateRaw);
  if (Number.isNaN(installDate.getTime())) return false;

  const daysSinceInstall = (Date.now() - installDate.getTime()) / MS_PER_DAY;
  if (daysSinceInstall < MIN_DAYS_SINCE_INSTALL) return false;

  const lastPromptRaw = await AsyncStorage.getItem(LAST_RATING_PROMPT_KEY);
  if (lastPromptRaw) {
    const lastPrompt = new Date(lastPromptRaw);
    if (!Number.isNaN(lastPrompt.getTime())) {
      const monthsSinceLastPrompt = (Date.now() - lastPrompt.getTime()) / MS_PER_MONTH;
      if (monthsSinceLastPrompt < PROMPT_COOLDOWN_MONTHS) return false;
    }
  }

  return true;
}

export async function recordRatingPromptShown(): Promise<void> {
  await AsyncStorage.setItem(LAST_RATING_PROMPT_KEY, new Date().toISOString());
}
