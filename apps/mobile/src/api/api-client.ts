import { ApiProblemError, parseProblem } from './problem';
import { tenantPath, type RequestScope } from './request-scope';

type ClientOptions = {
  baseUrl: string;
  getAccessToken: () => string | undefined;
  fetchImpl?: typeof fetch;
  correlationId?: () => string;
};

export type ApiRequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  expectedStateVersion?: number;
};

const normalizeBaseUrl = (value: string) => value.replace(/\/$/, '');

export const createApiClient = (options: ClientOptions) => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  const request = async <T>(path: string, requestOptions: ApiRequestOptions = {}): Promise<T> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(requestOptions.body === undefined || requestOptions.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(options.getAccessToken() ? { Authorization: `Bearer ${options.getAccessToken()}` } : {}),
      ...(options.correlationId ? { 'X-Correlation-Id': options.correlationId() } : {}),
      ...(requestOptions.idempotencyKey
        ? { 'Idempotency-Key': requestOptions.idempotencyKey }
        : {}),
      ...(requestOptions.expectedStateVersion === undefined
        ? {}
        : { 'If-Match': String(requestOptions.expectedStateVersion) }),
      ...requestOptions.headers,
    };
    const response = await fetchImpl(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
      ...requestOptions,
      headers,
      body:
        requestOptions.body === undefined || requestOptions.body instanceof FormData
          ? (requestOptions.body as RequestInit['body'])
          : JSON.stringify(requestOptions.body),
    });
    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    throw new ApiProblemError(parseProblem(body, response.status));
  };

  return {
    request,
    tenant: (tenantId: string) => ({
      request: <T>(path: string, requestOptions?: ApiRequestOptions) =>
        request<T>(tenantPath({ tenantId }, path), requestOptions),
      scope: (scope: Omit<RequestScope, 'tenantId'> = {}) => ({
        request: <T>(path: string, requestOptions?: ApiRequestOptions) =>
          request<T>(tenantPath({ tenantId }, path), {
            ...requestOptions,
            headers: {
              ...(scope.branchId ? { 'X-Branch-Id': scope.branchId } : {}),
              ...(scope.membershipId ? { 'X-Membership-Id': scope.membershipId } : {}),
              ...requestOptions?.headers,
            },
          }),
      }),
    }),
  };
};
