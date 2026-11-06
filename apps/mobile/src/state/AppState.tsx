import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ApiClient } from '../api/client';
import type { Coords } from '../api/types';
import { DEFAULT_API_URL, STORAGE_KEYS } from '../config';
import { normalisePostcode } from '../lib/geo';

export type LocationStatus = 'loading' | 'gps' | 'manual' | 'needs_postcode';

export interface UserLocation {
  status: LocationStatus;
  coords: Coords | null;
  label: string;
  /** Last problem worth telling the user about (permission denied, unknown postcode, ...). */
  message: string | null;
}

interface AppState {
  apiUrl: string;
  setApiUrl: (url: string) => Promise<void>;
  client: ApiClient;
  location: UserLocation;
  retryGps: () => Promise<void>;
  setManualPostcode: (postcode: string) => Promise<boolean>;
}

const INITIAL: UserLocation = { status: 'loading', coords: null, label: '', message: null };

const Context = createContext<AppState | null>(null);

async function readStored(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [apiUrl, setApiUrlState] = useState(DEFAULT_API_URL);
  const [location, setLocation] = useState<UserLocation>(INITIAL);
  const client = useMemo(() => new ApiClient(apiUrl), [apiUrl]);

  const acquireGps = useCallback(async (): Promise<boolean> => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        return false;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        status: 'gps',
        coords: { lat: position.coords.latitude, lon: position.coords.longitude },
        label: 'Your location',
        message: null,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const setManualPostcode = useCallback(
    async (input: string): Promise<boolean> => {
      const postcode = normalisePostcode(input);
      if (!postcode) {
        setLocation((prev) => ({
          ...prev,
          status: prev.coords ? prev.status : 'needs_postcode',
          message: 'Enter a full postcode, for example EH8 9YL.',
        }));
        return false;
      }
      try {
        const place = await client.resolve(postcode);
        setLocation({
          status: 'manual',
          coords: { lat: place.lat, lon: place.lon },
          label: place.via === 'postcode_district' ? `${postcode} (approximate)` : postcode,
          message: null,
        });
        await AsyncStorage.setItem(STORAGE_KEYS.manualPostcode, postcode).catch(() => undefined);
        return true;
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Lookup failed';
        setLocation((prev) => ({
          ...prev,
          status: prev.coords ? prev.status : 'needs_postcode',
          message: `Could not find that postcode (${reason}).`,
        }));
        return false;
      }
    },
    [client],
  );

  const retryGps = useCallback(async () => {
    setLocation((prev) => ({ ...prev, status: 'loading' }));
    const ok = await acquireGps();
    if (!ok) {
      setLocation({
        status: 'needs_postcode',
        coords: null,
        label: '',
        message: 'Location permission is off. Enter a postcode instead.',
      });
    }
  }, [acquireGps]);

  const setApiUrl = useCallback(async (url: string) => {
    setApiUrlState(url.trim());
    await AsyncStorage.setItem(STORAGE_KEYS.apiUrl, url.trim()).catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storedUrl = await readStored(STORAGE_KEYS.apiUrl);
      if (storedUrl && !cancelled) {
        setApiUrlState(storedUrl);
      }
      const gps = await acquireGps();
      if (gps || cancelled) {
        return;
      }
      const stored = await readStored(STORAGE_KEYS.manualPostcode);
      if (stored) {
        const tempClient = new ApiClient(storedUrl ?? DEFAULT_API_URL);
        try {
          const place = await tempClient.resolve(stored);
          if (!cancelled) {
            setLocation({
              status: 'manual',
              coords: { lat: place.lat, lon: place.lon },
              label: stored,
              message: null,
            });
          }
          return;
        } catch {
          // fall through to asking again
        }
      }
      if (!cancelled) {
        setLocation({
          status: 'needs_postcode',
          coords: null,
          label: '',
          message: 'Location permission is off. Enter a postcode to search from.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [acquireGps]);

  const value = useMemo<AppState>(
    () => ({ apiUrl, setApiUrl, client, location, retryGps, setManualPostcode }),
    [apiUrl, setApiUrl, client, location, retryGps, setManualPostcode],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp(): AppState {
  const value = useContext(Context);
  if (!value) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return value;
}
