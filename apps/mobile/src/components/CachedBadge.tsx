import { StyleSheet, Text, View } from 'react-native';

import { describeAge } from '../storage/cache';
import { colors, spacing } from '../theme';

interface Props {
  savedAt: number;
  reason?: string | null;
}

export function CachedBadge({ savedAt, reason }: Props) {
  const age = describeAge(savedAt);
  return (
    <View
      style={styles.box}
      accessibilityRole="alert"
      accessibilityLabel={`Showing saved results from ${age}. ${reason ?? ''}`}
    >
      <Text style={styles.badge}>cached</Text>
      <Text style={styles.text}>
        Saved {age}. {reason ?? 'You may be offline.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.warningBg,
  },
  badge: {
    color: colors.onPrimary,
    backgroundColor: colors.warningText,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  text: { flex: 1, color: colors.warningText, fontSize: 14 },
});
