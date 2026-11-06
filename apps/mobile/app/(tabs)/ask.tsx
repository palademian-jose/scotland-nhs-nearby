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
import {
  Card,
  GUTTER,
  rowPosition,
  Screen,
  ScreenHeader,
  useFocusBorder,
} from '../../src/components/ui';
import { STORAGE_KEYS } from '../../src/config';
import { useApp } from '../../src/state/AppState';
import { loadCache, saveCache } from '../../src/storage/cache';
import { radii, useTheme } from '../../src/theme';

const EXAMPLES = [
  'nearest pharmacy to EH8 9YL',
  'where is the closest A&E to Partick',
  '3 nearest dentists in Aberdeen',
];

export default function AskScreen() {
  const router = useRouter();
  const { colors, type } = useTheme();
  const focus = useFocusBorder();
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
              { backgroundColor: colors.surface, borderColor: focus.borderColor },
            ]}
          >
            <TextInput
              value={question}
              onChangeText={setQuestion}
              onFocus={focus.onFocus}
              onBlur={focus.onBlur}
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
            <Pressable
              onPress={() => submit()}
              disabled={cannotSend}
              hitSlop={4}
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
              <Ionicons name="arrow-up" size={18} color={colors.onAccent} />
            </Pressable>
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
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Try: ${example}`}
                style={({ pressed }) => [
                  styles.suggestion,
                  { borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[type.body, { fontSize: 14, color: colors.textSecondary }]}>
                  {example}
                </Text>
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
                  <Ionicons name="information-circle" size={20} color={colors.warningText} />
                  <Text style={[type.body, styles.flex, { color: colors.warningText }]}>
                    {result.answer}
                  </Text>
                </View>
              ) : (
                <Card style={styles.answer}>
                  <Text
                    style={[type.body, { color: colors.text }]}
                    accessibilityLiveRegion="polite"
                  >
                    {result.answer}
                    {result.citations.map((citation) => {
                      const target = result.results.find((r) => r.id === citation.id);
                      return (
                        <Text
                          key={citation.index}
                          onPress={() => target && open(target)}
                          accessibilityRole="button"
                          accessibilityLabel={`Source ${citation.index}: ${citation.name}`}
                          style={[
                            type.label,
                            { color: colors.accent, backgroundColor: colors.accentSoft },
                          ]}
                        >
                          {` ${citation.index} `}
                        </Text>
                      );
                    })}
                  </Text>
                  {result.resolved_via === 'postcode_district' && (
                    <Text style={[type.caption, { color: colors.textSecondary }]}>
                      That postcode is not in the offline data, so the search started from the
                      middle of its postcode district.
                    </Text>
                  )}
                  {result.results.length > 0 && (
                    <Text style={[type.caption, { color: colors.textTertiary }]}>
                      Sources: {result.results[0]?.source_dataset} (Open Government Licence v3.0)
                    </Text>
                  )}
                </Card>
              )}
              <View>
                {result.results.map((item, index) => (
                  <FacilityRow
                    key={item.id}
                    item={item}
                    index={index + 1}
                    position={rowPosition(index, result.results.length)}
                    onPress={open}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 16 },
  inputCard: {
    marginHorizontal: GUTTER,
    minHeight: 88,
    padding: 12,
    paddingBottom: 48,
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  input: { minHeight: 28, textAlignVertical: 'top', padding: 0 },
  send: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  suggestionScroll: { flexGrow: 0, marginTop: 12 },
  suggestions: { paddingHorizontal: GUTTER, gap: 6 },
  suggestion: {
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  results: { paddingHorizontal: GUTTER, gap: 8, marginTop: 12 },
  cachedWrap: { marginTop: 12 },
  refusal: { flexDirection: 'row', gap: 10, padding: 12, alignItems: 'flex-start' },
  answer: { gap: 8 },
});
