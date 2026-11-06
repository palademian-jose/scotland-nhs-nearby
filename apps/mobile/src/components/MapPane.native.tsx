import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';

import { formatDistance } from '../lib/geo';
import type { MapPaneProps } from './MapPane';

export function MapPane({ center, items, onSelect }: MapPaneProps) {
  return (
    <View style={styles.box} accessibilityLabel="Map of nearby results">
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: center.lat,
          longitude: center.lon,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        showsUserLocation
      >
        {items.map((item) => (
          <Marker
            key={item.id}
            coordinate={{ latitude: item.lat, longitude: item.lon }}
            title={item.name}
            description={`${formatDistance(item.distance_km)} - ${item.postcode}`}
            onCalloutPress={() => onSelect(item)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, minHeight: 320 },
  map: { flex: 1 },
});
