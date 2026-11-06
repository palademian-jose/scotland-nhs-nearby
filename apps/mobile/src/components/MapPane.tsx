import { StyleSheet, Text, View } from 'react-native';

import type { Coords, NearbyResult } from '../api/types';
import { colors, spacing } from '../theme';

export interface MapPaneProps {
  center: Coords;
  items: NearbyResult[];
  onSelect: (item: NearbyResult) => void;
}

/**
 * Fallback for platforms with no map implementation. Metro picks MapPane.native.tsx on iOS and
 * Android (react-native-maps) and MapPane.web.tsx on the web (react-leaflet + OpenStreetMap).
 */
export function MapPane(_props: MapPaneProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>Map is not available on this platform.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: spacing.xl, alignItems: 'center' },
  text: { color: colors.textMuted },
});
