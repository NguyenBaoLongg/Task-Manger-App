import { createApiClient } from '@/api/api-client';
import {
  createBranch,
  freshCreateBranchIdempotencyKey,
  CreateBranchError,
} from '@/features/tenant/create-branch-model';

const backendBranch = { id: 'branch-new', name: 'Cơ sở 1', status: 'ACTIVE' };

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

describe('create branch model', () => {
  it('posts uppercased code and trimmed name to the tenant branch route with an idempotency key', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(backendBranch), { status: 201 }),
    ) as jest.MockedFunction<typeof fetch>;

    const outcome = await createBranch(
      makeClient(fetchImpl),
      'tenant-1',
      { code: ' cn1 ', name: '  Cơ sở 1  ' },
      { idempotencyKey: 'branch-key-123' },
    );

    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api.example.test/v1/tenants/tenant-1/branches');
    expect(createBody(fetchImpl)).toEqual({ code: 'CN1', name: 'Cơ sở 1' });
    const key = (fetchImpl.mock.calls[0]![1]!.headers as Record<string, string>)['Idempotency-Key'];
    expect(key).toBe('branch-key-123');
    expect(outcome).toEqual({ kind: 'created', branchId: 'branch-new', name: 'Cơ sở 1' });
  });

  it('maps a missing permission to a contact-admin message', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      problem(403, 'AUTHORIZATION_DENIED', 'Không có quyền branch.manage.'),
    ) as jest.MockedFunction<typeof fetch>;

    const error = await createBranch(
      makeClient(fetchImpl),
      'tenant-1',
      { code: 'CN1', name: 'Cơ sở 1' },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CreateBranchError);
    expect((error as CreateBranchError).kind).toBe('locked');
    expect((error as CreateBranchError).message).toBe(
      'Tài khoản không có quyền tạo cơ sở. Hãy liên hệ quản trị viên công ty.',
    );
  });

  it('maps a reused idempotency key to a retry prompt', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      problem(409, 'IDEMPOTENCY_KEY_REUSED', 'Trùng khóa idempotency.'),
    ) as jest.MockedFunction<typeof fetch>;

    const error = await createBranch(
      makeClient(fetchImpl),
      'tenant-1',
      { code: 'CN1', name: 'Cơ sở 1' },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CreateBranchError);
    expect((error as CreateBranchError).kind).toBe('unknown');
    expect((error as CreateBranchError).message).toBe('Yêu cầu trùng lặp. Hãy thử lại.');
  });

  it('maps invalid input to a re-entry prompt without leaking technical codes', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      problem(422, 'VALIDATION_FAILED', 'Mã cơ sở không hợp lệ.'),
    ) as jest.MockedFunction<typeof fetch>;

    const error = await createBranch(
      makeClient(fetchImpl),
      'tenant-1',
      { code: '!', name: 'Cơ sở 1' },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CreateBranchError);
    expect((error as CreateBranchError).kind).toBe('unknown');
    expect((error as CreateBranchError).message).toBe(
      'Thông tin cơ sở không hợp lệ. Hãy kiểm tra lại.',
    );
  });

  it('maps a network failure to a retry prompt', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as jest.MockedFunction<
      typeof fetch
    >;

    const error = await createBranch(
      makeClient(fetchImpl),
      'tenant-1',
      { code: 'CN1', name: 'Cơ sở 1' },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CreateBranchError);
    expect((error as CreateBranchError).kind).toBe('network');
    expect((error as CreateBranchError).message).toBe(
      'Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng rồi thử lại.',
    );
  });

  it('uses a fresh idempotency key on every submit so double-taps cannot double-create', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(backendBranch), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...backendBranch, id: 'other' }), { status: 201 }),
      ) as jest.MockedFunction<typeof fetch>;
    const client = makeClient(fetchImpl);

    await createBranch(client, 'tenant-1', { code: 'CN1', name: 'Cơ sở 1' });
    await createBranch(client, 'tenant-1', { code: 'CN1', name: 'Cơ sở 1' });

    const keys = fetchImpl.mock.calls.map(
      ([, init]) => (init!.headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(keys[0]).toBeDefined();
    expect(keys[0]!.length).toBeGreaterThanOrEqual(8);
    expect(keys[1]).toBeDefined();
    expect(keys[1]).not.toBe(keys[0]);
    expect(freshCreateBranchIdempotencyKey().length).toBeGreaterThanOrEqual(8);
  });
});
