import type { ApiErrorBody, ErrorCode } from '@codecollab/shared';
import { env } from './env';

type TokenGetter = () => Promise<string | null>;
let getToken: TokenGetter = async () => null;

/** Called once by the auth layer so every request carries the Clerk session token. */
export const setTokenGetter = (fn: TokenGetter) => {
  getToken = fn;
};

/** Current Clerk session token, for connections that don't go through `api()`. */
export const getAuthToken = () => getToken();

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(`${env.VITE_API_URL}/api/v1${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      0,
      'INTERNAL_ERROR',
      'Can’t reach the server. Check your connection and try again.',
    );
  }

  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'INTERNAL_ERROR',
      err?.message ?? `Request failed (${res.status})`,
      err?.details,
      err?.requestId,
    );
  }
  return body as T;
}
