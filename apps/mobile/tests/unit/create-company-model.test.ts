import { createApiClient } from '@/api/api-client';
import {
  createCompany,
  freshCreateCompanyIdempotencyKey,
  CreateCompanyError,
} from '@/features/tenant/create-company-model';

const backendTenant = {
  tenant: { id: 'tenant-new' },
  membership: { id: 'membership-new' },
};

const makeClient = (fetchImpl: jest.MockedFunction<typeof fetch>) =>
  createApiClient({
    baseUrl: 'https://api.example.test',
    getAccessToken: () => 'access',
    fetchImpl,
  });

const problem = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ code, message }), { status });

const createBody = (fetchImpl: jest.MockedFunction<typeof fetch>) =>
  JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string) as Record<string, unknown>;

describe('create company model', () => {
  it('posts trimmed name and timezone with an idempotency key', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(backendTenant), { status: 201 }),
    ) as jest.MockedFunction<typeof fetch>;

    const outcome = await createCompany(
      makeClient(fetchImpl),
      { name: '  Công ty TNHH Demo  ', timezone: 'Asia/Ho_Chi_Minh' },
      { idempotencyKey: 'tenant-key-123' },
    );

    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api.example.test/v1/tenants');
    expect(createBody(fetchImpl)).toEqual({ name: 'Công ty TNHH Demo', timezone: 'Asia/Ho_Chi_Minh' });
    const key = (fetchImpl.mock.calls[0]![1]!.headers as Record<string, string>)['Idempotency-Key'];
    expect(key).toBe('tenant-key-123');
    expect(outcome).toEqual({ kind: 'created', tenantId: 'tenant-new', membershipId: 'membership-new' });
  });

  it('flags when the profile needs confirmation before creating a company', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      problem(409, 'PROFILE_CONFIRMATION_REQUIRED', 'Cần xác nhận họ tên trước khi tạo doanh nghiệp.'),
    ) as jest.MockedFunction<typeof fetch>;

    const outcome = await createCompany(
      makeClient(fetchImpl),
      { name: 'Công ty Demo', timezone: 'Asia/Ho_Chi_Minh' },
    );

    expect(outcome).toEqual({ kind: 'profile-confirmation-required' });
  });

  it('maps a locked account to a contact-admin message', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      problem(403, 'AUTHORIZATION_DENIED', 'Tài khoản đã bị khóa.'),
    ) as jest.MockedFunction<typeof fetch>;

    const error = await createCompany(
      makeClient(fetchImpl),
      { name: 'Công ty Demo', timezone: 'Asia/Ho_Chi_Minh' },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CreateCompanyError);
    expect((error as CreateCompanyError).kind).toBe('locked');
    expect((error as CreateCompanyError).message).toBe(
      'Tài khoản đã bị khóa. Hãy liên hệ quản trị viên công ty.',
    );
  });

  it('maps invalid input to a re-entry prompt without leaking technical codes', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      problem(422, 'VALIDATION_FAILED', 'Tên công ty không hợp lệ.'),
    ) as jest.MockedFunction<typeof fetch>;

    const error = await createCompany(
      makeClient(fetchImpl),
      { name: 'x', timezone: 'Asia/Ho_Chi_Minh' },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CreateCompanyError);
    expect((error as CreateCompanyError).kind).toBe('unknown');
    expect((error as CreateCompanyError).message).toBe(
      'Thông tin công ty không hợp lệ. Hãy kiểm tra lại.',
    );
  });

  it('maps a network failure to a retry prompt', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as jest.MockedFunction<
      typeof fetch
    >;

    const error = await createCompany(
      makeClient(fetchImpl),
      { name: 'Công ty Demo', timezone: 'Asia/Ho_Chi_Minh' },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CreateCompanyError);
    expect((error as CreateCompanyError).kind).toBe('network');
    expect((error as CreateCompanyError).message).toBe(
      'Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng rồi thử lại.',
    );
  });

  it('uses a fresh idempotency key on every submit so double-taps cannot double-create', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(backendTenant), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...backendTenant, tenant: { id: 'other' } }), { status: 201 }),
      ) as jest.MockedFunction<typeof fetch>;
    const client = makeClient(fetchImpl);

    await createCompany(client, { name: 'Công ty Demo', timezone: 'Asia/Ho_Chi_Minh' });
    await createCompany(client, { name: 'Công ty Demo', timezone: 'Asia/Ho_Chi_Minh' });

    const keys = fetchImpl.mock.calls.map(
      ([, init]) => (init!.headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(keys[0]).toBeDefined();
    expect(keys[0]!.length).toBeGreaterThanOrEqual(8);
    expect(keys[1]).toBeDefined();
    expect(keys[1]).not.toBe(keys[0]);
    expect(freshCreateCompanyIdempotencyKey().length).toBeGreaterThanOrEqual(8);
  });
});
