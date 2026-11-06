import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TARGET, useTheme } from '../theme';

interface Option<T extends string> {
  value: T;
  label: string;
  accessibilityLabel: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Soft toggle with two or more options, for example List | Map. */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors, radii, shadow, type } = useTheme();
  return (
    <View
      style={[styles.track, { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill }]}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityLabel={option.accessibilityLabel}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.option,
              { borderRadius: radii.pill },
              active && [{ backgroundColor: colors.surface }, shadow],
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                type.body,
                {
                  color: active ? colors.text : colors.textSecondary,
                  fontWeight: active ? '600' : '400',
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 4, alignSelf: 'flex-start' },
  option: {
    minHeight: MIN_TARGET,
    minWidth: 76,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
