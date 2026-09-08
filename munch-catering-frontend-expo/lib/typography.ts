// Shared typography for Munch Catering.
// Headings use an opulent editorial serif stack for a prestigious, Michelin-grade,
// fine-dining catering aesthetic. Body and UI text use a high-precision, readable sans-serif stack.
// The stacks are tailored for both web and native platforms.

import { Platform } from 'react-native';

export const fonts = {
  heading: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    web: "'Playfair Display', 'Cormorant Garamond', 'Baskerville', Georgia, 'Times New Roman', serif",
    default: 'Georgia',
  }),
  body: Platform.select({
    ios: '-apple-system, "SF Pro Text", "Helvetica Neue", Arial',
    android: 'sans-serif',
    web: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    default: 'System',
  }),
  display: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    web: "'Playfair Display', 'Didot', 'Bodoni MT', 'Cinzel', Georgia, serif",
    default: 'Georgia',
  }),
  accent: Platform.select({
    ios: 'Georgia-Italic',
    android: 'serif',
    web: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
    default: 'Georgia',
  }),
} as const;

export const typeScale = {
  display: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.8,
    fontWeight: '900',
  },
  heroTitle: {
    fontFamily: fonts.heading,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
    fontWeight: '900',
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.4,
    fontWeight: '900',
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    fontWeight: '800',
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  button: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statValue: {
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
} as const;
