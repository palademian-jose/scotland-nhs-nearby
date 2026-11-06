import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LABELS, type NearbyResult } from '../api/types';
import { formatDistance } from '../lib/geo';
import { layout, useTheme } from '../theme';
import { groupRowStyle, type RowPosition } from './ui';

interface Props {
  item: NearbyResult;
  /** Citation number, shown in a small accent circle (Ask results). */
  index?: number;
  /** Highlights the row, used when its marker is selected on the map. */
  selected?: boolean;
  /** Place of the row in a grouped list, which decides its borders and corners. */
  position?: RowPosition;
  onPress: (item: NearbyResult) => void;
}

/** One result as a row of a grouped list: name, distance, then address and health board. */
export function FacilityRow({ item, index, selected = false, position = 'only', onPress }: Props) {
  const { colors, type } = useTheme();
  const distance = formatDistance(item.distance_km);
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${CATEGORY_LABELS[item.category]}, ${distance} away, ${item.postcode}`}
      accessibilityHint="Opens details and directions"
      style={({ pressed }) => [
        styles.row,
        groupRowStyle(position, colors),
        selected && { backgroundColor: colors.surfaceMuted },
        pressed && styles.pressed,
      ]}
    >
      {index !== undefined && (
        <View style={[styles.index, { backgroundColor: colors.accent }]}>
          <Text style={[type.label, { color: colors.onAccent, fontWeight: '600' }]}>{index}</Text>
        </View>
      )}
      <View style={styles.main}>
        <View style={styles.top}>
          <Text style={[type.title, styles.name, { color: colors.text }]}>{item.name}</Text>
          <Text style={[type.body, styles.distance, { color: colors.accent }]}>{distance}</Text>
        </View>
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {item.address ? `${item.address}, ` : ''}
          {item.postcode} · {item.health_board}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: layout.cardPadding,
  },
  pressed: { opacity: 0.7 },
  index: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { flex: 1 },
  distance: { fontSize: 14, fontWeight: '500', fontVariant: ['tabular-nums'], textAlign: 'right' },
});
