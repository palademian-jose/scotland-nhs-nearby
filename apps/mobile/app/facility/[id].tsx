import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { CATEGORY_LABELS, type Facility, type NearbyResult } from '../../src/api/types';
import { directionsUrl, formatDistance, haversineKm } from '../../src/lib/geo';
import { useApp } from '../../src/state/AppState';
import { colors, MIN_TARGET, spacing } from '../../src/theme';

function parseItem(data: string | undefined): Facility | null {
  if (!data) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed === 'object' && parsed !== null && 'id' in parsed && 'name' in parsed) {
      return parsed as Facility;
    }
  } catch {
    // fall back to fetching by id
  }
  return null;
}

export default function DetailsScreen() {
  const params = useLocalSearchParams<{ id: string; data?: string }>();
  const { client, location } = useApp();
  const [item, setItem] = useState<Facility | null>(() => parseItem(params.data));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item || !params.id) {
      return;
    }
    client
      .facility(params.id)
      .then(setItem)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Request failed'));
  }, [client, item, params.id]);

  if (error) {
    return (
      <Text style={styles.error} accessibilityRole="alert">
        {error}
      </Text>
    );
  }
  if (!item) {
    return <ActivityIndicator accessibilityLabel="Loading details" style={styles.loading} />;
  }

  const distance =
    (item as NearbyResult).distance_km ??
    (location.coords ? haversineKm(location.coords, { lat: item.lat, lon: item.lon }) : null);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.name} accessibilityRole="header">
        {item.name}
      </Text>
      <Text style={styles.category}>{CATEGORY_LABELS[item.category]}</Text>
      {distance !== null && <Text style={styles.text}>{formatDistance(distance)} away</Text>}
      <Text style={styles.label}>Address</Text>
      <Text style={styles.text}>
        {item.address ? `${item.address}, ` : ''}
        {item.postcode}
      </Text>
      {item.phone && (
        <>
          <Text style={styles.label}>Phone</Text>
          <Pressable
            onPress={() => Linking.openURL(`tel:${item.phone?.replace(/\s+/g, '')}`)}
            accessibilityRole="link"
            accessibilityLabel={`Call ${item.phone}`}
            style={styles.link}
          >
            <Text style={styles.linkText}>{item.phone}</Text>
          </Pressable>
        </>
      )}
      <Text style={styles.label}>Health board</Text>
      <Text style={styles.text}>{item.health_board}</Text>
      <Pressable
        onPress={() => Linking.openURL(directionsUrl(item))}
        accessibilityRole="button"
        accessibilityLabel={`Get directions to ${item.name}`}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Get directions</Text>
      </Pressable>
      <Text style={styles.source}>
        Source: {item.source_dataset}. Open Government Licence v3.0. Check opening hours with the
        service before you travel.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm },
  loading: { padding: spacing.xl },
  error: { padding: spacing.lg, color: colors.danger, fontSize: 16 },
  name: { fontSize: 24, fontWeight: '700', color: colors.text },
  category: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  label: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.md,
    textTransform: 'uppercase',
  },
  text: { fontSize: 17, color: colors.text },
  link: { minHeight: MIN_TARGET, justifyContent: 'center' },
  linkText: { fontSize: 17, color: colors.primary, textDecorationLine: 'underline' },
  button: {
    minHeight: MIN_TARGET,
    marginTop: spacing.lg,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
  source: { marginTop: spacing.lg, fontSize: 13, color: colors.textMuted },
});
