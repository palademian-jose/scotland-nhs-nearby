import { ApiClient, ApiError } from '../src/api/client';
import { ASK_OK, jsonResponse, PHARMACY } from './fixtures';

const COORDS = { lat: 55.95, lon: -3.19 };

describe('ApiClient', () => {
  it('requests /nearby with encoded query parameters', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        category: 'pharmacy',
        lat: 55.95,
        lon: -3.19,
        count: 1,
        results: [PHARMACY],
      }),
    );
    const client = new ApiClient('http://api.test/', { fetchImpl });
    const response = await client.nearby(COORDS, 'pharmacy', 5);
    expect(response.results[0]?.name).toBe('Leith Pharmacy');
    const url = new URL(fetchImpl.mock.calls[0]?.[0] as string);
    expect(url.origin + url.pathname).toBe('http://api.test/nearby');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lat: '55.95',
      lon: '-3.19',
      category: 'pharmacy',
      limit: '5',
    });
  });

  it('posts the question and coordinates to /ask', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(ASK_OK));
    const client = new ApiClient('http://api.test', { fetchImpl });
    const response = await client.ask('nearest pharmacy', COORDS);
    expect(response.citations).toHaveLength(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/ask');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      question: 'nearest pharmacy',
      lat: 55.95,
      lon: -3.19,
    });
  });

  it('omits coordinates when none are known', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(ASK_OK));
    await new ApiClient('http://api.test', { fetchImpl }).ask('q', null);
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ question: 'q' });
  });

  it('surfaces the server detail for HTTP errors', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({ detail: 'rate limit exceeded' }, 429));
    const client = new ApiClient('http://api.test', { fetchImpl });
    await expect(client.ask('q')).rejects.toMatchObject({
      name: 'ApiError',
      status: 429,
      message: 'rate limit exceeded',
    });
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    const broken = {
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response;
    const client = new ApiClient('http://api.test', {
      fetchImpl: jest.fn().mockResolvedValue(broken),
    });
    await expect(client.nearby(COORDS, 'gp')).rejects.toThrow('Server error (502)');
  });

  it('reports network failures and timeouts', async () => {
    const down = new ApiClient('http://api.test', {
      fetchImpl: jest.fn().mockRejectedValue(new TypeError('Network request failed')),
    });
    await expect(down.nearby(COORDS, 'gp')).rejects.toThrow('Cannot reach the server');

    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const slow = new ApiClient('http://api.test', {
      fetchImpl: jest.fn().mockRejectedValue(abort),
    });
    await expect(slow.nearby(COORDS, 'gp')).rejects.toThrow('The request timed out');
  });

  it('rejects responses with an unexpected shape', async () => {
    const client = new ApiClient('http://api.test', {
      fetchImpl: jest.fn().mockResolvedValue(jsonResponse({ hello: 'world' })),
    });
    await expect(client.nearby(COORDS, 'gp')).rejects.toBeInstanceOf(ApiError);
    await expect(client.ask('q')).rejects.toBeInstanceOf(ApiError);
    await expect(client.resolve('EH8 9YL')).rejects.toBeInstanceOf(ApiError);
  });

  it('resolves a postcode', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ lat: 55.94, lon: -3.17, label: 'EH8 9YL', via: 'postcode' }),
      );
    const place = await new ApiClient('http://api.test', { fetchImpl }).resolve('EH8 9YL');
    expect(place.lat).toBe(55.94);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://api.test/resolve?q=EH8+9YL');
  });
});
