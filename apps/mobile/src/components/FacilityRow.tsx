import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LABELS, type NearbyResult } from '../api/types';
import { formatDistance } from '../lib/geo';
import { colors, MIN_TARGET, spacing } from '../theme';

interface Props {
  item: NearbyResult;
  index?: number;
  onPress: (item: NearbyResult) => void;
}

export function FacilityRow({ item, index, onPress }: Props) {
  const distance = formatDistance(item.distance_km);
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${CATEGORY_LABELS[item.category]}, ${distance} away, ${item.postcode}`}
      accessibilityHint="Opens details and directions"
      style={styles.row}
    >
      <View style={styles.main}>
        <Text style={styles.name}>
          {index !== undefined ? `[${index}] ` : ''}
          {item.name}
        </Text>
        <Text style={styles.address}>
          {item.address ? `${item.address}, ` : ''}
          {item.postcode}
        </Text>
        <Text style={styles.board}>{item.health_board}</Text>
      </View>
      <Text style={styles.distance}>{distance}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TARGET,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  main: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  address: { fontSize: 14, color: colors.textMuted },
  board: { fontSize: 13, color: colors.textMuted },
  distance: { fontSize: 16, fontWeight: '700', color: colors.primary, alignSelf: 'center' },
});
