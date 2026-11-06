import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
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
import { ThinkingDots } from '../../src/components/Skeleton';
import { Card, GUTTER, Screen, ScreenHeader } from '../../src/components/ui';
import { STORAGE_KEYS } from '../../src/config';
import { useApp } from '../../src/state/AppState';
import { loadCache, saveCache } from '../../src/storage/cache';
import { MIN_TARGET, useTheme } from '../../src/theme';

const EXAMPLES = [
  'nearest pharmacy to EH8 9YL',
  'where is the closest A&E to Partick',
  '3 nearest dentists in Aberdeen',
];

export default function AskScreen() {
  const router = useRouter();
  const { colors, radii, type } = useTheme();
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

  const cannotSend = busy || question.trim().length === 0;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader
            title="Ask"
            subtitle="Plain-English questions about NHS services near you"
          />

          <View
            style={[
              styles.inputCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderStrong,
                borderRadius: radii.lg,
              },
            ]}
          >
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="e.g. nearest pharmacy to EH8 9YL"
              placeholderTextColor={colors.textSecondary}
              multiline
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={() => submit()}
              accessibilityLabel="Your question"
              accessibilityHint="Type where you are and what you need"
              style={[type.body, styles.input, { color: colors.text }]}
            />
            <View style={styles.sendRow}>
              <Pressable
                onPress={() => submit()}
                disabled={cannotSend}
                accessibilityRole="button"
                accessibilityLabel="Ask"
                accessibilityState={{ disabled: cannotSend, busy }}
                style={({ pressed }) => [
                  styles.send,
                  { backgroundColor: colors.accent },
                  cannotSend && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="arrow-up" size={22} color={colors.onAccent} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggestionScroll}
            contentContainerStyle={styles.suggestions}
          >
            {EXAMPLES.map((example) => (
              <Pressable
                key={example}
                onPress={() => submit(example)}
                accessibilityRole="button"
                accessibilityLabel={`Try: ${example}`}
                style={({ pressed }) => [
                  styles.suggestion,
                  { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[type.body, { color: colors.textSecondary }]}>{example}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {error && (
            <View style={styles.results}>
              <Text style={[type.body, { color: colors.danger }]} accessibilityRole="alert">
                {error}
              </Text>
            </View>
          )}
          {cachedAt !== null && !busy && (
            <View style={styles.cachedWrap}>
              <CachedBadge savedAt={cachedAt} reason="Last answer shown." />
            </View>
          )}

          {busy && (
            <View style={styles.results}>
              <Card>
                <ThinkingDots />
              </Card>
            </View>
          )}

          {result && !busy && (
            <View style={styles.results}>
              {result.refused ? (
                <View
                  style={[
                    styles.refusal,
                    { backgroundColor: colors.warningBg, borderRadius: radii.lg },
                  ]}
                  accessibilityLiveRegion="polite"
                >
                  <Ionicons name="information-circle" size={22} color={colors.warningText} />
                  <Text style={[type.body, styles.flex, { color: colors.warningText }]}>
                    {result.answer}
                  </Text>
                </View>
              ) : (
                <Card style={styles.answer}>
                  <View accessibilityLiveRegion="polite" style={styles.answerBody}>
                    <Text style={[type.body, { color: colors.text }]}>{result.answer}</Text>
                    {result.resolved_via === 'postcode_district' && (
                      <Text style={[type.caption, { color: colors.textSecondary }]}>
                        That postcode is not in the offline data, so the search started from the
                        middle of its postcode district.
                      </Text>
                    )}
                  </View>
                  {result.citations.length > 0 && (
                    <View style={styles.citations}>
                      {result.citations.map((citation) => {
                        const target = result.results.find((r) => r.id === citation.id);
                        return (
                          <Pressable
                            key={citation.index}
                            onPress={() => target && open(target)}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={`Source ${citation.index}: ${citation.name}`}
                            style={({ pressed }) => [
                              styles.citation,
                              { backgroundColor: colors.accentSoft },
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={[type.label, { color: colors.accent, fontWeight: '600' }]}>
                              {citation.index}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  {result.results.length > 0 && (
                    <Text style={[type.caption, { color: colors.textTertiary }]}>
                      Sources: {result.results[0]?.source_dataset} (Open Government Licence v3.0)
                    </Text>
                  )}
                </Card>
              )}
              {result.results.map((item, index) => (
                <FacilityRow key={item.id} item={item} index={index + 1} onPress={open} />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 32 },
  inputCard: { marginHorizontal: GUTTER, padding: 14, borderWidth: 1 },
  input: { minHeight: 56, textAlignVertical: 'top', padding: 0 },
  sendRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  send: {
    width: MIN_TARGET,
    height: MIN_TARGET,
    borderRadius: MIN_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  suggestionScroll: { flexGrow: 0, marginTop: 12 },
  suggestions: { paddingHorizontal: GUTTER, gap: 8 },
  suggestion: { minHeight: MIN_TARGET, justifyContent: 'center', paddingHorizontal: 16 },
  results: { paddingHorizontal: GUTTER, gap: 12, marginTop: 16 },
  cachedWrap: { marginTop: 16 },
  refusal: { flexDirection: 'row', gap: 12, padding: 16, alignItems: 'flex-start' },
  answer: { gap: 12 },
  answerBody: { gap: 8 },
  citations: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  citation: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
