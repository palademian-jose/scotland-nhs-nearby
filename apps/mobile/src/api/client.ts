import {
  type AskResponse,
  CATEGORIES,
  type Category,
  type Coords,
  type Facility,
  type NearbyResponse,
  type ResolvedPlace,
} from './types';

export class ApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ClientOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertNearby(value: unknown): NearbyResponse {
  if (!isObject(value) || !Array.isArray(value.results) || typeof value.count !== 'number') {
    throw new ApiError('Unexpected response from the server');
  }
  return value as unknown as NearbyResponse;
}

function assertAsk(value: unknown): AskResponse {
  if (
    !isObject(value) ||
    typeof value.answer !== 'string' ||
    typeof value.refused !== 'boolean' ||
    !Array.isArray(value.results)
  ) {
    throw new ApiError('Unexpected response from the server');
  }
  return value as unknown as AskResponse;
}

export class ApiClient {
  readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(baseUrl: string, options: ClientOptions = {}) {
    this.baseUrl = baseUrl.trim().replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'AbortError';
      throw new ApiError(timedOut ? 'The request timed out' : 'Cannot reach the server');
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      let detail = `Server error (${response.status})`;
      try {
        const body: unknown = await response.json();
        if (isObject(body) && typeof body.detail === 'string') {
          detail = body.detail;
        }
      } catch {
        // keep the generic message
      }
      throw new ApiError(detail, response.status);
    }
    return response.json();
  }

  async nearby(coords: Coords, category: Category, limit = 10): Promise<NearbyResponse> {
    if (!CATEGORIES.includes(category)) {
      throw new ApiError(`Unknown category: ${category}`);
    }
    const query = new URLSearchParams({
      lat: String(coords.lat),
      lon: String(coords.lon),
      category,
      limit: String(limit),
    });
    return assertNearby(await this.request(`/nearby?${query.toString()}`));
  }

  async ask(question: string, coords?: Coords | null): Promise<AskResponse> {
    const body: Record<string, unknown> = { question };
    if (coords) {
      body.lat = coords.lat;
      body.lon = coords.lon;
    }
    return assertAsk(
      await this.request('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  }

  async resolve(query: string): Promise<ResolvedPlace> {
    const result = await this.request(`/resolve?${new URLSearchParams({ q: query }).toString()}`);
    if (!isObject(result) || typeof result.lat !== 'number' || typeof result.lon !== 'number') {
      throw new ApiError('Unexpected response from the server');
    }
    return result as unknown as ResolvedPlace;
  }

  async facility(id: string): Promise<Facility> {
    const result = await this.request(`/facility/${encodeURIComponent(id)}`);
    if (!isObject(result) || typeof result.id !== 'string') {
      throw new ApiError('Unexpected response from the server');
    }
    return result as unknown as Facility;
  }
}
