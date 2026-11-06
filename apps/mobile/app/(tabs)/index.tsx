import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Category, NearbyResult } from '../../src/api/types';
import { CachedBadge } from '../../src/components/CachedBadge';
import { CategoryChips } from '../../src/components/CategoryChips';
import { FacilityRow } from '../../src/components/FacilityRow';
import { MapPane } from '../../src/components/MapPane';
import { SHEET_HEIGHT_PERCENT } from '../../src/components/mapLayout';
import { PostcodeForm } from '../../src/components/PostcodeForm';
import { SegmentedControl } from '../../src/components/SegmentedControl';
import { SkeletonList } from '../../src/components/Skeleton';
import { EmptyState, GUTTER, Screen, ScreenHeader } from '../../src/components/ui';
import { useNearby } from '../../src/hooks/useNearby';
import { useApp } from '../../src/state/AppState';
import { MIN_TARGET, useTheme } from '../../src/theme';

type ViewMode = 'list' | 'map';

const VIEW_OPTIONS = [
  { value: 'list' as const, label: 'List', accessibilityLabel: 'Show list' },
  { value: 'map' as const, label: 'Map', accessibilityLabel: 'Show map' },
];

export default function NearbyScreen() {
  const router = useRouter();
  const { colors, radii, shadow, type } = useTheme();
  const insets = useSafeAreaInsets();
  const { client, location, setManualPostcode, retryGps } = useApp();
  const [category, setCategory] = useState<Category>('pharmacy');
  const [view, setView] = useState<ViewMode>('list');
  const [changing, setChanging] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const { items, loading, error, cachedAt } = useNearby(client, location.coords, category);

  const open = (item: NearbyResult) =>
    router.push({
      pathname: '/facility/[id]',
      params: { id: item.id, data: JSON.stringify(item) },
    });

  if (location.status === 'loading') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator accessibilityLabel="Finding your location" color={colors.accent} />
          <Text style={[type.body, { color: colors.textSecondary }]}>Finding your location...</Text>
        </View>
      </Screen>
    );
  }

  if (location.status === 'needs_postcode' || changing) {
    return (
      <Screen>
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
      </Screen>
    );
  }

  const approximate = /\(approximate\)$/i.test(location.label);
  const placeName = location.label.replace(/\s*\(approximate\)$/i, '');
  const mapMode = view === 'map' && location.coords !== null;

  const locationPill = (
    <View style={styles.pillRow}>
      <Pressable
        onPress={() => setChanging(true)}
        accessibilityRole="button"
        accessibilityLabel="Change search location"
        accessibilityHint={`Searching from ${location.label}`}
        style={({ pressed }) => [
          styles.pill,
          shadow,
          { backgroundColor: colors.surface, borderRadius: radii.pill },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="location" size={18} color={colors.accent} />
        <Text style={[type.body, styles.pillText, { color: colors.text }]} numberOfLines={1}>
          {placeName}
        </Text>
        {approximate && (
          <View style={styles.approx}>
            <View style={[styles.dot, { backgroundColor: colors.warningText }]} />
            <Text style={[type.caption, { color: colors.textSecondary }]}>approximate</Text>
          </View>
        )}
        <View style={styles.flex} />
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>
      {location.status === 'manual' && (
        <Pressable
          onPress={retryGps}
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          style={({ pressed }) => [
            styles.gps,
            shadow,
            { backgroundColor: colors.surface },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="navigate" size={20} color={colors.accent} />
        </Pressable>
      )}
    </View>
  );

  const selectors = (
    <>
      <CategoryChips selected={category} onSelect={setCategory} />
      <View style={styles.segment}>
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
      </View>
    </>
  );

  const status: ReactNode = (
    <>
      {cachedAt !== null && <CachedBadge savedAt={cachedAt} reason={error} />}
      {cachedAt === null && error && (
        <Text style={[type.body, styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {error}. Check the API address in Settings.
        </Text>
      )}
    </>
  );

  const empty =
    loading && items.length === 0 ? (
      <View style={styles.gutter}>
        <SkeletonList count={4} />
      </View>
    ) : !loading && !error ? (
      <EmptyState
        icon="search"
        message="No results"
        actionLabel="Try another location"
        onAction={() => setChanging(true)}
      />
    ) : undefined;

  if (mapMode && location.coords) {
    return (
      <Screen>
        <View style={StyleSheet.absoluteFill}>
          <MapPane
            center={location.coords}
            items={items}
            onSelect={open}
            selectedId={highlighted}
            onHighlight={setHighlighted}
          />
        </View>
        <View pointerEvents="box-none" style={[styles.floating, { paddingTop: insets.top + 8 }]}>
          {locationPill}
          {selectors}
          {status}
        </View>
        <View
          style={[
            styles.sheet,
            shadow,
            {
              backgroundColor: colors.background,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              height: `${SHEET_HEIGHT_PERCENT}%`,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <FacilityRow item={item} selected={item.id === highlighted} onPress={open} />
            )}
            ItemSeparatorComponent={Gap}
            ListEmptyComponent={empty}
            contentContainerStyle={styles.sheetList}
            accessibilityLabel="Nearest services, closest first"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.gutter}>
            <FacilityRow item={item} onPress={open} />
          </View>
        )}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={
          <>
            <ScreenHeader title="Nearby" subtitle="The closest NHS services, nearest first" />
            {locationPill}
            {selectors}
            {status}
          </>
        }
        ListEmptyComponent={empty}
        contentContainerStyle={styles.list}
        accessibilityLabel="Nearest services, closest first"
      />
    </Screen>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  gutter: { paddingHorizontal: GUTTER },
  list: { paddingBottom: 24 },
  gap: { height: 12 },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: GUTTER,
    paddingTop: 8,
    paddingBottom: 12,
  },
  pill: {
    flex: 1,
    minHeight: MIN_TARGET + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  pillText: { flexShrink: 1, fontWeight: '500' },
  approx: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  gps: {
    width: MIN_TARGET + 4,
    height: MIN_TARGET + 4,
    borderRadius: (MIN_TARGET + 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 16 },
  error: { paddingHorizontal: GUTTER, paddingBottom: 12 },
  pressed: { opacity: 0.7 },
  floating: { position: 'absolute', top: 0, left: 0, right: 0 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginVertical: 10 },
  sheetList: { paddingHorizontal: GUTTER, paddingBottom: 16 },
});
