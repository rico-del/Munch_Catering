import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { palette, radius, spacing } from '@/lib/munch-data';
import { useThemeTokens } from '@/lib/theme-context';
import { fonts } from '@/lib/typography';

export function StatusPill(props: { label: string; muted?: boolean }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.badge, props.muted ? styles.badgeMuted : undefined, { backgroundColor: props.muted ? theme.surfaceMuted : theme.surfaceElevated }]}>
      <Text style={[styles.badgeText, props.muted ? styles.badgeTextMuted : undefined, { color: props.muted ? theme.textMuted : theme.text }]}>
        {props.label}
      </Text>
    </View>
  );
}

export function InlineError(props: { message: string; onDismiss: () => void }) {
  return (
    <View style={styles.inlineError}>
      <Text style={styles.inlineErrorText}>{props.message}</Text>
      <Pressable onPress={props.onDismiss}>
        <Ionicons name="close" size={16} color="#235057" />
      </Pressable>
    </View>
  );
}

export function BusyStripe() {
  const theme = useThemeTokens();
  return (
    <View style={[styles.busyStripe, { backgroundColor: theme.mode === 'dark' ? '#14282C' : '#E5F0EB' }]}>
      <ActivityIndicator size="small" color={palette.gold500} />
      <Text style={[styles.busyText, { color: theme.text }]}>Syncing secure data...</Text>
    </View>
  );
}

export function Avatar(props: { label: string }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.avatar, { backgroundColor: theme.mode === 'dark' ? '#1D3032' : palette.ink900 }]}>
      <Text style={styles.avatarText}>{props.label.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#E3EEE9',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeMuted: {
    backgroundColor: '#F4F8F6',
  },
  badgeText: {
    fontFamily: fonts.body,
    color: palette.ink950,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  badgeTextMuted: {
    color: palette.slate700,
  },
  inlineError: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: '#E6F1F0',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  inlineErrorText: {
    fontFamily: fonts.body,
    color: '#235057',
    flex: 1,
    fontWeight: '600',
  },
  busyStripe: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: '#E5F0EB',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  busyText: {
    fontFamily: fonts.body,
    color: palette.ink950,
    fontWeight: '700',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: palette.ink900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.body,
    color: '#D9E7DF',
    fontWeight: '900',
  },
});
