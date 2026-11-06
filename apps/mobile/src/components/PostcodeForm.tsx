import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, MIN_TARGET, spacing } from '../theme';

interface Props {
  message?: string | null;
  onSubmit: (postcode: string) => Promise<boolean>;
}

/** Shown when location permission is denied: search from a typed postcode instead. */
export function PostcodeForm({ message, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

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
      <Text style={styles.title} accessibilityRole="header">
        Where are you?
      </Text>
      <Text style={styles.help}>
        {message ?? 'Enter a postcode to search from, or allow location access in Settings.'}
      </Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="EH8 9YL"
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="postal-code"
        returnKeyType="search"
        onSubmitEditing={submit}
        accessibilityLabel="Postcode"
        accessibilityHint="Enter a full UK postcode"
        style={styles.input}
      />
      <Pressable
        onPress={submit}
        disabled={busy || value.trim().length < 5}
        accessibilityRole="button"
        accessibilityLabel="Use this postcode"
        accessibilityState={{ disabled: busy || value.trim().length < 5, busy }}
        style={[styles.button, (busy || value.trim().length < 5) && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>{busy ? 'Looking up...' : 'Use this postcode'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surface },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  help: { fontSize: 15, color: colors.textMuted },
  input: {
    minHeight: MIN_TARGET,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    fontSize: 18,
    color: colors.text,
  },
  button: {
    minHeight: MIN_TARGET,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
});
