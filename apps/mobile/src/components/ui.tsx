import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, type Palette, radii, useTheme } from '../theme';

export type IconName = keyof typeof Ionicons.glyphMap;

/** Horizontal page gutter used by every screen. */
export const GUTTER = layout.gutter;

/** Height of small controls (buttons, chips). A hit slop lifts their touch target to 44. */
export const CONTROL_HEIGHT = 36;
export const SLOP_Y = 4;

interface ScreenProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Page background with the top safe area applied. Tab screens have no header bar. */
export function Screen({ children, style }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }, style]}>
      {children}
    </View>
  );
}

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
}

export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.header}>
      <Text style={[type.display, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? (
        <Text style={[type.body, { color: colors.textSecondary }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Flat surface with a 1px outline. */
export function Card({ children, style }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radii.lg,
          padding: layout.cardPadding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type RowPosition = 'only' | 'first' | 'middle' | 'last';

export function rowPosition(index: number, count: number): RowPosition {
  if (count <= 1) {
    return 'only';
  }
  return index === 0 ? 'first' : index === count - 1 ? 'last' : 'middle';
}

/** Style for one row of a grouped list: one outlined surface split by 1px hairlines. */
export function groupRowStyle(position: RowPosition, colors: Palette): ViewStyle {
  const top = position === 'only' || position === 'first';
  const bottom = position === 'only' || position === 'last';
  return {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderTopWidth: top ? 1 : 0,
    borderTopLeftRadius: top ? radii.lg : 0,
    borderTopRightRadius: top ? radii.lg : 0,
    borderBottomLeftRadius: bottom ? radii.lg : 0,
    borderBottomRightRadius: bottom ? radii.lg : 0,
  };
}

/** Border colour for an input: the quiet outline, or the strong one while focused. */
export function useFocusBorder() {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return {
    borderColor: focused ? colors.borderStrong : colors.border,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  icon?: IconName;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** 36px button. "primary" is a solid accent fill, "outline" a 1px outline with accent text. */
export function Button({
  label,
  onPress,
  accessibilityLabel,
  icon,
  variant = 'primary',
  disabled = false,
  busy = false,
  style,
}: ButtonProps) {
  const { colors, type } = useTheme();
  const primary = variant === 'primary';
  const fg = primary ? colors.onAccent : colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: SLOP_Y, bottom: SLOP_Y }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, busy }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? colors.accent : 'transparent',
          borderColor: primary ? colors.accent : colors.border,
        },
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      <Text style={[type.body, { color: fg, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

interface EmptyStateProps {
  icon: IconName;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, message, actionLabel, onAction }: EmptyStateProps) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={icon} size={22} color={colors.accent} />
      </View>
      <Text style={[type.body, styles.emptyText, { color: colors.textSecondary }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="outline" onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 12, gap: 2 },
  button: {
    height: CONTROL_HEIGHT,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  empty: { alignItems: 'center', gap: 12, padding: 24 },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { textAlign: 'center' },
});
