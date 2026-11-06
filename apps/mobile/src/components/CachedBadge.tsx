import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { describeAge } from '../storage/cache';
import { useTheme } from '../theme';
import { GUTTER } from './ui';

interface Props {
  savedAt: number;
  reason?: string | null;
}

export function CachedBadge({ savedAt, reason }: Props) {
  const { colors, radii, type } = useTheme();
  const age = describeAge(savedAt);
  return (
    <View
      style={[styles.box, { backgroundColor: colors.warningBg, borderRadius: radii.md }]}
      accessibilityRole="alert"
      accessibilityLabel={`Showing saved results from ${age}. ${reason ?? ''}`}
    >
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warningText} />
      <Text style={[type.label, styles.badge, { color: colors.warningText }]}>cached</Text>
      <Text style={[type.caption, styles.text, { color: colors.warningText }]}>
        Saved {age}. {reason ?? 'You may be offline.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginHorizontal: GUTTER,
    marginBottom: 12,
  },
  badge: { fontWeight: '700' },
  text: { flex: 1 },
});
