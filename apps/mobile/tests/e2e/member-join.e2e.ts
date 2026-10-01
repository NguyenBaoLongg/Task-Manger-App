import { expect } from 'detox';
import { by, device, element, waitFor } from 'detox';
import { emitDetoxMetric, tapId, waitForId, VISIBILITY_TIMEOUT_MS } from './helpers';

/**
 * Seeds the invitation through the fake-mode API before the app launches, then drives the app
 * as a brand-new Google subject with the releaseE2e test double. No real Google credential is
 * involved (constitution VI). The seeded owner account is the one every other E2E suite signs in
 * as, so the invitation is created with its own token and permission set.
 */
const API_BASE = `http://127.0.0.1:${process.env.ADSUP_E2E_API_PORT ?? 3000}`;
const OWNER_ID_TOKEN = 'dev-google:local-mobile-user:local-mobile-user@adsup.local';
const TENANT_ID = '10000000-0000-4000-8000-000000000001';

type AuthResult = { accessToken: string };

const apiRequest = async (
  path: string,
  options: { method?: string; body?: unknown; accessToken?: string; idempotencyKey?: string } = {},
): Promise<unknown> => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {}),
      ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    throw new Error(`API ${options.method ?? 'POST'} ${path} failed: ${response.status}`);
  }
  if (response.status === 204) return undefined;
  return (await response.json()) as unknown;
};

const signInAsOwner = async (): Promise<string> => {
  const auth = (await apiRequest('/v1/auth/google', {
    body: { idToken: OWNER_ID_TOKEN },
    idempotencyKey: `member-join-owner-${Date.now()}`,
  })) as AuthResult;
  return auth.accessToken;
};

const createInvitationToken = async (accessToken: string): Promise<string> => {
  const roles = (await apiRequest(`/v1/tenants/${TENANT_ID}/roles`, {
    method: 'GET',
    accessToken,
  })) as { id: string; code: string }[];
  const employee = roles.find((role) => role.code === 'EMPLOYEE');
  if (!employee) throw new Error('Seeded EMPLOYEE role missing');
  const invitation = (await apiRequest(`/v1/tenants/${TENANT_ID}/invitations`, {
    body: {
      type: 'DIRECT',
      roleId: employee.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    accessToken,
    idempotencyKey: `member-join-invite-${Date.now()}`,
  })) as { token: string };
  return invitation.token;
};

describe('member join e2e', () => {
  it('a new account confirms its profile, joins with an invitation code and lands in the workspace list', async () => {
    const invitationToken = await createInvitationToken(await signInAsOwner());
    const subject = `member-join-${Date.now()}`;

    const launchStartedAt = Date.now();
    await device.launchApp({
      delete: true,
      launchArgs: { 'ui-test-google-subject': subject },
      newInstance: true,
    });
    await waitForId('auth.sign-in');
    emitDetoxMetric('LAUNCH_TO_SIGNIN_TOTAL_MS', { ms: Date.now() - launchStartedAt });

    // CR-005: sign-in interactive time measured from a warm relaunch, excluding the Detox
    // delete/reinstall overhead on LDPlayer that dominates the cold number above.
    const renderStartedAt = Date.now();
    await device.relaunchApp({
      delete: false,
      launchArgs: { 'ui-test-google-subject': subject },
      newInstance: true,
    });
    await waitForId('auth.sign-in');
    emitDetoxMetric('SIGNIN_SCREEN_READY_MS', { ms: Date.now() - renderStartedAt });

    await tapId('auth.sign-in');

    // A fresh Google subject has no confirmed profile, so the app routes there first.
    await waitFor(element(by.text('Xác nhận hồ sơ')))
      .toBeVisible()
      .withTimeout(VISIBILITY_TIMEOUT_MS);
    await element(by.label('Họ và tên')).tap();
    await element(by.label('Họ và tên')).replaceText('Người Được Mời');
    await tapId('profile-confirm.submit');

    // The empty workspace list exposes the join entry (FR-008).
    await tapId('workspace.join-company');

    await element(by.id('join-company.code')).tap();
    await element(by.id('join-company.code')).replaceText(invitationToken);
    await tapId('join-company.submit');

    // The profile is confirmed, so accept succeeds and the tenant appears immediately (FR-009).
    await waitForId('workspace.option', { timeout: VISIBILITY_TIMEOUT_MS });
    await expect(element(by.text('Công ty TNHH ABC'))).toBeVisible();
  });
});
