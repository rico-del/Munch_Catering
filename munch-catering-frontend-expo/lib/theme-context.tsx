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
  surfaceMuted: '#F4F8F6',
  surfaceElevated: '#E7F0EC',
  text: palette.ink950,
  textMuted: palette.slate700,
  border: palette.border,
  headerBadge: '#E3EEE9',
  shell: 'rgba(247, 250, 248, 0.84)',
  shellBorder: 'rgba(216, 225, 222, 0.92)',
  field: '#F8FBFA',
  fieldBorder: 'rgba(111, 143, 132, 0.18)',
  ghost: 'rgba(251, 252, 250, 0.68)',
  overlay: 'rgba(7, 17, 18, 0.58)',
  inverseText: '#F8FBFA',
};

export const darkTheme: ThemeTokens = {
  mode: 'dark',
  page: '#071112',
  surface: '#101D20',
  surfaceMuted: '#15262A',
  surfaceElevated: '#1C3133',
  text: '#F5FAF7',
  textMuted: '#B7C6C3',
  border: '#294044',
  headerBadge: '#183034',
  shell: 'rgba(9, 19, 21, 0.9)',
  shellBorder: 'rgba(41, 64, 68, 0.96)',
  field: '#142528',
  fieldBorder: 'rgba(183, 207, 195, 0.22)',
  ghost: 'rgba(28, 49, 51, 0.72)',
  overlay: 'rgba(5, 11, 12, 0.7)',
  inverseText: '#F8FBFA',
};

export const ThemeContext = React.createContext<ThemeTokens>(lightTheme);

export function useThemeTokens() {
  return React.useContext(ThemeContext);
}
