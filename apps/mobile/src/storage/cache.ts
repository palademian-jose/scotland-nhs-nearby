import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheEntry<T> {
  savedAt: number;
  value: T;
}

/** Last-good results, so the app still shows something when the network or API is down. */
export async function saveCache<T>(key: string, value: T, now: number = Date.now()): Promise<void> {
  try {
    const entry: CacheEntry<T> = { savedAt: now, value };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // a full or unavailable store must never break the screen
  }
}

export async function loadCache<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'savedAt' in parsed && 'value' in parsed) {
      return parsed as CacheEntry<T>;
    }
    return null;
  } catch {
    return null;
  }
}

export function describeAge(savedAt: number, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - savedAt) / 60000));
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours} h ago`;
  }
  return `${Math.round(hours / 24)} days ago`;
}
