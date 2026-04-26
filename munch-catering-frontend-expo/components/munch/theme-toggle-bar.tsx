import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemeMode, palette, radius, spacing } from '@/lib/munch-data';
import { lightTheme, useThemeTokens } from '@/lib/theme-context';

export function ThemeToggleBar(props: { value: ThemeMode; onChange: (value: ThemeMode) => void }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.themeToggleBar, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
      {(['light', 'dark'] as ThemeMode[]).map(item => {
        const active = props.value === item;
        return (
          <Pressable key={item} style={styles.themeToggleOption} onPress={() => props.onChange(item)}>
            <View style={[styles.themeToggleInner, { backgroundColor: active ? palette.gold500 : 'rgba(0,0,0,0)' }]}>
              <Ionicons name={item === 'light' ? 'sunny-outline' : 'moon-outline'} size={16} color={active ? lightTheme.inverseText : theme.textMuted} />
              <Text style={[styles.themeToggleText, { color: active ? lightTheme.inverseText : theme.textMuted }]}>{item === 'light' ? 'Light' : 'Dark'}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  themeToggleBar: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  themeToggleOption: {
    flex: 1,
  },
  themeToggleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
  },
  themeToggleText: {
    fontWeight: '800',
    fontSize: 14,
  },
});
