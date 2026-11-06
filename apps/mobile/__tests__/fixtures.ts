import type { AskResponse, NearbyResult } from '../src/api/types';

export const PHARMACY: NearbyResult = {
  id: 'ph-1',
  category: 'pharmacy',
  name: 'Leith Pharmacy',
  address: '1 Leith Walk, Edinburgh',
  postcode: 'EH6 5AA',
  phone: '0131 555 0100',
  health_board: 'NHS Lothian',
  lat: 55.97,
  lon: -3.17,
  source_dataset: 'Dispenser Location Contact Details (July 2026)',
  distance_km: 0.4,
};

export const SECOND: NearbyResult = {
  ...PHARMACY,
  id: 'ph-2',
  name: 'Easter Road Pharmacy',
  postcode: 'EH6 8AA',
  phone: null,
  distance_km: 1.6,
};

export const ASK_OK: AskResponse = {
  answer: 'The nearest pharmacy to Leith is Leith Pharmacy (EH6 5AA), 0.4 km away [1].',
  refused: false,
  intent: { in_scope: true, category: 'pharmacy', place: 'Leith', limit: 1 },
  resolved_place: 'Leith',
  resolved_via: 'gazetteer',
  results: [PHARMACY],
  citations: [
    { index: 1, id: 'ph-1', name: 'Leith Pharmacy', postcode: 'EH6 5AA', distance_km: 0.4 },
  ],
};

export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}
