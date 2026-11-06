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
import { Button, Card, GUTTER } from '../../src/components/ui';
import { directionsUrl, formatDistance, haversineKm } from '../../src/lib/geo';
import { useApp } from '../../src/state/AppState';
import { useTheme } from '../../src/theme';

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

function Row({ label, value, first }: { label: string; value: string; first?: boolean }) {
  const { colors, type } = useTheme();
  return (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <Text style={[type.caption, styles.key, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[type.body, styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export default function DetailsScreen() {
  const params = useLocalSearchParams<{ id: string; data?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, type } = useTheme();
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
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={({ pressed }) => [
        styles.back,
        {
          top: insets.top + 8,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="chevron-back" size={18} color={colors.text} />
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
              { color: colors.danger, paddingTop: insets.top + 56 },
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
  const tags = [
    CATEGORY_LABELS[item.category],
    item.health_board,
    ...(distance !== null ? [`${formatDistance(distance)} away`] : []),
  ].join(' · ');

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 56 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroIcon, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name={CATEGORY_ICONS[item.category]} size={22} color={colors.accent} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={[type.display, { color: colors.text }]} accessibilityRole="header">
            {item.name}
          </Text>
          <Text style={[type.body, { color: colors.textSecondary }]}>{address}</Text>
          <Text style={[type.caption, { color: colors.textSecondary }]}>{tags}</Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="Directions"
            accessibilityLabel={`Get directions to ${item.name}`}
            variant="outline"
            icon="navigate"
            onPress={() => Linking.openURL(directionsUrl(item))}
            style={styles.action}
          />
          {phone && (
            <Button
              label="Call"
              accessibilityLabel={`Call ${phone}`}
              variant="outline"
              icon="call"
              onPress={() => Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`)}
              style={styles.action}
            />
          )}
        </View>

        <Card style={styles.meta}>
          <Row first label="Postcode" value={item.postcode} />
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
  content: { paddingHorizontal: GUTTER, paddingBottom: 24, gap: 12 },
  back: {
    position: 'absolute',
    left: GUTTER,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { gap: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  meta: { padding: 0, paddingHorizontal: 12 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 10 },
  key: { width: 100, paddingTop: 2 },
  value: { flex: 1 },
});
