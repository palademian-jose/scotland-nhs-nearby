import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Category, NearbyResult } from '../../src/api/types';
import { CachedBadge } from '../../src/components/CachedBadge';
import { CategoryChips } from '../../src/components/CategoryChips';
import { FacilityRow } from '../../src/components/FacilityRow';
import { MapPane } from '../../src/components/MapPane';
import { PostcodeForm } from '../../src/components/PostcodeForm';
import { useNearby } from '../../src/hooks/useNearby';
import { useApp } from '../../src/state/AppState';
import { colors, MIN_TARGET, spacing } from '../../src/theme';

export default function NearbyScreen() {
  const router = useRouter();
  const { client, location, setManualPostcode, retryGps } = useApp();
  const [category, setCategory] = useState<Category>('pharmacy');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [changing, setChanging] = useState(false);
  const { items, loading, error, cachedAt } = useNearby(client, location.coords, category);

  const open = (item: NearbyResult) =>
    router.push({
      pathname: '/facility/[id]',
      params: { id: item.id, data: JSON.stringify(item) },
    });

  if (location.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Finding your location" />
        <Text style={styles.muted}>Finding your location...</Text>
      </View>
    );
  }

  if (location.status === 'needs_postcode' || changing) {
    return (
      <PostcodeForm
        message={location.message}
        onSubmit={async (postcode) => {
          const ok = await setManualPostcode(postcode);
          if (ok) {
            setChanging(false);
          }
          return ok;
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <CategoryChips selected={category} onSelect={setCategory} />
      <View style={styles.bar}>
        <Text style={styles.muted} accessibilityLabel={`Searching from ${location.label}`}>
          From: {location.label}
        </Text>
        <Pressable
          onPress={() => setChanging(true)}
          accessibilityRole="button"
          accessibilityLabel="Change search location"
          style={styles.link}
        >
          <Text style={styles.linkText}>Change</Text>
        </Pressable>
        {location.status === 'manual' && (
          <Pressable
            onPress={retryGps}
            accessibilityRole="button"
            accessibilityLabel="Use my current location"
            style={styles.link}
          >
            <Text style={styles.linkText}>Use GPS</Text>
          </Pressable>
        )}
        <View style={styles.spacer} />
        <Pressable
          onPress={() => setView(view === 'list' ? 'map' : 'list')}
          accessibilityRole="button"
          accessibilityLabel={view === 'list' ? 'Show map' : 'Show list'}
          style={styles.link}
        >
          <Text style={styles.linkText}>{view === 'list' ? 'Map' : 'List'}</Text>
        </Pressable>
      </View>

      {cachedAt !== null && <CachedBadge savedAt={cachedAt} reason={error} />}
      {cachedAt === null && error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}. Check the API address in Settings.
        </Text>
      )}
      {loading && <ActivityIndicator accessibilityLabel="Loading results" style={styles.loading} />}

      {view === 'map' && location.coords ? (
        <MapPane center={location.coords} items={items} onSelect={open} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FacilityRow item={item} onPress={open} />}
          ListEmptyComponent={
            !loading && !error ? <Text style={styles.empty}>No results.</Text> : undefined
          }
          accessibilityLabel="Nearest services, closest first"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  spacer: { flex: 1 },
  muted: { color: colors.textMuted, fontSize: 14 },
  link: {
    minHeight: MIN_TARGET,
    minWidth: MIN_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  linkText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  error: { color: colors.danger, padding: spacing.lg, fontSize: 15 },
  loading: { padding: spacing.md },
  empty: { padding: spacing.xl, textAlign: 'center', color: colors.textMuted },
});
