import AsyncStorage from '@react-native-async-storage/async-storage';

import { Session, ThemeMode } from '@/lib/munch-data';

const SESSION_KEY = 'munch.session.v1';
const THEME_KEY = 'munch.theme.v1';

export async function loadSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Session;
  } catch {
    await AsyncStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export async function saveSession(session: Session) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function loadThemePreference(): Promise<ThemeMode> {
  const raw = await AsyncStorage.getItem(THEME_KEY);
  return raw === 'dark' ? 'dark' : 'light';
}

export async function saveThemePreference(mode: ThemeMode) {
  await AsyncStorage.setItem(THEME_KEY, mode);
}
