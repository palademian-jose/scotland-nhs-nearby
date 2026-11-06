import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORY_LABELS, type Facility, type NearbyResult } from '../../src/api/types';
import { CATEGORY_ICONS } from '../../src/components/categoryIcons';
import { Badge, Button, Card, GUTTER } from '../../src/components/ui';
import { directionsUrl, formatDistance, haversineKm } from '../../src/lib/geo';
import { useApp } from '../../src/state/AppState';
import { MIN_TARGET, useTheme } from '../../src/theme';

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

function Row({ label, value }: { label: string; value: string }) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[type.caption, styles.key, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[type.body, styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export default function DetailsScreen() {
  const params = useLocalSearchParams<{ id: string; data?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, shadow, type } = useTheme();
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

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const backButton = (
    <Pressable
      onPress={goBack}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={({ pressed }) => [
        styles.back,
        shadow,
        { top: insets.top + 8, backgroundColor: colors.surface },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="chevron-back" size={22} color={colors.text} />
    </Pressable>
  );

  if (error || !item) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {error ? (
          <Text
            style={[
              type.body,
              styles.message,
              { color: colors.danger, paddingTop: insets.top + 72 },
            ]}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : (
          <ActivityIndicator
            accessibilityLabel="Loading details"
            color={colors.accent}
            style={styles.message}
          />
        )}
        {backButton}
      </View>
    );
  }

  const distance =
    (item as NearbyResult).distance_km ??
    (location.coords ? haversineKm(location.coords, { lat: item.lat, lon: item.lon }) : null);
  const address = `${item.address ? `${item.address}, ` : ''}${item.postcode}`;
  const phone = item.phone;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 72 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroIcon, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name={CATEGORY_ICONS[item.category]} size={30} color={colors.accent} />
        </View>
        <Text style={[type.display, { color: colors.text }]} accessibilityRole="header">
          {item.name}
        </Text>
        <Text style={[type.body, { color: colors.textSecondary }]}>{address}</Text>
        <View style={styles.chips}>
          <Badge>{CATEGORY_LABELS[item.category]}</Badge>
          <Badge tone="muted">{item.health_board}</Badge>
          {distance !== null && <Badge>{`${formatDistance(distance)} away`}</Badge>}
        </View>

        <View style={styles.actions}>
          <Button
            label="Directions"
            accessibilityLabel={`Get directions to ${item.name}`}
            variant="soft"
            icon="navigate"
            onPress={() => Linking.openURL(directionsUrl(item))}
            style={styles.action}
          />
          {phone && (
            <Button
              label="Call"
              accessibilityLabel={`Call ${phone}`}
              variant="soft"
              icon="call"
              onPress={() => Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`)}
              style={styles.action}
            />
          )}
        </View>

        <Card style={styles.meta}>
          <Row label="Postcode" value={item.postcode} />
          {phone && <Row label="Phone" value={phone} />}
          <Row label="Health board" value={item.health_board} />
          <Row label="Source dataset" value={item.source_dataset} />
          <Row label="Licence" value="Open Government Licence v3.0" />
        </Card>
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          Check opening hours with the service before you travel.
        </Text>
      </ScrollView>
      {backButton}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  message: { padding: GUTTER },
  content: { paddingHorizontal: GUTTER, paddingBottom: 40, gap: 12 },
  back: {
    position: 'absolute',
    left: GUTTER,
    width: MIN_TARGET,
    height: MIN_TARGET,
    borderRadius: MIN_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  action: { flex: 1 },
  meta: { gap: 14, marginTop: 8 },
  row: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  key: { width: 104, paddingTop: 2 },
  value: { flex: 1 },
});
