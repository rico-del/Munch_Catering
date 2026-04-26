import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusPill } from '@/components/munch/feedback';
import { palette, radius, spacing } from '@/lib/munch-data';
import { useThemeTokens } from '@/lib/theme-context';

export function RoleSelector(props: { value: 'customer' | 'caterer'; onChange: (value: 'customer' | 'caterer') => void }) {
  const theme = useThemeTokens();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>Choose your path</Text>
      <Text style={[styles.fieldHint, { color: theme.textMuted }]}>Pick the experience you want Munch to unlock first. You can still expand access later.</Text>
      <View style={styles.roleStage}>
        <Pressable
          style={[styles.roleCardEditorial, { backgroundColor: theme.surface, borderColor: theme.border }, props.value === 'customer' ? styles.roleCardEditorialActive : undefined]}
          onPress={() => props.onChange('customer')}
        >
          <View style={styles.roleTopLine}>
            <View style={styles.roleIconWrap}>
              <Ionicons name="sparkles" size={18} color={props.value === 'customer' ? palette.gold500 : palette.slate500} />
            </View>
            <StatusPill label="Booking side" muted={props.value !== 'customer'} />
          </View>
          <Text style={[styles.roleEditorialTitle, { color: theme.text }]}>Plan and book unforgettable events</Text>
          <Text style={[styles.roleEditorialBody, { color: theme.textMuted }]}>
            Browse standout caterers, compare polished menus, request tailored quotes, and manage every conversation from one premium workspace.
          </Text>
          <View style={styles.roleFootRow}>
            <Text style={[styles.roleFootLabel, { color: theme.textMuted }]}>Best for hosts, planners, and event teams</Text>
            {props.value === 'customer' ? <Ionicons name="checkmark-circle" size={20} color={palette.gold500} /> : null}
          </View>
        </Pressable>
        <Pressable
          style={[styles.roleCardEditorial, { backgroundColor: theme.surface, borderColor: theme.border }, props.value === 'caterer' ? styles.roleCardEditorialActive : undefined]}
          onPress={() => props.onChange('caterer')}
        >
          <View style={styles.roleTopLine}>
            <View style={styles.roleIconWrap}>
              <Ionicons name="restaurant" size={18} color={props.value === 'caterer' ? palette.gold500 : palette.slate500} />
            </View>
            <StatusPill label="Studio side" muted={props.value !== 'caterer'} />
          </View>
          <Text style={[styles.roleEditorialTitle, { color: theme.text }]}>Present your brand like a premium studio</Text>
          <Text style={[styles.roleEditorialBody, { color: theme.textMuted }]}>
            Receive real inquiries, publish your culinary portfolio, refine your public profile, and turn demand into confirmed bookings with clarity.
          </Text>
          <View style={styles.roleFootRow}>
            <Text style={[styles.roleFootLabel, { color: theme.textMuted }]}>Best for caterers, chefs, and hospitality brands</Text>
            {props.value === 'caterer' ? <Ionicons name="checkmark-circle" size={20} color={palette.gold500} /> : null}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    gap: spacing.sm,
  },
  fieldLabel: {
    color: palette.ink950,
    fontWeight: '700',
  },
  fieldHint: {
    color: palette.slate500,
    fontSize: 12,
  },
  roleStage: {
    gap: spacing.md,
  },
  roleCardEditorial: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.xl,
    gap: spacing.sm,
    boxShadow: '0px 8px 18px rgba(77, 54, 41, 0.05)',
    elevation: 4,
  },
  roleCardEditorialActive: {
    borderColor: palette.gold500,
    backgroundColor: '#FEF0E7',
  },
  roleTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F7E2D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleEditorialTitle: {
    color: palette.ink950,
    fontWeight: '800',
    fontSize: 18,
    lineHeight: 24,
  },
  roleEditorialBody: {
    color: palette.slate700,
    lineHeight: 22,
    fontSize: 14,
  },
  roleFootRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  roleFootLabel: {
    color: palette.slate500,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
});
