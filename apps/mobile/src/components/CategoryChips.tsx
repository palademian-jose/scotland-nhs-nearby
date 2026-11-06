import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { CATEGORIES, CATEGORY_LABELS, type Category } from '../api/types';
import { radii, useTheme } from '../theme';
import { CATEGORY_ICONS } from './categoryIcons';
import { GUTTER } from './ui';

interface Props {
  selected: Category;
  onSelect: (category: Category) => void;
}

export function CategoryChips({ selected, onSelect }: Props) {
  const { colors, type } = useTheme();
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
            hitSlop={6}
            accessibilityRole="tab"
            accessibilityLabel={CATEGORY_LABELS[category]}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? colors.accentSoft : 'transparent',
                borderColor: active ? 'transparent' : colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name={CATEGORY_ICONS[category]} size={14} color={fg} />
            <Text
              style={[type.body, { fontSize: 14, color: fg, fontWeight: active ? '600' : '400' }]}
            >
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
  row: { paddingHorizontal: GUTTER, gap: 6 },
  chip: {
    height: 32,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pressed: { opacity: 0.7 },
});
