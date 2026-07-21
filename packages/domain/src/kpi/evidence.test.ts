import { describe, expect, it } from 'vitest';
import {
  assertNoPerceptualFraudDecision,
  nextEvidenceState,
  requiredEvidenceCount,
} from './evidence.js';

describe('KPI evidence policy', () => {
  it('counts configured KPI evidence plus revenue once', () => {
    expect(
      requiredEvidenceCount({
        evidenceEnabled: true,
        kpisRequiringEvidence: 2,
        formHasRevenue: true,
      }),
    ).toBe(3);
    expect(
      requiredEvidenceCount({
        evidenceEnabled: false,
        kpisRequiringEvidence: 9,
        formHasRevenue: true,
      }),
    ).toBe(0);
  });
  it('closes when enough READY evidence has been counted by repository', () => {
    expect(
      nextEvidenceState({
        current: 'WAITING_PHOTOS',
        requiredCount: 3,
        receivedCount: 3,
        now: new Date(0),
        deadlineAt: new Date(1),
      }),
    ).toBe('SATISFIED');
  });
  it('becomes overdue at the exact deadline and terminal states do not reopen', () => {
    expect(
      nextEvidenceState({
        current: 'WAITING_PHOTOS',
        requiredCount: 3,
        receivedCount: 2,
        now: new Date(1),
        deadlineAt: new Date(1),
      }),
    ).toBe('OVERDUE');
    expect(
      nextEvidenceState({
        current: 'OVERDUE',
        requiredCount: 3,
        receivedCount: 3,
        now: new Date(2),
        deadlineAt: new Date(1),
      }),
    ).toBe('OVERDUE');
  });
  it('keeps perceptual fraud decision disabled in MVP', () => {
    expect(assertNoPerceptualFraudDecision()).toBe('DISABLED_IN_MVP');
  });
});
