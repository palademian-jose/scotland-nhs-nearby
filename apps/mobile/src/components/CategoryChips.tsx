import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { CATEGORIES, CATEGORY_LABELS, type Category } from '../api/types';
import { MIN_TARGET, useTheme } from '../theme';
import { CATEGORY_ICONS } from './categoryIcons';
import { GUTTER } from './ui';

interface Props {
  selected: Category;
  onSelect: (category: Category) => void;
}

export function CategoryChips({ selected, onSelect }: Props) {
  const { colors, radii, type } = useTheme();
  return (
    <ScrollView
      horizontal
      style={styles.scroll}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
      accessibilityLabel="Service type"
    >
      {CATEGORIES.map((category) => {
        const active = category === selected;
        const fg = active ? colors.accent : colors.textSecondary;
        return (
          <Pressable
            key={category}
            onPress={() => onSelect(category)}
            accessibilityRole="tab"
            accessibilityLabel={CATEGORY_LABELS[category]}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.chip,
              {
                borderRadius: radii.pill,
                backgroundColor: active ? colors.accentSoft : colors.surfaceMuted,
              },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name={CATEGORY_ICONS[category]} size={16} color={fg} />
            <Text style={[type.body, { color: fg, fontWeight: active ? '600' : '400' }]}>
              {CATEGORY_LABELS[category]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { paddingHorizontal: GUTTER, paddingVertical: 4, gap: 8 },
  chip: {
    minHeight: MIN_TARGET,
    minWidth: MIN_TARGET,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pressed: { opacity: 0.7 },
});
