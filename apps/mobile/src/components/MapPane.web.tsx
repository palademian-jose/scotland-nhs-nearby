import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { View } from 'react-native';

import { formatDistance } from '../lib/geo';
import type { MapPaneProps } from './MapPane';

// Marker images do not survive bundling, so draw the pins with CSS instead.
const pin = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#005EB8;border:3px solid #fff;box-shadow:0 0 3px #000"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom());
  }, [map, lat, lon]);
  return null;
}

export function MapPane({ center, items, onSelect }: MapPaneProps) {
  return (
    <View style={{ flex: 1, minHeight: 320 }} accessibilityLabel="Map of nearby results">
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={12}
        style={{ height: '100%', width: '100%', minHeight: 320 }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <Recenter lat={center.lat} lon={center.lon} />
        {items.map((item) => (
          <Marker key={item.id} position={[item.lat, item.lon]} icon={pin} title={item.name}>
            <Popup>
              <strong>{item.name}</strong>
              <br />
              {formatDistance(item.distance_km)} - {item.postcode}
              <br />
              <a
                href="#details"
                onClick={(event) => {
                  event.preventDefault();
                  onSelect(item);
                }}
              >
                Details and directions
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </View>
  );
}
