import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/lib/munch-data';
import { useThemeTokens } from '@/lib/theme-context';

export function TabBar(props: {
  items: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  active: string;
  onChange: (value: string) => void;
}) {
  const theme = useThemeTokens();
  return (
    <BlurView intensity={36} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={[styles.tabBarShell, { borderColor: theme.shellBorder }]}>
      <View style={[styles.tabBar, { backgroundColor: theme.shell }]}>
        {props.items.map(item => {
          const active = props.active === item.key;
          return (
            <Pressable key={item.key} style={styles.tabBarItem} onPress={() => props.onChange(item.key)}>
              <View
                style={[
                  styles.tabBarItemInner,
                  active ? styles.tabBarItemActive : undefined,
                  { backgroundColor: active ? (theme.mode === 'dark' ? '#2D372E' : '#F4E6D8') : 'rgba(0,0,0,0)' },
                ]}
              >
                <Ionicons name={item.icon} size={18} color={active ? palette.gold500 : theme.textMuted} />
                <Text style={[styles.tabBarText, { color: active ? palette.gold500 : theme.textMuted }, active ? styles.tabBarTextActive : undefined]}>{item.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  tabBarShell: {
    marginTop: -4,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: 'rgba(230, 212, 193, 0.88)',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 248, 242, 0.9)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  tabBarItem: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  tabBarItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
  },
  tabBarItemActive: {
    backgroundColor: '#F4E6D8',
  },
  tabBarText: {
    color: palette.slate500,
    fontWeight: '700',
    fontSize: 12,
  },
  tabBarTextActive: {
    color: palette.gold500,
    fontWeight: '800',
  },
});
