import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, useTheme } from '../theme';

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

/** Soft toggle with two or more options, for example List | Map. 32px tall. */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors, type } = useTheme();
  return (
    <View
      style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="tab"
            accessibilityLabel={option.accessibilityLabel}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: active ? colors.surface : 'transparent',
                borderColor: active ? colors.border : 'transparent',
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                type.body,
                {
                  fontSize: 14,
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
  track: { flexDirection: 'row', padding: 2, alignSelf: 'flex-start', borderRadius: radii.lg },
  option: {
    height: 28,
    minWidth: 64,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
