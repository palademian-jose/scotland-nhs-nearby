import AsyncStorage from '@react-native-async-storage/async-storage';

import { describeAge, loadCache, saveCache } from '../src/storage/cache';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('cache', () => {
  it('round-trips a value with its save time', async () => {
    await saveCache('k', { a: 1 }, 1000);
    expect(await loadCache<{ a: number }>('k')).toEqual({ savedAt: 1000, value: { a: 1 } });
  });

  it('returns null for missing or corrupt entries', async () => {
    expect(await loadCache('missing')).toBeNull();
    await AsyncStorage.setItem('bad', '{not json');
    expect(await loadCache('bad')).toBeNull();
    await AsyncStorage.setItem('odd', JSON.stringify({ hello: 1 }));
    expect(await loadCache('odd')).toBeNull();
  });

  it('never throws when storage fails', async () => {
    const spy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    await expect(saveCache('k', 1)).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it('describes the age in plain words', () => {
    const now = 10_000_000_000;
    expect(describeAge(now - 20_000, now)).toBe('just now');
    expect(describeAge(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(describeAge(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(describeAge(now - 72 * 3_600_000, now)).toBe('3 days ago');
  });
});
