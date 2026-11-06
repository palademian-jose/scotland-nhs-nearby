import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, ZoomControl } from 'react-leaflet';
import { View } from 'react-native';

import { formatDistance } from '../lib/geo';
import { useTheme } from '../theme';
import { SHEET_HEIGHT_PERCENT } from './mapLayout';
import type { MapPaneProps } from './MapPane';

// Marker images do not survive bundling, so draw the pins with CSS instead.
function makePin(accent: string, centre: string, selected: boolean): L.DivIcon {
  const size = selected ? 18 : 14;
  const dot = Math.round(size / 3);
  return L.divIcon({
    className: '',
    html:
      `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${accent};` +
      'border:2px solid #fff;box-shadow:0 0 0 1px rgba(15,23,42,.25);display:flex;' +
      `align-items:center;justify-content:center"><div style="width:${dot}px;height:${dot}px;` +
      `border-radius:50%;background:${centre}"></div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Minimal restyle of the stock Leaflet controls. The attribution stays visible.
const MAP_CSS = `
.nhs-map .leaflet-control-zoom { border: 1px solid #E2E8F0; box-shadow: none; border-radius: 6px; overflow: hidden; }
.nhs-map .leaflet-control-zoom a { border: none; width: 32px; height: 32px; line-height: 32px; color: #0F172A; }
.nhs-map .leaflet-control-attribution { border-radius: 6px 0 0 0; padding: 2px 8px; font-size: 11px; }
.nhs-map .leaflet-bottom { bottom: ${SHEET_HEIGHT_PERCENT}%; margin-bottom: 12px; }
.nhs-map .leaflet-popup-content-wrapper { border-radius: 8px; box-shadow: none; border: 1px solid #E2E8F0; }
.nhs-map .leaflet-popup-content { margin: 10px 12px; font-family: inherit; }
`;

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom());
  }, [map, lat, lon]);
  return null;
}

export function MapPane({ center, items, onSelect, selectedId, onHighlight }: MapPaneProps) {
  const { colors } = useTheme();
  const normal = useMemo(
    () => makePin(colors.accent, colors.onAccent, false),
    [colors.accent, colors.onAccent],
  );
  const selected = useMemo(
    () => makePin(colors.accent, colors.onAccent, true),
    [colors.accent, colors.onAccent],
  );
  return (
    <View style={{ flex: 1 }} accessibilityLabel="Map of nearby results">
      <style>{MAP_CSS}</style>
      <MapContainer
        className="nhs-map"
        center={[center.lat, center.lon]}
        zoom={12}
        zoomControl={false}
        style={{ height: '100%', width: '100%', minHeight: 240 }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <ZoomControl position="bottomright" />
        <Recenter lat={center.lat} lon={center.lon} />
        {items.map((item) => (
          <Marker
            key={item.id}
            position={[item.lat, item.lon]}
            icon={item.id === selectedId ? selected : normal}
            zIndexOffset={item.id === selectedId ? 1000 : 0}
            title={item.name}
            eventHandlers={{ click: () => onHighlight?.(item.id) }}
          >
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
