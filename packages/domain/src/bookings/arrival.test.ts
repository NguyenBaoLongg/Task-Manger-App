import { describe, expect, it } from 'vitest';
import { decideArrival, decidePhotoDebtResolution, decideTourCompletion } from './arrival.js';

describe('booking arrival and customer-photo rules', () => {
  it('moves only a matching SCHEDULED booking to ARRIVED', () => {
    expect(
      decideArrival({
        status: 'SCHEDULED',
        stateVersion: 2,
        expectedStateVersion: 2,
        hasReadyCustomerPhoto: true,
      }),
    ).toEqual({
      nextStatus: 'ARRIVED',
      nextStateVersion: 3,
      opensPhotoDebt: false,
    });
    expect(() =>
      decideArrival({
        status: 'SCHEDULED',
        stateVersion: 2,
        expectedStateVersion: 1,
        hasReadyCustomerPhoto: false,
      }),
    ).toThrowError(expect.objectContaining({ code: 'CONFLICT' }));
  });

  it('opens one photo debt when ARRIVED has no READY customer photo', () => {
    expect(
      decideArrival({
        status: 'SCHEDULED',
        stateVersion: 1,
        expectedStateVersion: 1,
        hasReadyCustomerPhoto: false,
      }),
    ).toMatchObject({ opensPhotoDebt: true });
    expect(
      decideArrival({
        status: 'ARRIVED',
        stateVersion: 2,
        expectedStateVersion: 2,
        hasReadyCustomerPhoto: false,
      }),
    ).toEqual({
      nextStatus: 'ARRIVED',
      nextStateVersion: 2,
      opensPhotoDebt: true,
    });
  });

  it('resolves only an OPEN debt and makes retries a no-op', () => {
    expect(decidePhotoDebtResolution('OPEN')).toEqual({
      changed: true,
      nextState: 'RESOLVED',
    });
    expect(decidePhotoDebtResolution('RESOLVED')).toEqual({
      changed: false,
      nextState: 'RESOLVED',
    });
    expect(decidePhotoDebtResolution('WAIVED')).toEqual({
      changed: false,
      nextState: 'WAIVED',
    });
  });

  it('requires ARRIVED, a matching version and READY scoped photo for tour completion', () => {
    expect(
      decideTourCompletion({
        status: 'ARRIVED',
        stateVersion: 3,
        expectedStateVersion: 3,
        hasReadyCustomerPhoto: true,
      }),
    ).toEqual({ allowed: true });
    expect(() =>
      decideTourCompletion({
        status: 'SCHEDULED',
        stateVersion: 1,
        expectedStateVersion: 1,
        hasReadyCustomerPhoto: true,
      }),
    ).toThrowError(expect.objectContaining({ code: 'BUSINESS_RULE_VIOLATION' }));
    expect(() =>
      decideTourCompletion({
        status: 'ARRIVED',
        stateVersion: 2,
        expectedStateVersion: 2,
        hasReadyCustomerPhoto: false,
      }),
    ).toThrowError(expect.objectContaining({ code: 'BUSINESS_RULE_VIOLATION' }));
  });
});
