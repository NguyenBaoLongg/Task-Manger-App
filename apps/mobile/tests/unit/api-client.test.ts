import { createApiClient } from '@/api/api-client';

describe('authenticated API client', () => {
  it('adds bearer and correlation headers and parses problem details safely', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'FORBIDDEN',
          message: 'No access',
          correlationId: 'c-1',
          stack: 'secret',
        }),
        {
          status: 403,
          headers: { 'content-type': 'application/problem+json' },
        },
      ),
    );
    const client = createApiClient({
      baseUrl: 'https://api.example.test/',
      getAccessToken: () => 'access-1',
      fetchImpl,
      correlationId: () => 'corr-1',
    });

    await expect(client.request('/v1/me')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      correlationId: 'c-1',
    });
    const firstCall = fetchImpl.mock.calls[0];
    expect(firstCall?.[0]).toBe('https://api.example.test/v1/me');
    const firstHeaders = firstCall?.[1]?.headers as Record<string, string>;
    expect(firstHeaders.Authorization).toBe('Bearer access-1');
    expect(firstHeaders['X-Correlation-Id']).toBe('corr-1');
    expect(JSON.stringify(fetchImpl.mock.calls[0])).not.toContain('secret');
  });

  it('scopes tenant paths and sends JSON bodies', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ id: 'tenant-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'token',
      fetchImpl,
    });

    await client.tenant('tenant-1').request('/branches', {
      method: 'POST',
      body: { name: 'Demo' },
      idempotencyKey: 'idem-1',
    });
    const firstCall = fetchImpl.mock.calls[0];
    expect(firstCall?.[0]).toBe('https://api.example.test/v1/tenants/tenant-1/branches');
    expect(firstCall?.[1]?.body).toBe(JSON.stringify({ name: 'Demo' }));
    const firstHeaders = firstCall?.[1]?.headers as Record<string, string>;
    expect(firstHeaders['Idempotency-Key']).toBe('idem-1');
  });
});
