import React from 'react';

import { palette } from '@/lib/munch-data';

export type ThemeTokens = {
  mode: 'light' | 'dark';
  page: string;
  surface: string;
  surfaceMuted: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  border: string;
  headerBadge: string;
  shell: string;
  shellBorder: string;
  field: string;
  fieldBorder: string;
  ghost: string;
  overlay: string;
  inverseText: string;
};

export const lightTheme: ThemeTokens = {
  mode: 'light',
  page: palette.cloud100,
  surface: palette.white,
  surfaceMuted: '#FFF8F2',
  surfaceElevated: '#F6EBDD',
  text: palette.ink950,
  textMuted: palette.slate700,
  border: palette.border,
  headerBadge: '#F7E2D4',
  shell: 'rgba(255, 248, 242, 0.9)',
  shellBorder: 'rgba(230, 212, 193, 0.88)',
  field: '#FFF9F3',
  fieldBorder: 'rgba(201, 109, 67, 0.14)',
  ghost: 'rgba(255, 252, 248, 0.55)',
  overlay: 'rgba(24, 32, 25, 0.56)',
  inverseText: '#FFF8F2',
};

export const darkTheme: ThemeTokens = {
  mode: 'dark',
  page: '#111613',
  surface: '#1A221B',
  surfaceMuted: '#202821',
  surfaceElevated: '#242E26',
  text: '#F5EEE5',
  textMuted: '#C3B7A9',
  border: '#344134',
  headerBadge: '#2B352B',
  shell: 'rgba(24, 32, 25, 0.92)',
  shellBorder: 'rgba(52, 65, 52, 0.96)',
  field: '#202821',
  fieldBorder: 'rgba(201, 109, 67, 0.28)',
  ghost: 'rgba(36, 46, 38, 0.8)',
  overlay: 'rgba(14, 18, 15, 0.66)',
  inverseText: '#FFF8F2',
};

export const ThemeContext = React.createContext<ThemeTokens>(lightTheme);

export function useThemeTokens() {
  return React.useContext(ThemeContext);
}
