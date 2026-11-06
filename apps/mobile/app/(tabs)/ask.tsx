import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { AskResponse, NearbyResult } from '../../src/api/types';
import { CachedBadge } from '../../src/components/CachedBadge';
import { FacilityRow } from '../../src/components/FacilityRow';
import { STORAGE_KEYS } from '../../src/config';
import { useApp } from '../../src/state/AppState';
import { loadCache, saveCache } from '../../src/storage/cache';
import { colors, MIN_TARGET, spacing } from '../../src/theme';

const EXAMPLES = [
  'nearest pharmacy to EH8 9YL',
  'where is the closest A&E to Partick',
  '3 nearest dentists in Aberdeen',
];

export default function AskScreen() {
  const router = useRouter();
  const { client, location } = useApp();
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadCache<{ question: string; response: AskResponse }>(STORAGE_KEYS.askCache).then((entry) => {
      if (alive && entry) {
        setQuestion(entry.value.question);
        setResult(entry.value.response);
        setCachedAt(entry.savedAt);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const submit = async (text: string = question) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    setQuestion(trimmed);
    setBusy(true);
    setError(null);
    try {
      const response = await client.ask(trimmed, location.coords);
      setResult(response);
      setCachedAt(null);
      await saveCache(STORAGE_KEYS.askCache, { question: trimmed, response });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const open = (item: NearbyResult) =>
    router.push({
      pathname: '/facility/[id]',
      params: { id: item.id, data: JSON.stringify(item) },
    });

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label} nativeID="ask-label">
          Ask about GPs, pharmacies, dentists, hospitals or A&E
        </Text>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="e.g. nearest pharmacy to EH8 9YL"
          multiline
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={() => submit()}
          accessibilityLabel="Your question"
          accessibilityHint="Type where you are and what you need"
          style={styles.input}
        />
        <Pressable
          onPress={() => submit()}
          disabled={busy || question.trim().length === 0}
          accessibilityRole="button"
          accessibilityLabel="Ask"
          accessibilityState={{ disabled: busy || question.trim().length === 0, busy }}
          style={[styles.button, (busy || question.trim().length === 0) && styles.disabled]}
        >
          <Text style={styles.buttonText}>{busy ? 'Asking...' : 'Ask'}</Text>
        </Pressable>

        <View style={styles.examples}>
          {EXAMPLES.map((example) => (
            <Pressable
              key={example}
              onPress={() => submit(example)}
              accessibilityRole="button"
              accessibilityLabel={`Try: ${example}`}
              style={styles.example}
            >
              <Text style={styles.exampleText}>{example}</Text>
            </Pressable>
          ))}
        </View>

        {busy && <ActivityIndicator accessibilityLabel="Waiting for the answer" />}
        {error && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}
        {cachedAt !== null && <CachedBadge savedAt={cachedAt} reason="Last answer shown." />}

        {result && (
          <View style={styles.answerBox} accessibilityLiveRegion="polite">
            <Text style={[styles.answer, result.refused && styles.refused]}>{result.answer}</Text>
            {result.resolved_via === 'postcode_district' && (
              <Text style={styles.note}>
                That postcode is not in the offline data, so the search started from the middle of
                its postcode district.
              </Text>
            )}
            {result.results.length > 0 && (
              <Text style={styles.sources}>
                Sources: {result.results[0]?.source_dataset} (Open Government Licence v3.0)
              </Text>
            )}
          </View>
        )}
        {result?.results.map((item, index) => (
          <FacilityRow key={item.id} item={item} index={index + 1} onPress={open} />
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 17,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
  },
  button: {
    minHeight: MIN_TARGET,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
  examples: { gap: spacing.sm },
  example: {
    minHeight: MIN_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  exampleText: { color: colors.primary, fontSize: 15 },
  error: { color: colors.danger, fontSize: 15 },
  answerBox: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 8,
    gap: spacing.sm,
  },
  answer: { fontSize: 17, color: colors.text, lineHeight: 24 },
  refused: { color: colors.warningText },
  note: { fontSize: 14, color: colors.textMuted },
  sources: { fontSize: 13, color: colors.textMuted },
});
