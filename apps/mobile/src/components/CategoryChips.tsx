import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { CATEGORIES, CATEGORY_LABELS, type Category } from '../api/types';
import { colors, MIN_TARGET, spacing } from '../theme';

interface Props {
  selected: Category;
  onSelect: (category: Category) => void;
}

export function CategoryChips({ selected, onSelect }: Props) {
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
        return (
          <Pressable
            key={category}
            onPress={() => onSelect(category)}
            accessibilityRole="tab"
            accessibilityLabel={CATEGORY_LABELS[category]}
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
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
  row: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  chip: {
    minHeight: MIN_TARGET,
    minWidth: MIN_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: MIN_TARGET / 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { color: colors.text, fontSize: 16, fontWeight: '600' },
  labelActive: { color: colors.onPrimary },
});
