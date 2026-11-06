import { useEffect, useState } from 'react';

import type { ApiClient } from '../api/client';
import type { Category, Coords, NearbyResult } from '../api/types';
import { NEARBY_LIMIT, STORAGE_KEYS } from '../config';
import { loadCache, saveCache } from '../storage/cache';

export interface NearbyState {
  items: NearbyResult[];
  loading: boolean;
  error: string | null;
  /** Set when the items come from the offline cache rather than the server. */
  cachedAt: number | null;
}

type CacheMap = Partial<Record<Category, { coords: Coords; items: NearbyResult[] }>>;

interface Settled {
  key: string;
  items: NearbyResult[];
  error: string | null;
  cachedAt: number | null;
}

const IDLE: NearbyState = { items: [], loading: false, error: null, cachedAt: null };

export function useNearby(
  client: ApiClient,
  coords: Coords | null,
  category: Category,
): NearbyState {
  const [settled, setSettled] = useState<Settled | null>(null);
  const lat = coords?.lat;
  const lon = coords?.lon;
  const key =
    lat === undefined || lon === undefined ? null : `${client.baseUrl}|${category}|${lat}|${lon}`;

  useEffect(() => {
    if (lat === undefined || lon === undefined || key === null) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await client.nearby({ lat, lon }, category, NEARBY_LIMIT);
        if (cancelled) {
          return;
        }
        setSettled({ key, items: response.results, error: null, cachedAt: null });
        const entry = await loadCache<CacheMap>(STORAGE_KEYS.nearbyCache);
        const map: CacheMap = entry?.value ?? {};
        map[category] = { coords: { lat, lon }, items: response.results };
        await saveCache(STORAGE_KEYS.nearbyCache, map);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed';
        const entry = await loadCache<CacheMap>(STORAGE_KEYS.nearbyCache);
        if (cancelled) {
          return;
        }
        const saved = entry?.value[category];
        setSettled({
          key,
          items: saved ? saved.items : [],
          error: message,
          cachedAt: saved && entry ? entry.savedAt : null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, lat, lon, category, key]);

  if (key === null) {
    return IDLE;
  }
  if (settled === null || settled.key !== key) {
    return { items: [], loading: true, error: null, cachedAt: null };
  }
  return { items: settled.items, loading: false, error: settled.error, cachedAt: settled.cachedAt };
}
