import { describe, expect, it } from 'vitest';
import {
  isMembershipInPolicyScope,
  isRevisionInWindow,
  resolvePolicy,
  resolveTarget,
  snapshotPolicyInstants,
} from './policy.js';

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;

describe('KPI policy and time', () => {
  it('uses branch override over tenant fallback', () => {
    const resolved = resolvePolicy(
      [
        {
          id: id(1),
          scopeType: 'TENANT',
          effectiveFromDate: '2026-01-01',
          versionNumber: 1,
          timezone: 'Asia/Ho_Chi_Minh',
          reportOpenLocal: '18:00:00',
          reportCloseLocal: '20:00:00',
          evaluationLocal: '20:00:01',
        },
        {
          id: id(2),
          scopeType: 'BRANCH',
          branchId: id(9),
          effectiveFromDate: '2026-07-01',
          versionNumber: 1,
          timezone: 'Asia/Ho_Chi_Minh',
          reportOpenLocal: '18:30:00',
          reportCloseLocal: '20:30:00',
          evaluationLocal: '20:30:01',
        },
      ],
      id(9),
      '2026-07-19',
    );
    expect(resolved?.id).toBe(id(2));
  });

  it('uses the most specific effective target', () => {
    const instant = new Date('2026-07-19T12:00:00Z');
    const resolved = resolveTarget(
      [
        {
          id: id(1),
          kpiDefinitionId: id(8),
          scopeType: 'TENANT',
          versionNumber: 1,
          effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        },
        {
          id: id(2),
          kpiDefinitionId: id(8),
          scopeType: 'MEMBERSHIP',
          scopeId: id(7),
          versionNumber: 1,
          effectiveFrom: new Date('2026-07-01T00:00:00Z'),
        },
      ],
      instant,
    );
    expect(resolved?.id).toBe(id(2));
  });

  it('makes 20:00 exclusive in tenant timezone', () => {
    const instants = snapshotPolicyInstants(
      {
        timezone: 'Asia/Ho_Chi_Minh',
        reportOpenLocal: '18:00:00',
        reportCloseLocal: '20:00:00',
        evaluationLocal: '20:00:01',
      },
      '2026-07-19',
    );
    expect(instants.openedAt.toISOString()).toBe('2026-07-19T11:00:00.000Z');
    expect(instants.closedAt.toISOString()).toBe('2026-07-19T13:00:00.000Z');
    expect(isRevisionInWindow(new Date('2026-07-19T12:59:59.999Z'), instants)).toBe(true);
    expect(isRevisionInWindow(new Date('2026-07-19T13:00:00.000Z'), instants)).toBe(false);
  });

  it('honors explicit membership include/exclude policy scopes', () => {
    expect(isMembershipInPolicyScope({}, 'member-a')).toBe(true);
    expect(isMembershipInPolicyScope({ membershipIds: ['member-a'] }, 'member-a')).toBe(true);
    expect(isMembershipInPolicyScope({ membershipIds: ['member-a'] }, 'member-b')).toBe(false);
    expect(
      isMembershipInPolicyScope(
        { membershipIds: ['member-a'], excludedMembershipIds: ['member-a'] },
        'member-a',
      ),
    ).toBe(false);
  });
});
