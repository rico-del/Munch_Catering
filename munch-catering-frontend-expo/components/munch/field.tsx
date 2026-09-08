import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useThemeTokens } from '@/lib/theme-context';
import { palette, radius, spacing } from '@/lib/munch-data';
import { fonts } from '@/lib/typography';

export function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  multiline?: boolean;
  hint?: string;
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  autoCapitalize?: React.ComponentProps<typeof TextInput>['autoCapitalize'];
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
}) {
  const theme = useThemeTokens();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        multiline={props.multiline}
        autoComplete={props.autoComplete}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        keyboardType={props.keyboardType}
        autoCorrect={false}
        importantForAutofill={props.autoComplete === 'off' ? 'no' : 'auto'}
        placeholderTextColor={theme.textMuted}
        style={[styles.fieldInput, { backgroundColor: theme.field, borderColor: theme.fieldBorder, color: theme.text }, props.multiline ? styles.fieldInputMultiline : undefined]}
      />
      {props.hint ? <Text style={[styles.fieldHint, { color: theme.textMuted }]}>{props.hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontFamily: fonts.body,
    color: palette.ink950,
    fontWeight: '700',
  },
  fieldInput: {
    fontFamily: fonts.body,
    backgroundColor: '#F8FBFA',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(111, 143, 132, 0.18)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    color: palette.ink950,
    minHeight: 56,
  },
  fieldInputMultiline: {
    minHeight: 132,
    textAlignVertical: 'top',
  },
  fieldHint: {
    fontFamily: fonts.body,
    color: palette.slate500,
    fontSize: 12,
  },
});
