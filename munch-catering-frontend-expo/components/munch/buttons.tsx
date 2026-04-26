import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/lib/munch-data';
import { useThemeTokens } from '@/lib/theme-context';

export function ButtonRow(props: { children: React.ReactNode }) {
  return <View style={styles.buttonRow}>{props.children}</View>;
}

export function PrimaryButton(props: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.primaryButton} onPress={props.onPress}>
      <Text style={styles.primaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

export function SecondaryButton(props: { label: string; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable style={[styles.secondaryButton, { backgroundColor: theme.mode === 'dark' ? '#2A332A' : '#EFE1D0', borderColor: theme.border }]} onPress={props.onPress}>
      <Text style={[styles.secondaryButtonText, { color: theme.text }]}>{props.label}</Text>
    </Pressable>
  );
}

export function GhostButton(props: { label: string; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable style={[styles.ghostButton, { borderColor: theme.border, backgroundColor: theme.ghost }]} onPress={props.onPress}>
      <Text style={[styles.ghostButtonText, { color: theme.text }]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    backgroundColor: palette.gold500,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    flex: 1,
    boxShadow: '0px 8px 16px rgba(138, 74, 46, 0.18)',
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFF8F2',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: '#EFE1D0',
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 93, 0.12)',
  },
  secondaryButtonText: {
    color: palette.ink950,
    fontWeight: '800',
    fontSize: 15,
  },
  ghostButton: {
    borderColor: '#D8B89D',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'rgba(255, 252, 248, 0.55)',
  },
  ghostButtonText: {
    color: palette.ink950,
    fontWeight: '700',
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
});
