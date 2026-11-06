import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { STORAGE_KEYS } from '../../src/config';
import { useApp } from '../../src/state/AppState';
import { colors, MIN_TARGET, spacing } from '../../src/theme';

export default function SettingsScreen() {
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

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading} accessibilityRole="header">
        API address
      </Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        accessibilityLabel="API address"
        style={styles.input}
      />
      <Pressable
        onPress={save}
        accessibilityRole="button"
        accessibilityLabel="Save API address"
        style={styles.button}
      >
        <Text style={styles.buttonText}>Save</Text>
      </Pressable>

      <Text style={styles.heading} accessibilityRole="header">
        Location
      </Text>
      <Text style={styles.text}>Permission: {permission}</Text>
      <Text style={styles.text}>
        Searching from: {location.label || 'not set'} ({location.status})
      </Text>
      <Pressable
        onPress={retryGps}
        accessibilityRole="button"
        accessibilityLabel="Request location permission again"
        style={styles.button}
      >
        <Text style={styles.buttonText}>Use my current location</Text>
      </Pressable>

      <Text style={styles.heading} accessibilityRole="header">
        Saved data
      </Text>
      <Pressable
        onPress={clearCache}
        accessibilityRole="button"
        accessibilityLabel="Clear saved results"
        style={styles.secondary}
      >
        <Text style={styles.secondaryText}>Clear saved results</Text>
      </Pressable>
      {note && (
        <Text style={styles.note} accessibilityLiveRegion="polite">
          {note}
        </Text>
      )}

      <Text style={styles.heading} accessibilityRole="header">
        About
      </Text>
      <Text style={styles.text}>
        Data: NHS Scotland open data (opendata.nhs.scot), Open Government Licence v3.0. Postcodes
        are geocoded with postcodes.io. Map tiles: OpenStreetMap contributors. This app is not an
        official NHS service and gives no medical advice. In an emergency call 999; for urgent
        advice call NHS 24 on 111.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  text: { fontSize: 15, color: colors.text, lineHeight: 22 },
  input: {
    minHeight: MIN_TARGET,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  button: {
    minHeight: MIN_TARGET,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  secondary: {
    minHeight: MIN_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  note: { color: colors.textMuted, fontSize: 14 },
});
