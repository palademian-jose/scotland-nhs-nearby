export const CATEGORIES = ['gp', 'pharmacy', 'dentist', 'hospital', 'ae'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  gp: 'GP',
  pharmacy: 'Pharmacy',
  dentist: 'Dentist',
  hospital: 'Hospital',
  ae: 'A&E',
};

export interface Facility {
  id: string;
  category: Category;
  name: string;
  address: string;
  postcode: string;
  phone: string | null;
  health_board: string;
  lat: number;
  lon: number;
  source_dataset: string;
}

export interface NearbyResult extends Facility {
  distance_km: number;
}

export interface NearbyResponse {
  category: Category;
  lat: number;
  lon: number;
  count: number;
  results: NearbyResult[];
}

export interface Intent {
  in_scope: boolean;
  category: Category | null;
  place: string | null;
  limit: number;
}

export interface Citation {
  index: number;
  id: string;
  name: string;
  postcode: string;
  distance_km: number;
}

export type ResolvedVia =
  'coordinates' | 'postcode' | 'postcode_district' | 'gazetteer' | 'live_postcode' | 'none';

export interface AskResponse {
  answer: string;
  refused: boolean;
  intent: Intent;
  resolved_place: string | null;
  resolved_via: ResolvedVia;
  results: NearbyResult[];
  citations: Citation[];
}

export interface ResolvedPlace {
  lat: number;
  lon: number;
  label: string;
  via: ResolvedVia;
}

export interface Coords {
  lat: number;
  lon: number;
}
