import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode } from 'react';
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MIN_TARGET, useTheme } from '../theme';

export type IconName = keyof typeof Ionicons.glyphMap;

/** Horizontal page gutter used by every screen. */
export const GUTTER = 20;

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

export function Card({ children, style }: CardProps) {
  const { colors, radii, shadow } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: colors.surface, borderRadius: radii.lg, padding: 16 },
        shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  icon?: IconName;
  variant?: 'primary' | 'soft';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Pill button. "primary" is a solid accent fill, "soft" is a quiet tinted fill. */
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
  const { colors, radii, type } = useTheme();
  const primary = variant === 'primary';
  const fg = primary ? colors.onAccent : colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, busy }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? colors.accent : colors.accentSoft,
          borderRadius: radii.pill,
        },
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[type.body, { color: fg, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

interface BadgeProps {
  children: string;
  tone?: 'accent' | 'muted';
}

/** Small rounded label: the distance badge ("accent") or the health board tag ("muted"). */
export function Badge({ children, tone = 'accent' }: BadgeProps) {
  const { colors, radii, type } = useTheme();
  const accent = tone === 'accent';
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: accent ? colors.accentSoft : colors.surfaceMuted,
          borderRadius: radii.pill,
        },
      ]}
    >
      <Text
        style={[
          type.label,
          {
            color: accent ? colors.accent : colors.textSecondary,
            fontWeight: accent ? '600' : '500',
          },
        ]}
      >
        {children}
      </Text>
    </View>
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
        <Ionicons name={icon} size={28} color={colors.accent} />
      </View>
      <Text style={[type.body, styles.emptyText, { color: colors.textSecondary }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="soft" onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 16, gap: 4 },
  button: {
    minHeight: MIN_TARGET,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  empty: { alignItems: 'center', gap: 12, padding: 32 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { textAlign: 'center' },
});
