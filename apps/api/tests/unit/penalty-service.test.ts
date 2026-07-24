import { describe, expect, it, vi } from 'vitest';
import { PenaltyService } from '../../src/modules/penalties/penalty-service.js';

const settlement = {
  tenantId: 'tenant-a',
  id: 'settlement-a',
  membershipId: 'employee-a',
  branchId: 'branch-a',
  businessDate: new Date('2026-07-21T00:00:00.000Z'),
  status: 'PENDING',
  totalAmountMinor: 50_000n,
};

describe('PenaltyService employee self-service and manager review', () => {
  it('forces employee settlement queries to the authenticated membership', async () => {
    const listSettlements = vi.fn().mockResolvedValue([]);
    const service = new PenaltyService({ listSettlements } as never);

    await service.listSettlements({
      tenantId: 'tenant-a',
      actorMembershipId: 'employee-a',
      canManage: false,
      yearMonth: '2026-07',
      branchId: 'branch-a',
    });

    expect(listSettlements).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      yearMonth: '2026-07',
      branchId: 'branch-a',
      membershipId: 'employee-a',
    });
  });

  it('allows an employee to submit proof for their own pending settlement', async () => {
    const getSettlement = vi.fn().mockResolvedValue(settlement);
    const transitionPayment = vi.fn().mockResolvedValue({ ...settlement, status: 'SUBMITTED' });
    const service = new PenaltyService({ getSettlement, transitionPayment } as never);

    await service.transitionPayment({
      tenantId: 'tenant-a',
      settlementId: settlement.id,
      actorMembershipId: settlement.membershipId,
      correlationId: 'correlation-a',
      toStatus: 'SUBMITTED',
      amountMinor: 50_000n,
      mediaObjectId: 'media-a',
      reason: 'Da nop tien',
      idempotencyKey: 'proof-a',
      canManage: false,
    });

    expect(transitionPayment).toHaveBeenCalledOnce();
  });

  it('rejects employee access to another membership settlement', async () => {
    const service = new PenaltyService({
      getSettlement: vi.fn().mockResolvedValue(settlement),
    } as never);

    await expect(
      service.transitionPayment({
        tenantId: 'tenant-a',
        settlementId: settlement.id,
        actorMembershipId: 'employee-b',
        correlationId: 'correlation-a',
        toStatus: 'SUBMITTED',
        mediaObjectId: 'media-a',
        reason: 'Da nop tien',
        canManage: false,
      }),
    ).rejects.toMatchObject({ status: 403, code: 'AUTHORIZATION_DENIED' });
  });

  it('requires payment proof for employee submission', async () => {
    const service = new PenaltyService({
      getSettlement: vi.fn().mockResolvedValue(settlement),
    } as never);

    await expect(
      service.transitionPayment({
        tenantId: 'tenant-a',
        settlementId: settlement.id,
        actorMembershipId: settlement.membershipId,
        correlationId: 'correlation-a',
        toStatus: 'SUBMITTED',
        reason: 'Da nop tien',
        canManage: false,
      }),
    ).rejects.toMatchObject({ status: 422, code: 'VALIDATION_FAILED' });
  });

  it('rejects manager-only transitions from an employee', async () => {
    const service = new PenaltyService({
      getSettlement: vi.fn().mockResolvedValue({ ...settlement, status: 'SUBMITTED' }),
    } as never);

    await expect(
      service.transitionPayment({
        tenantId: 'tenant-a',
        settlementId: settlement.id,
        actorMembershipId: settlement.membershipId,
        correlationId: 'correlation-a',
        toStatus: 'CONFIRMED',
        reason: 'Da nhan tien',
        canManage: false,
      }),
    ).rejects.toMatchObject({ status: 403, code: 'AUTHORIZATION_DENIED' });
  });

  it('allows a scoped manager to confirm a submitted settlement', async () => {
    const submitted = { ...settlement, status: 'SUBMITTED' };
    const transitionPayment = vi.fn().mockResolvedValue({ ...submitted, status: 'CONFIRMED' });
    const service = new PenaltyService({
      getSettlement: vi.fn().mockResolvedValue(submitted),
      transitionPayment,
    } as never);

    await service.transitionPayment({
      tenantId: 'tenant-a',
      settlementId: settlement.id,
      actorMembershipId: 'manager-a',
      correlationId: 'correlation-a',
      toStatus: 'CONFIRMED',
      reason: 'Da nhan tien',
      canManage: true,
    });

    expect(transitionPayment).toHaveBeenCalledOnce();
  });

  it('rejects invalid payment state transitions', async () => {
    const service = new PenaltyService({
      getSettlement: vi.fn().mockResolvedValue({ ...settlement, status: 'CONFIRMED' }),
    } as never);

    await expect(
      service.transitionPayment({
        tenantId: 'tenant-a',
        settlementId: settlement.id,
        actorMembershipId: 'manager-a',
        correlationId: 'correlation-a',
        toStatus: 'REJECTED',
        reason: 'Khong hop le',
        canManage: true,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
  });
});
