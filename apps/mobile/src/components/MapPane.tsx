import { StyleSheet, Text, View } from 'react-native';

import type { Coords, NearbyResult } from '../api/types';
import { useTheme } from '../theme';

export interface MapPaneProps {
  center: Coords;
  items: NearbyResult[];
  onSelect: (item: NearbyResult) => void;
  /** Id of the highlighted marker, drawn larger than the others. */
  selectedId?: string | null;
  /** Called when a marker is tapped, before its details are opened. */
  onHighlight?: (id: string) => void;
}

/**
 * Fallback for platforms with no map implementation. Metro picks MapPane.native.tsx on iOS and
 * Android (react-native-maps) and MapPane.web.tsx on the web (react-leaflet + OpenStreetMap).
 */
export function MapPane(_props: MapPaneProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.box}>
      <Text style={{ color: colors.textSecondary }}>Map is not available on this platform.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 24, alignItems: 'center' },
});
