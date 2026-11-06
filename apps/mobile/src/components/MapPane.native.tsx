import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';

import { formatDistance } from '../lib/geo';
import { useTheme } from '../theme';
import type { MapPaneProps } from './MapPane';

export function MapPane({ center, items, onSelect, selectedId, onHighlight }: MapPaneProps) {
  const { colors, scheme } = useTheme();
  return (
    <View style={styles.box} accessibilityLabel="Map of nearby results">
      <MapView
        style={styles.map}
        userInterfaceStyle={scheme}
        initialRegion={{
          latitude: center.lat,
          longitude: center.lon,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        showsUserLocation
      >
        {items.map((item) => {
          const size = item.id === selectedId ? 18 : 14;
          return (
            <Marker
              key={`${item.id}-${size}`}
              coordinate={{ latitude: item.lat, longitude: item.lon }}
              title={item.name}
              description={`${formatDistance(item.distance_km)} - ${item.postcode}`}
              onPress={() => onHighlight?.(item.id)}
              onCalloutPress={() => onSelect(item)}
              tracksViewChanges={false}
            >
              <View
                style={[
                  styles.pin,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: colors.accent,
                  },
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      width: size / 3,
                      height: size / 3,
                      borderRadius: size / 6,
                      backgroundColor: colors.onAccent,
                    },
                  ]}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },
  map: { flex: 1 },
  pin: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  dot: {},
});
