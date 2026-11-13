import { ApiError, fetchWithAuth } from '@/api/client';
import { getAuthToken } from '@/auth/firebase';

jest.mock('@/auth/firebase', () => ({
  getAuthToken: jest.fn(),
}));

const mockGetAuthToken = getAuthToken as jest.MockedFunction<typeof getAuthToken>;

describe('fetchWithAuth', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('attaches Bearer token and parses validated JSON response', async () => {
    mockGetAuthToken.mockResolvedValueOnce('tok-1');
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const isHello = (val: unknown): val is { hello: string } =>
      typeof val === 'object' &&
      val !== null &&
      'hello' in val &&
      typeof (val as { hello: unknown }).hello === 'string';

    const data = await fetchWithAuth('/user/me', { validate: isHello });
    expect(data).toEqual({ hello: 'world' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok-1');
  });

  it('refreshes token once on 401 and succeeds on retry', async () => {
    mockGetAuthToken
      .mockResolvedValueOnce('expired-tok')
      .mockResolvedValueOnce('fresh-tok');

    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        text: async () => JSON.stringify({ message: 'Expired' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const res = await fetchWithAuth<{ ok: boolean }>('/user/me');
    expect(res).toEqual({ ok: true });
    expect(mockGetAuthToken).toHaveBeenNthCalledWith(1, false);
    expect(mockGetAuthToken).toHaveBeenNthCalledWith(2, true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 400, 429 (parsing Retry-After), or 500', async () => {
    mockGetAuthToken.mockResolvedValue('tok-1');

    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '45' }),
      text: async () => JSON.stringify({ message: 'Too many requests' }),
    }) as unknown as typeof fetch;

    await expect(fetchWithAuth('/story')).rejects.toMatchObject<Partial<ApiError>>({
      status: 429,
      code: 'rate-limited',
      retryAfterSeconds: 45,
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Headers(),
      text: async () => JSON.stringify({ message: 'Bad input' }),
    }) as unknown as typeof fetch;

    await expect(fetchWithAuth('/story')).rejects.toMatchObject<Partial<ApiError>>({
      status: 400,
      code: 'bad-request',
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('handles 204 No Content and rejects invalid response schemas', async () => {
    mockGetAuthToken.mockResolvedValue('tok-1');

    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
    }) as unknown as typeof fetch;

    const empty = await fetchWithAuth<void>('/user/me', { method: 'DELETE' });
    expect(empty).toBeUndefined();

    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: 123 }),
    }) as unknown as typeof fetch;

    const guard = (d: unknown): d is { required: string } =>
      typeof d === 'object' && d !== null && 'required' in d;

    await expect(fetchWithAuth('/user/me', { validate: guard })).rejects.toMatchObject<
      Partial<ApiError>
    >({
      code: 'invalid-response',
    });
  });

  it('fails fast when requireAuth is true without a token and aborts slow body reads on timeout', async () => {
    mockGetAuthToken.mockResolvedValueOnce(null);
    globalThis.fetch = jest.fn() as unknown as typeof fetch;

    await expect(fetchWithAuth('/user/me', { requireAuth: true })).rejects.toMatchObject<
      Partial<ApiError>
    >({
      status: 401,
      code: 'unauthorized',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();

    mockGetAuthToken.mockResolvedValueOnce('tok-1');
    globalThis.fetch = jest.fn((_url: string, init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              const err = new Error('Aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }),
      }),
    ) as unknown as typeof fetch;

    await expect(fetchWithAuth('/user/me', {}, 25)).rejects.toMatchObject<
      Partial<ApiError>
    >({
      code: 'timeout',
    });
  });
});
