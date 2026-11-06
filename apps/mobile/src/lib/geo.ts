import { Platform } from 'react-native';

import type { Coords } from '../api/types';

const EARTH_RADIUS_KM = 6371.0088;

export function haversineKm(a: Coords, b: Coords): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

const POSTCODE = /^([A-Z]{1,2}[0-9][A-Z0-9]?)\s*([0-9][A-Z]{2})$/i;

/** "eh89yl" -> "EH8 9YL"; null when the text is not a full UK postcode. */
export function normalisePostcode(raw: string): string | null {
  const match = POSTCODE.exec(raw.trim());
  if (!match || !match[1] || !match[2]) {
    return null;
  }
  return `${match[1].toUpperCase()} ${match[2].toUpperCase()}`;
}

/** Link that opens the platform maps app with directions to a place. */
export function directionsUrl(
  target: { lat: number; lon: number; name: string },
  platform: string = Platform.OS,
): string {
  const label = encodeURIComponent(target.name);
  const point = `${target.lat},${target.lon}`;
  if (platform === 'ios') {
    return `http://maps.apple.com/?daddr=${point}&q=${label}`;
  }
  if (platform === 'android') {
    return `geo:0,0?q=${point}(${label})`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${point}`;
}
