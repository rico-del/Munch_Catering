import React from 'react';
import {
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { palette, radius, spacing } from '@/lib/munch-data';
import { useThemeTokens } from '@/lib/theme-context';
import { fonts } from '@/lib/typography';

export function Header(props: {
  title: string;
  onBack?: () => void;
  onAuthAction?: () => void;
  authActionLabel?: string;
}) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.header, { backgroundColor: theme.page }]}>
      {props.onBack ? (
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: theme.surface,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
          onPress={props.onBack}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </Pressable>
      ) : (
        <View style={styles.backButtonPlaceholder} />
      )}
      <View style={styles.headerTitleWrap}>
        <Text style={[styles.headerKicker, { color: theme.textMuted }]}>Munch</Text>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{props.title}</Text>
      </View>
      {props.onAuthAction && props.authActionLabel ? (
        <Pressable
          style={({ pressed }) => [
            styles.headerAuthButton,
            {
              backgroundColor: theme.mode === 'dark' ? '#183034' : '#E5F0EB',
              borderColor: theme.border,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
          onPress={props.onAuthAction}
        >
          <Text style={[styles.headerAuthText, { color: theme.text }]}>{props.authActionLabel}</Text>
        </Pressable>
      ) : (
        <View style={[styles.headerBadge, { backgroundColor: theme.headerBadge }]}>
          <Ionicons name="sparkles" size={14} color={palette.gold500} />
        </View>
      )}
    </View>
  );
}

export function MunchBrandLockup(props: { compact?: boolean; theme?: 'light' | 'dark' }) {
  const tokens = useThemeTokens();
  const dark = props.theme ? props.theme === 'dark' : tokens.mode === 'dark';
  return (
    <View style={[styles.brandLockup, props.compact ? styles.brandLockupCompact : undefined]}>
      <View style={[styles.brandSeal, dark ? styles.brandSealDark : undefined, props.compact ? styles.brandSealCompact : undefined]}>
        <View style={[styles.brandSealHalo, dark ? styles.brandSealHaloDark : undefined]} />
        <View style={[styles.brandStarBadge, dark ? styles.brandStarBadgeDark : undefined]}>
          <Ionicons name="star" size={props.compact ? 12 : 14} color={palette.gold500} />
        </View>
        <View style={[styles.brandLeafCluster, styles.brandLeafClusterLeft]}>
          <Ionicons name="leaf-outline" size={props.compact ? 14 : 16} color={dark ? palette.gold300 : palette.green400} />
          <Ionicons name="leaf-outline" size={props.compact ? 12 : 14} color={dark ? palette.gold300 : palette.green400} />
        </View>
        <View style={[styles.brandLeafCluster, styles.brandLeafClusterRight]}>
          <Ionicons name="leaf-outline" size={props.compact ? 14 : 16} color={dark ? palette.gold300 : palette.green400} />
          <Ionicons name="leaf-outline" size={props.compact ? 12 : 14} color={dark ? palette.gold300 : palette.green400} />
        </View>
        <View style={[styles.brandMedallion, dark ? styles.brandMedallionDark : undefined]}>
          <Ionicons name="restaurant-outline" size={props.compact ? 26 : 34} color={dark ? palette.gold300 : palette.ink950} />
        </View>
      </View>
      <View style={styles.brandWordmarkWrap}>
        <Text style={[styles.brandWordmark, dark ? styles.brandWordmarkDark : undefined, props.compact ? styles.brandWordmarkCompact : undefined]}>MUNCH</Text>
        <Text style={[styles.brandSubmark, dark ? styles.brandSubmarkDark : undefined]}>Catering Studio</Text>
      </View>
    </View>
  );
}

export function SettingStat(props: { label: string; value: string; subtle?: boolean }) {
  const theme = useThemeTokens();
  return (
    <View
      style={[
        styles.settingStat,
        props.subtle ? styles.settingStatSubtle : undefined,
        { backgroundColor: props.subtle ? theme.surfaceMuted : theme.surfaceElevated },
      ]}
    >
      <Text style={[styles.settingLabel, { color: theme.textMuted }]}>{props.label}</Text>
      <Text style={[styles.settingValue, { color: theme.text }]}>{props.value}</Text>
    </View>
  );
}

export function Screen(props: { children: React.ReactNode; onRefresh?: () => void; refreshing?: boolean }) {
  const theme = useThemeTokens();
  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        props.onRefresh ? (
          <RefreshControl refreshing={!!props.refreshing} onRefresh={props.onRefresh} tintColor={palette.gold500} />
        ) : undefined
      }
    >
      {props.children}
    </ScrollView>
  );
}

export function MotionCard(props: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useThemeTokens();
  const translate = React.useRef(new Animated.Value(18)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0.985)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(translate, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, translate]);

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity, transform: [{ translateY: translate }, { scale }] },
        props.style,
      ]}
    >
      {props.children}
    </Animated.View>
  );
}

export function HeroCard(props: { eyebrow: string; title: string; body: string; dark?: boolean }) {
  const theme = useThemeTokens();
  return (
    <MotionCard style={props.dark ? styles.darkCard : undefined}>
      {props.dark ? <LinearGradient colors={['rgba(255,255,255,0.04)', 'rgba(111,143,132,0.18)']} style={styles.heroCardGlow} /> : null}
      <Text style={[styles.eyebrow, props.dark ? styles.darkEyebrow : undefined]}>{props.eyebrow}</Text>
      <Text style={[styles.heroTitle, { color: props.dark ? theme.inverseText : theme.text }, props.dark ? styles.darkHeroTitle : undefined]}>{props.title}</Text>
      <Text style={[styles.bodyText, { color: props.dark ? '#E8DED2' : theme.textMuted }, props.dark ? styles.darkBodyText : undefined]}>{props.body}</Text>
    </MotionCard>
  );
}

export function SectionHeader(props: { eyebrow?: string; title: string; subtitle?: string }) {
  const theme = useThemeTokens();
  return (
    <View style={styles.sectionHeader}>
      {props.eyebrow ? <Text style={styles.eyebrow}>{props.eyebrow}</Text> : null}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{props.title}</Text>
      {props.subtitle ? <Text style={[styles.sectionBody, { color: theme.textMuted }]}>{props.subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitleWrap: {
    alignItems: 'center',
    gap: 2,
  },
  headerKicker: {
    fontFamily: fonts.body,
    color: palette.slate500,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: fonts.heading,
    color: palette.ink950,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 42,
  },
  headerBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E3EEE9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAuthButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAuthText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  heroCardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.md,
  },
  brandLockup: {
    alignItems: 'center',
    gap: spacing.md,
  },
  brandLockupCompact: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  brandSeal: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  brandSealCompact: {
    width: 96,
    height: 96,
  },
  brandSealDark: {
    boxShadow: '0px 12px 24px rgba(122, 173, 160, 0.12)',
  },
  brandSealHalo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  brandSealHaloDark: {
    backgroundColor: 'rgba(122, 173, 160, 0.16)',
  },
  brandStarBadge: {
    position: 'absolute',
    top: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  brandStarBadgeDark: {
    backgroundColor: '#183034',
  },
  brandMedallion: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: palette.green400,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMedallionDark: {
    borderColor: palette.gold300,
    backgroundColor: '#102022',
  },
  brandLeafCluster: {
    position: 'absolute',
    top: 44,
    gap: 4,
    zIndex: 2,
  },
  brandLeafClusterLeft: {
    left: 4,
    transform: [{ rotate: '-18deg' }],
  },
  brandLeafClusterRight: {
    right: 4,
    transform: [{ rotate: '18deg' }],
  },
  brandWordmarkWrap: {
    alignItems: 'center',
    gap: 2,
  },
  brandWordmark: {
    fontFamily: fonts.display,
    color: palette.ink950,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
  },
  brandWordmarkCompact: {
    fontSize: 18,
    letterSpacing: 3,
  },
  brandWordmarkDark: {
    color: palette.white,
  },
  brandSubmark: {
    fontFamily: fonts.body,
    color: palette.slate700,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  brandSubmarkDark: {
    color: '#D9E7DF',
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(111, 143, 132, 0.14)',
    boxShadow: '0px 16px 34px rgba(12, 38, 42, 0.12)',
    elevation: 6,
  },
  darkCard: {
    backgroundColor: palette.ink950,
  },
  eyebrow: {
    fontFamily: fonts.body,
    color: palette.gold500,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  darkEyebrow: {
    color: palette.gold300,
  },
  heroTitle: {
    fontFamily: fonts.heading,
    color: palette.ink950,
    fontSize: 31,
    fontWeight: '900',
    lineHeight: 37,
    letterSpacing: -0.5,
  },
  darkHeroTitle: {
    color: palette.white,
  },
  bodyText: {
    fontFamily: fonts.body,
    color: palette.slate700,
    lineHeight: 22,
    fontSize: 15,
  },
  darkBodyText: {
    color: '#DCE8E4',
  },
  sectionHeader: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    color: palette.ink950,
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 33,
    letterSpacing: -0.35,
  },
  sectionBody: {
    fontFamily: fonts.body,
    color: palette.slate700,
    lineHeight: 22,
  },
  settingStat: {
    backgroundColor: '#E7F0EC',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 4,
  },
  settingStatSubtle: {
    backgroundColor: '#F4F8F6',
  },
  settingLabel: {
    fontFamily: fonts.body,
    color: palette.slate500,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  settingValue: {
    fontFamily: fonts.body,
    color: palette.ink950,
    fontSize: 15,
    fontWeight: '700',
  },
});
