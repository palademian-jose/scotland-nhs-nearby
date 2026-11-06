import { directionsUrl, formatDistance, haversineKm, normalisePostcode } from '../src/lib/geo';

describe('geo helpers', () => {
  it('computes Edinburgh to Glasgow as about 67 km', () => {
    const km = haversineKm({ lat: 55.9533, lon: -3.1883 }, { lat: 55.8642, lon: -4.2518 });
    expect(km).toBeGreaterThan(66);
    expect(km).toBeLessThan(68);
  });

  it('formats short distances in metres and long ones in km', () => {
    expect(formatDistance(0.43)).toBe('430 m');
    expect(formatDistance(1.26)).toBe('1.3 km');
  });

  it.each([
    ['eh89yl', 'EH8 9YL'],
    [' AB10 1QN ', 'AB10 1QN'],
    ['g1 1aa', 'G1 1AA'],
  ])('normalises %s', (input, expected) => {
    expect(normalisePostcode(input)).toBe(expected);
  });

  it.each(['', 'EH8', 'hello world', '12345'])('rejects %j', (input) => {
    expect(normalisePostcode(input)).toBeNull();
  });

  it('builds a maps link per platform', () => {
    const target = { lat: 55.97, lon: -3.17, name: 'Leith Pharmacy' };
    expect(directionsUrl(target, 'ios')).toBe(
      'http://maps.apple.com/?daddr=55.97,-3.17&q=Leith%20Pharmacy',
    );
    expect(directionsUrl(target, 'android')).toBe('geo:0,0?q=55.97,-3.17(Leith%20Pharmacy)');
    expect(directionsUrl(target, 'web')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=55.97,-3.17',
    );
  });
});
