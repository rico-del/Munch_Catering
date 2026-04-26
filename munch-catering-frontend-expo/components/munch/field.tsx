import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useThemeTokens } from '@/lib/theme-context';
import { palette, radius, spacing } from '@/lib/munch-data';

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
    color: palette.ink950,
    fontWeight: '700',
  },
  fieldInput: {
    backgroundColor: '#FFF9F3',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(201, 109, 67, 0.14)',
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
    color: palette.slate500,
    fontSize: 12,
  },
});
