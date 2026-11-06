import { Platform } from 'react-native';

// Android emulators reach the host machine at 10.0.2.2, not localhost.
const LOCAL_DEFAULT = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';

export const DEFAULT_API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? LOCAL_DEFAULT;

export const STORAGE_KEYS = {
  apiUrl: 'nhs.apiUrl',
  manualPostcode: 'nhs.manualPostcode',
  nearbyCache: 'nhs.cache.nearby',
  askCache: 'nhs.cache.ask',
} as const;

export const NEARBY_LIMIT = 10;
