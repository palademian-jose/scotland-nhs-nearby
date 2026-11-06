import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { radii, useTheme } from '../theme';
import { Button, GUTTER, useFocusBorder } from './ui';

interface Props {
  message?: string | null;
  onSubmit: (postcode: string) => Promise<boolean>;
}

/** Shown when location permission is denied: search from a typed postcode instead. */
export function PostcodeForm({ message, onSubmit }: Props) {
  const { colors, type } = useTheme();
  const focus = useFocusBorder();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const unusable = busy || value.trim().length < 5;

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit(value);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={[type.display, { color: colors.text }]} accessibilityRole="header">
        Where are you?
      </Text>
      <Text style={[type.body, { color: colors.textSecondary }]}>
        {message ?? 'Enter a postcode to search from, or allow location access in Settings.'}
      </Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="EH8 9YL"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="postal-code"
        returnKeyType="search"
        onSubmitEditing={submit}
        accessibilityLabel="Postcode"
        accessibilityHint="Enter a full UK postcode"
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        style={[
          type.body,
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: focus.borderColor,
            borderRadius: radii.lg,
          },
        ]}
      />
      <Button
        label={busy ? 'Looking up...' : 'Use this postcode'}
        accessibilityLabel="Use this postcode"
        onPress={submit}
        disabled={unusable}
        busy={busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: GUTTER, paddingTop: 24, gap: 12 },
  input: { minHeight: 44, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
});
