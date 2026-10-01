import { describe, expect, it } from 'vitest';
import { createApp, type AppDependencies } from '../../src/app.js';
import { dependencies, send } from './published-http.contract.test.js';

const uuid = '10000000-0000-4000-8000-000000000001';

function channelDependencies(hasManagePermission: boolean) {
  return dependencies({
    rbacRepo: {
      async hasPermission() {
        return hasManagePermission;
      },
    } as unknown as AppDependencies['rbacRepo'],
  });
}

describe('chat channel creation permissions', () => {
  it('lets any active member create a GROUP channel without chat.manage', async () => {
    const app = createApp(channelDependencies(false));
    const response = await send(app, 'post', `/v1/tenants/${uuid}/channels`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'group-channel-create')
      .send({ type: 'GROUP', name: 'Nhóm ca sáng', membershipIds: [] });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: uuid });
  });

  it('lets any active member open a DIRECT channel with one other member', async () => {
    const app = createApp(channelDependencies(false));
    const response = await send(app, 'post', `/v1/tenants/${uuid}/channels`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'direct-channel-create')
      .send({ type: 'DIRECT', membershipIds: ['30000000-0000-4000-8000-000000000002'] });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: uuid });
  });

  it('requires a name for GROUP but not for DIRECT', async () => {
    const app = createApp(channelDependencies(false));
    const unnamedGroup = await send(app, 'post', `/v1/tenants/${uuid}/channels`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'group-channel-noname')
      .send({ type: 'GROUP', membershipIds: [] });
    expect(unnamedGroup.status).toBe(422);
    expect(unnamedGroup.body.code).toBe('VALIDATION_FAILED');

    const direct = await send(app, 'post', `/v1/tenants/${uuid}/channels`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'direct-channel-noname')
      .send({ type: 'DIRECT', membershipIds: ['30000000-0000-4000-8000-000000000003'] });
    expect(direct.status).toBe(201);
  });

  it('still requires chat.manage for BRANCH channels', async () => {
    const denied = createApp(channelDependencies(false));
    const forbidden = await send(denied, 'post', `/v1/tenants/${uuid}/channels`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'branch-channel-deny')
      .send({ type: 'BRANCH', name: 'Kênh chi nhánh', branchId: uuid });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('AUTHORIZATION_DENIED');

    const allowed = createApp(channelDependencies(true));
    const granted = await send(allowed, 'post', `/v1/tenants/${uuid}/channels`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'branch-channel-grant')
      .send({ type: 'BRANCH', name: 'Kênh chi nhánh', branchId: uuid });
    expect(granted.status).toBe(201);
  });
});
