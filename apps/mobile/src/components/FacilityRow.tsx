import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LABELS, type NearbyResult } from '../api/types';
import { formatDistance } from '../lib/geo';
import { MIN_TARGET, useTheme } from '../theme';
import { Badge } from './ui';

interface Props {
  item: NearbyResult;
  /** Citation number, shown in a small accent circle (Ask results). */
  index?: number;
  /** Outlines the card, used when its marker is selected on the map. */
  selected?: boolean;
  onPress: (item: NearbyResult) => void;
}

/** One result as a card: name, address, health board tag and a distance badge. */
export function FacilityRow({ item, index, selected = false, onPress }: Props) {
  const { colors, radii, shadow, type } = useTheme();
  const distance = formatDistance(item.distance_km);
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${CATEGORY_LABELS[item.category]}, ${distance} away, ${item.postcode}`}
      accessibilityHint="Opens details and directions"
      style={({ pressed }) => [
        styles.card,
        shadow,
        {
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderColor: selected ? colors.accent : 'transparent',
        },
        pressed && styles.pressed,
      ]}
    >
      {index !== undefined && (
        <View style={[styles.index, { backgroundColor: colors.accent }]}>
          <Text style={[type.label, { color: colors.onAccent, fontWeight: '600' }]}>{index}</Text>
        </View>
      )}
      <View style={styles.main}>
        <Text style={[type.body, styles.name, { color: colors.text }]}>{item.name}</Text>
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {item.address ? `${item.address}, ` : ''}
          {item.postcode}
        </Text>
        <View style={styles.board}>
          <Badge tone="muted">{item.health_board}</Badge>
        </View>
      </View>
      <Badge>{distance}</Badge>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: MIN_TARGET,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderWidth: 1.5,
  },
  pressed: { opacity: 0.7 },
  index: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  main: { flex: 1, gap: 2 },
  name: { fontWeight: '600' },
  board: { marginTop: 6 },
});
