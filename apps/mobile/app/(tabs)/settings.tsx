import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { type ReactNode, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  Button,
  Card,
  GUTTER,
  Screen,
  ScreenHeader,
  useFocusBorder,
} from '../../src/components/ui';
import { STORAGE_KEYS } from '../../src/config';
import { useApp } from '../../src/state/AppState';
import { radii, useTheme } from '../../src/theme';

function Group({ title, children }: { title: string; children: ReactNode }) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[type.label, styles.groupTitle, { color: colors.textSecondary }]}>{title}</Text>
      <Card style={styles.card}>{children}</Card>
    </View>
  );
}

export default function SettingsScreen() {
  const { colors, type } = useTheme();
  const focus = useFocusBorder();
  const { apiUrl, setApiUrl, location, retryGps } = useApp();
  const [edited, setDraft] = useState<string | null>(null);
  const draft = edited ?? apiUrl;
  const [permission, setPermission] = useState('checking');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Location.getForegroundPermissionsAsync()
      .then((p) => alive && setPermission(p.status))
      .catch(() => alive && setPermission('unavailable'));
    return () => {
      alive = false;
    };
  }, [location.status]);

  const save = async () => {
    await setApiUrl(draft);
    setDraft(null);
    setNote('API address saved.');
  };

  const clearCache = async () => {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.nearbyCache),
      AsyncStorage.removeItem(STORAGE_KEYS.askCache),
      AsyncStorage.removeItem(STORAGE_KEYS.manualPostcode),
    ]);
    setNote('Saved results and postcode cleared.');
  };

  const dotColor =
    permission === 'granted'
      ? colors.accent
      : permission === 'denied'
        ? colors.danger
        : colors.textTertiary;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Settings" subtitle="Connection, location and saved data" />

        <Group title="API address">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="API address"
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
          <Button label="Save" accessibilityLabel="Save API address" onPress={save} />
        </Group>

        <Group title="Location">
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <Text style={[type.body, styles.flex, { color: colors.text }]}>
              Permission: {permission}
            </Text>
          </View>
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            Searching from: {location.label || 'not set'} ({location.status})
          </Text>
          <Button
            label="Use my current location"
            accessibilityLabel="Request location permission again"
            variant="outline"
            icon="navigate"
            onPress={retryGps}
          />
        </Group>

        <Group title="Saved data">
          <Button
            label="Clear saved results"
            variant="outline"
            icon="trash-outline"
            onPress={clearCache}
          />
          {note && (
            <Text
              style={[type.caption, { color: colors.textSecondary }]}
              accessibilityLiveRegion="polite"
            >
              {note}
            </Text>
          )}
        </Group>

        <Group title="Appearance">
          <Text style={[type.body, { color: colors.text }]}>
            The theme follows your device setting, light or dark.
          </Text>
        </Group>

        <Group title="About">
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            Data: NHS Scotland open data (opendata.nhs.scot), Open Government Licence v3.0.
            Postcodes are geocoded with postcodes.io. Map tiles: OpenStreetMap contributors. This
            app is not an official NHS service and gives no medical advice. In an emergency call
            999; for urgent advice call NHS 24 on 111.
          </Text>
        </Group>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 16 },
  group: { paddingHorizontal: GUTTER, marginBottom: 12, gap: 6 },
  groupTitle: { paddingHorizontal: 4 },
  card: { gap: 10 },
  input: { minHeight: 40, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
