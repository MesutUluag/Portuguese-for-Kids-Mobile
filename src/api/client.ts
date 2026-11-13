import { API_BASE_URL } from '@/config';
import { getAuthToken } from '@/auth/firebase';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    status: number,
    code: string,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface FetchWithAuthOptions<T = unknown> extends RequestInit {
  /** Whether an auth token is mandatory before issuing the network request. */
  requireAuth?: boolean;
  /** Optional runtime type guard applied to parsed JSON responses. */
  validate?: (data: unknown) => data is T;
}

function buildUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const normalizedBase = API_BASE_URL.endsWith('/')
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL;
  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${normalizedBase}${normalizedPath}`;
}

function parseRetryAfter(res: Response): number | undefined {
  const header = res.headers.get('Retry-After');
  if (!header) return undefined;
  const parsed = Number.parseInt(header, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return `HTTP ${res.status}`;
    const parsed: unknown = JSON.parse(text);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'message' in parsed &&
      typeof (parsed as { message: unknown }).message === 'string'
    ) {
      return (parsed as { message: string }).message;
    }
    return text.slice(0, 200);
  } catch {
    return `HTTP ${res.status}`;
  }
}

function mapNonOkToApiError(status: number, message: string, retryAfter?: number): ApiError {
  if (status === 400) return new ApiError(message, status, 'bad-request');
  if (status === 401) return new ApiError(message, status, 'unauthorized');
  if (status === 429) return new ApiError(message, status, 'rate-limited', retryAfter);
  if (status >= 500) return new ApiError(message, status, 'server-error');
  return new ApiError(message, status, 'http-error');
}

interface ParsedAttemptResult<T> {
  status: number;
  ok: boolean;
  data?: T;
  errorMessage?: string;
  retryAfter?: number;
}

async function performTimedAttempt<T>(
  url: string,
  fetchInit: RequestInit,
  token: string | null,
  timeoutMs: number,
  validate?: (data: unknown) => data is T,
): Promise<ParsedAttemptResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(fetchInit.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (fetchInit.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...fetchInit,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorMessage = await readErrorMessage(response);
      return {
        status: response.status,
        ok: false,
        errorMessage,
        retryAfter: parseRetryAfter(response),
      };
    }

    if (response.status === 204) {
      return { status: 204, ok: true, data: undefined as T };
    }

    const parsed: unknown = await response.json();
    if (validate && !validate(parsed)) {
      throw new ApiError(
        'Invalid response schema from server.',
        response.status,
        'invalid-response',
      );
    }

    return { status: response.status, ok: true, data: parsed as T };
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('Request timed out.', 0, 'timeout');
    }
    throw new ApiError(
      err instanceof Error ? err.message : 'Network error',
      0,
      'network-error',
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Shared authenticated HTTP client with AbortController timeout covering body parsing
 * and single-shot 401 token refresh-and-retry. Never retries 400, 429, or a second 401.
 */
export async function fetchWithAuth<T = unknown>(
  pathOrUrl: string,
  options: FetchWithAuthOptions<T> = {},
  timeoutMs = 15_000,
): Promise<T> {
  const { requireAuth = false, validate, ...fetchInit } = options;
  const url = buildUrl(pathOrUrl);

  const initialToken = await getAuthToken(false);
  if (requireAuth && !initialToken) {
    throw new ApiError('Authentication required.', 401, 'unauthorized');
  }

  let attempt = await performTimedAttempt<T>(
    url,
    fetchInit,
    initialToken,
    timeoutMs,
    validate,
  );

  if (attempt.status === 401) {
    const refreshedToken = await getAuthToken(true);
    if (refreshedToken) {
      attempt = await performTimedAttempt<T>(
        url,
        fetchInit,
        refreshedToken,
        timeoutMs,
        validate,
      );
    }
  }

  if (!attempt.ok) {
    throw mapNonOkToApiError(
      attempt.status,
      attempt.errorMessage ?? `HTTP ${attempt.status}`,
      attempt.retryAfter,
    );
  }

  return attempt.data as T;
}
