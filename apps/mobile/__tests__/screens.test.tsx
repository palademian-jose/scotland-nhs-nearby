import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import AskScreen from '../app/(tabs)/ask';
import NearbyScreen from '../app/(tabs)/index';
import { ApiClient } from '../src/api/client';
import { STORAGE_KEYS } from '../src/config';
import { saveCache } from '../src/storage/cache';
import { ASK_OK, jsonResponse, PHARMACY, SECOND } from './fixtures';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../src/components/MapPane', () => ({ MapPane: () => null }));

const mockApp = {
  client: new ApiClient('http://api.test'),
  location: {
    status: 'gps' as const,
    coords: { lat: 55.95, lon: -3.19 },
    label: 'Your location',
    message: null as string | null,
  },
  setManualPostcode: jest.fn(),
  retryGps: jest.fn(),
};
jest.mock('../src/state/AppState', () => ({ useApp: () => mockApp }));

function useFetch(handler: (url: string) => Response | Promise<Response>) {
  const fn = jest.fn((url: string, _init?: RequestInit) => Promise.resolve(handler(url)));
  mockApp.client = new ApiClient('http://api.test', { fetchImpl: fn });
  return fn;
}

beforeEach(async () => {
  mockPush.mockClear();
  mockApp.location = {
    status: 'gps',
    coords: { lat: 55.95, lon: -3.19 },
    label: 'Your location',
    message: null,
  };
  await AsyncStorage.clear();
});

describe('Nearby screen', () => {
  it('lists the nearest results from the API, closest first, and opens details', async () => {
    const fetchFn = useFetch(() =>
      jsonResponse({
        category: 'pharmacy',
        lat: 55.95,
        lon: -3.19,
        count: 2,
        results: [PHARMACY, SECOND],
      }),
    );
    await render(<NearbyScreen />);
    expect(await screen.findByText('Leith Pharmacy')).toBeOnTheScreen();
    expect(screen.getByText('Easter Road Pharmacy')).toBeOnTheScreen();
    expect(screen.queryByText('cached')).toBeNull();
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain('category=pharmacy');

    await fireEvent.press(screen.getByLabelText(/Leith Pharmacy, Pharmacy/));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/facility/[id]',
      params: { id: 'ph-1', data: JSON.stringify(PHARMACY) },
    });
  });

  it('refetches when another category chip is selected', async () => {
    const fetchFn = useFetch(() =>
      jsonResponse({ category: 'gp', lat: 55.95, lon: -3.19, count: 0, results: [] }),
    );
    await render(<NearbyScreen />);
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getByLabelText('GP'));
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
    expect(String(fetchFn.mock.calls[1]?.[0])).toContain('category=gp');
    expect(await screen.findByText('No results.')).toBeOnTheScreen();
  });

  it('shows the last results with a cached badge when the server is unreachable', async () => {
    await saveCache(STORAGE_KEYS.nearbyCache, {
      pharmacy: { coords: { lat: 55.95, lon: -3.19 }, items: [PHARMACY] },
    });
    useFetch(() => {
      throw new TypeError('Network request failed');
    });
    await render(<NearbyScreen />);
    expect(await screen.findByText('cached')).toBeOnTheScreen();
    expect(screen.getByText('Leith Pharmacy')).toBeOnTheScreen();
    expect(screen.getByText(/Cannot reach the server/)).toBeOnTheScreen();
  });

  it('shows an error and no badge when there is nothing cached', async () => {
    useFetch(() => jsonResponse({ detail: 'rate limit exceeded' }, 429));
    await render(<NearbyScreen />);
    expect(await screen.findByText(/rate limit exceeded/)).toBeOnTheScreen();
    expect(screen.queryByText('cached')).toBeNull();
  });

  it('asks for a postcode when location permission is denied', async () => {
    mockApp.location = {
      status: 'needs_postcode' as never,
      coords: null as never,
      label: '',
      message: 'Location permission is off.',
    };
    await render(<NearbyScreen />);
    expect(screen.getByText('Where are you?')).toBeOnTheScreen();
    expect(screen.getByText('Location permission is off.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Postcode'), 'EH8 9YL');
    await fireEvent.press(screen.getByRole('button', { name: 'Use this postcode' }));
    await waitFor(() => expect(mockApp.setManualPostcode).toHaveBeenCalledWith('EH8 9YL'));
  });
});

describe('Ask screen', () => {
  it('sends the question with coordinates and shows the grounded answer and cited rows', async () => {
    const fetchFn = useFetch(() => jsonResponse(ASK_OK));
    await render(<AskScreen />);
    await fireEvent.changeText(screen.getByLabelText('Your question'), 'nearest pharmacy to Leith');
    await fireEvent.press(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText(ASK_OK.answer)).toBeOnTheScreen();
    expect(screen.getByText(/\[1\] Leith Pharmacy/)).toBeOnTheScreen();
    expect(screen.getByText(/Open Government Licence v3.0/)).toBeOnTheScreen();
    const init = fetchFn.mock.calls[0]?.[1];
    expect(JSON.parse(init?.body as string)).toEqual({
      question: 'nearest pharmacy to Leith',
      lat: 55.95,
      lon: -3.19,
    });
  });

  it('shows a refusal without any rows', async () => {
    useFetch(() =>
      jsonResponse({
        ...ASK_OK,
        answer: 'I can only help you find NHS services.',
        refused: true,
        results: [],
        citations: [],
      }),
    );
    await render(<AskScreen />);
    await fireEvent.changeText(screen.getByLabelText('Your question'), 'what should I take');
    await fireEvent.press(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('I can only help you find NHS services.')).toBeOnTheScreen();
    expect(screen.queryByText(/Sources:/)).toBeNull();
  });

  it('shows the error when the request fails and keeps the Ask button usable', async () => {
    useFetch(() => jsonResponse({ detail: 'daily LLM budget reached' }, 429));
    await render(<AskScreen />);
    await fireEvent.changeText(screen.getByLabelText('Your question'), 'nearest gp');
    await fireEvent.press(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('daily LLM budget reached')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeEnabled();
  });

  it('restores the last answer from the cache with a badge', async () => {
    await saveCache(STORAGE_KEYS.askCache, { question: 'nearest pharmacy', response: ASK_OK });
    useFetch(() => jsonResponse(ASK_OK));
    await render(<AskScreen />);
    expect(await screen.findByText('cached')).toBeOnTheScreen();
    expect(screen.getByText(ASK_OK.answer)).toBeOnTheScreen();
  });

  it('keeps the Ask button disabled for an empty question', async () => {
    useFetch(() => jsonResponse(ASK_OK));
    await render(<AskScreen />);
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
  });
});
