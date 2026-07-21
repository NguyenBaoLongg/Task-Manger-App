import { describe, expect, it } from 'vitest';
import request, { type Test } from 'supertest';
import { ProblemError } from '@adsup/domain';
import { loadOpenApiDocument } from '@adsup/contracts';
import { createApp, type AppDependencies } from '../../src/app.js';
import { Metrics } from '../../src/observability/index.js';
import { testConfig } from '../helpers/config.js';

const uuid = '10000000-0000-4000-8000-000000000001';

export function dependencies(overrides: Partial<AppDependencies> = {}): AppDependencies {
  return {
    config: testConfig,
    authService: {
      async login() {
        return { ok: true };
      },
      async me() {
        return { id: uuid, fullName: 'Test User', profileComplete: true, status: 'ACTIVE' };
      },
      async confirmProfile() {
        return { id: uuid, fullName: 'Test User', profileComplete: true, status: 'ACTIVE' };
      },
    },
    tokens: {
      async verifyAccess() {
        return { userId: uuid, sessionId: uuid };
      },
      async verifyLogoutAccess() {
        return { userId: uuid, sessionId: uuid };
      },
      async refresh() {
        return { ok: true };
      },
      async logout() {},
    },
    authRepo: {
      async findMembership() {
        return { id: uuid, status: 'ACTIVE' };
      },
      async getTenant() {
        return { id: uuid, status: 'ACTIVE' };
      },
    },
    tenantService: {
      async list() {
        return [];
      },
      async create() {
        return { id: uuid };
      },
      async get() {
        return { id: uuid };
      },
      async updateStatus() {
        return { id: uuid, status: 'ACTIVE' };
      },
    },
    invitationService: {
      async accept() {
        return { id: uuid, membershipDisplayName: 'Test User' };
      },
      async create() {
        return { id: uuid };
      },
      async list() {
        return [];
      },
      async revoke() {
        return { id: uuid };
      },
    },
    organizationService: {
      async listBranches() {
        return [];
      },
      async createBranch() {
        return { id: uuid };
      },
      async updateBranchStatus() {
        return { id: uuid, status: 'ACTIVE' };
      },
      async listDepartments() {
        return [];
      },
      async createDepartment() {
        return { id: uuid };
      },
      async updateDepartmentStatus() {
        return { id: uuid, status: 'ACTIVE' };
      },
      async listPositions() {
        return [];
      },
      async createPosition() {
        return { id: uuid };
      },
      async updatePositionStatus() {
        return { id: uuid, status: 'ACTIVE' };
      },
      async listAssignments() {
        return [];
      },
      async createAssignment() {
        return { id: uuid };
      },
    },
    rbacService: {
      async listMemberships() {
        return { items: [], nextCursor: null };
      },
      async updateMembership() {
        return { id: uuid, membershipDisplayName: 'Test User' };
      },
      async listRoles() {
        return [];
      },
      async createRole() {
        return { id: uuid, permissionCodes: [] };
      },
      async grantBinding() {
        return { id: uuid };
      },
    },
    rbacRepo: {
      async hasPermission() {
        return true;
      },
      async hasAnyPermission() {
        return true;
      },
    },
    formService: {
      async list() {
        return [];
      },
      async create() {
        return { id: uuid };
      },
      async publish() {
        return { id: uuid, formTemplateId: uuid };
      },
      async archiveTemplate() {
        return { id: uuid, status: 'ARCHIVED' };
      },
      async retireVersion() {
        return { id: uuid, formTemplateId: uuid, status: 'RETIRED' };
      },
      async submit() {
        return { id: uuid, formTemplateId: uuid };
      },
    },
    chatService: {
      async listChannels() {
        return [];
      },
      async createChannel() {
        return { id: uuid };
      },
      async listMessages() {
        return { items: [], nextCursor: null };
      },
      async send() {
        return { id: uuid, authorDisplayNameSnapshot: 'Test User' };
      },
    },
    chatRepo: {
      async registerEndpoint(input: { platform: string; provider: string }) {
        return { id: uuid, ...input, status: 'ACTIVE', lastSeenAt: new Date().toISOString() };
      },
      async revokeEndpoint() {
        return { count: 1 };
      },
    },
    mediaService: {
      async createIntent() {
        return { id: uuid };
      },
      async complete() {
        return { id: uuid, status: 'READY' };
      },
      async download() {
        return { url: 'https://example.test/signed', expiresAt: new Date().toISOString() };
      },
    },
    auditRepo: {
      async list() {
        return { items: [], nextCursor: null };
      },
    },
    ...overrides,
  } as unknown as AppDependencies;
}

export function send(app: ReturnType<typeof createApp>, method: string, path: string): Test {
  const client = request(app);
  if (method === 'get') return client.get(path);
  if (method === 'post') return client.post(path);
  if (method === 'patch') return client.patch(path);
  if (method === 'put') return client.put(path);
  if (method === 'delete') return client.delete(path);
  throw new Error(`Unsupported HTTP method: ${method}`);
}

describe('published HTTP conformance', () => {
  it('mounts every bearer-protected published operation and rejects it without authentication', async () => {
    const document = await loadOpenApiDocument();
    const paths = document.paths as Record<string, Record<string, HttpOperation>>;
    const protectedOperations = Object.entries(paths).flatMap(([path, item]) =>
      Object.entries(item)
        .filter(([method]) => methods.has(method))
        .map(([method, operation]) => ({ path, method, operation }))
        .filter(({ operation }) => operation.security?.length !== 0),
    );
    expect(protectedOperations).toHaveLength(43);
    const app = createApp(dependencies());
    for (const { path, method, operation } of protectedOperations) {
      const concretePath = path.replaceAll(/\{[^}]+\}/g, uuid);
      const response = await send(app, method, concretePath).send({});
      expect(response.status, `${operation.operationId} is not protected/mounted`).toBe(401);
      const body = response.body as Record<string, unknown>;
      expect(body).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
      expect(typeof body.correlationId).toBe('string');
    }
  });

  it('executes a declared success response for every published operation', async () => {
    const document = await loadOpenApiDocument();
    const paths = document.paths as Record<string, Record<string, HttpOperation>>;
    const operations = Object.entries(paths).flatMap(([path, item]) =>
      Object.entries(item)
        .filter(([method]) => methods.has(method))
        .map(([method, operation]) => ({ path, method, operation })),
    );
    expect(operations).toHaveLength(47);
    const app = createApp(dependencies());
    for (const { path, method, operation } of operations) {
      const operationId = operation.operationId!;
      const concretePath = path.replaceAll(/\{[^}]+\}/g, uuid);
      const response = await send(app, method, concretePath)
        .set('Authorization', 'Bearer valid-test-token')
        .set('idempotency-key', `success-${operationId}`.slice(0, 128))
        .send(successBodies[operationId] ?? {});
      const declaredSuccesses = Object.keys(operation.responses ?? {}).filter((status) =>
        status.startsWith('2'),
      );
      expect(declaredSuccesses, `${operationId} has no declared success`).not.toHaveLength(0);
      expect(declaredSuccesses, `${operationId} returned ${response.status}`).toContain(
        String(response.status),
      );
    }
  });

  it('executes public success and validation surfaces', async () => {
    const app = createApp(dependencies());
    expect((await request(app).get('/health/live')).status).toBe(200);
    expect((await request(app).get('/health/ready')).status).toBe(200);
    const invalidGoogle = await request(app).post('/v1/auth/google').send({});
    expect(invalidGoogle.status).toBe(422);
    expect(invalidGoogle.body.code).toBe('VALIDATION_FAILED');
    const invalidRefresh = await request(app).post('/v1/auth/refresh').send({});
    expect(invalidRefresh.status).toBe(422);
    const extraField = await request(app)
      .post('/v1/auth/google')
      .set('idempotency-key', 'http-google-extra')
      .send({ idToken: 'x'.repeat(20), unexpected: true });
    expect(extraField.status).toBe(422);
    const google = await request(app)
      .post('/v1/auth/google')
      .set('idempotency-key', 'http-google-0001')
      .send({ idToken: 'x'.repeat(20) });
    expect(google.status).toBe(200);
  });

  it('returns safe authorization, missing-idempotency, conflict and internal problems', async () => {
    const bearer = { Authorization: 'Bearer valid-test-token' };
    const denied = createApp(
      dependencies({
        rbacRepo: {
          async hasPermission() {
            return false;
          },
        } as unknown as AppDependencies['rbacRepo'],
      }),
    );
    const forbidden = await request(denied).get(`/v1/tenants/${uuid}`).set(bearer);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('AUTHORIZATION_DENIED');

    const missingKey = await request(createApp(dependencies()))
      .post('/v1/tenants')
      .set(bearer)
      .send({ name: 'Tenant Test', timezone: 'Asia/Ho_Chi_Minh' });
    expect(missingKey.status).toBe(422);
    expect(missingKey.body.code).toBe('VALIDATION_FAILED');

    const conflict = createApp(
      dependencies({
        tenantService: {
          async create() {
            throw new ProblemError(409, 'IDEMPOTENCY_KEY_REUSED', 'Khóa đã được dùng.');
          },
        } as unknown as AppDependencies['tenantService'],
      }),
    );
    const conflictResponse = await request(conflict)
      .post('/v1/tenants')
      .set(bearer)
      .set('idempotency-key', 'http-tenant-0001')
      .send({ name: 'Tenant Test', timezone: 'Asia/Ho_Chi_Minh' });
    expect(conflictResponse.status).toBe(409);
    expect(conflictResponse.body.code).toBe('IDEMPOTENCY_KEY_REUSED');

    const failed = createApp(
      dependencies({
        authService: {
          async me() {
            throw new Error('sensitive-adapter-detail');
          },
        } as unknown as AppDependencies['authService'],
      }),
    );
    const internal = await request(failed).get('/v1/me').set(bearer);
    expect(internal.status).toBe(500);
    expect(JSON.stringify(internal.body)).not.toContain('sensitive-adapter-detail');
  });

  it('records status and duration telemetry without request labels', async () => {
    const metrics = new Metrics();
    const app = createApp(dependencies({ metrics }));
    await request(app).get(`/v1/tenants/${uuid}`);
    const snapshot = (await request(app).get('/internal/metrics')).body as Record<string, number>;
    expect(snapshot.http_requests_total).toBeGreaterThanOrEqual(1);
    expect(snapshot.http_status_401_total).toBe(1);
    expect(snapshot.authentication_denials_total).toBe(1);
    expect(snapshot.http_request_duration_ms_count).toBeGreaterThanOrEqual(1);
    expect(Object.keys(snapshot).some((key) => key.includes(uuid))).toBe(false);
  });
});

const methods = new Set(['get', 'post', 'patch', 'put', 'delete']);
interface HttpOperation {
  operationId?: string;
  security?: unknown[];
  responses?: Record<string, unknown>;
}

const successBodies: Record<string, unknown> = {
  authenticateWithGoogle: { idToken: 'x'.repeat(20) },
  refreshSession: { refreshToken: 'x'.repeat(32) },
  confirmCurrentUserProfile: { fullName: 'Test User' },
  createTenant: { name: 'Tenant Test', timezone: 'Asia/Ho_Chi_Minh' },
  acceptInvitation: { token: 'x'.repeat(20) },
  updateTenantStatus: { status: 'ACTIVE', reason: 'Confirm active tenant' },
  createInvitation: {
    type: 'DIRECT',
    roleId: uuid,
    expiresAt: '2027-01-01T00:00:00.000Z',
  },
  createBranch: { code: 'BR01', name: 'Branch one' },
  updateBranchStatus: { status: 'ACTIVE', reason: 'Confirm active branch' },
  createDepartment: { code: 'DEP01', name: 'Department one' },
  updateDepartmentStatus: { status: 'ACTIVE', reason: 'Confirm active department' },
  createPosition: { code: 'POS01', name: 'Position one' },
  updatePositionStatus: { status: 'ACTIVE', reason: 'Confirm active position' },
  updateMembership: { reason: 'Confirm membership' },
  createAssignment: {
    branchId: uuid,
    effectiveFrom: '2026-07-19T00:00:00.000Z',
    reason: 'Assign member to branch',
  },
  createRole: {
    code: 'CUSTOM_ROLE',
    name: 'Custom role',
    permissionCodes: [],
    reason: 'Create custom role',
  },
  grantRoleBinding: {
    roleId: uuid,
    scopeType: 'TENANT',
    effectiveFrom: '2026-07-19T00:00:00.000Z',
    reason: 'Grant tenant role',
  },
  createFormTemplate: { code: 'FORM01', name: 'Form one' },
  publishFormVersion: {
    jsonSchema: { type: 'object' },
    effectiveFrom: '2026-07-19T00:00:00.000Z',
    reason: 'Publish form version',
  },
  archiveFormTemplate: { reason: 'Archive form template' },
  retireFormVersion: { reason: 'Retire form version' },
  submitDynamicForm: { formVersionId: uuid, data: {} },
  createChannel: { type: 'GROUP', name: 'Group channel', membershipIds: [] },
  sendMessage: { clientMessageId: 'message-0001', body: 'Hello' },
  registerNotificationEndpoint: {
    platform: 'ANDROID',
    provider: 'FCM',
    token: 'x'.repeat(20),
  },
  createMediaUploadIntent: {
    purpose: 'CHECKIN',
    contentType: 'image/jpeg',
    byteSize: 1024,
    checksumSha256: 'a'.repeat(64),
  },
};
