import { describe, expect, it, vi } from 'vitest';
import { PenaltyRepository } from '@adsup/database';
import { PenaltyService } from '../../src/modules/penalties/penalty-service.js';

describe('attendance penalties integration harness', () => {
  it('wires violation assessment to settlement projection for late and independent no-notice components', async () => {
    const assessLateOccurrence = vi.fn(async () => ({
      id: 'settlement-1',
      totalAmountMinor: 120_000n,
      componentSnapshotJson: [
        { kind: 'LATE_BASE', amountMinor: '20_000' },
        { kind: 'LATE_NO_NOTICE', amountMinor: '100_000' },
      ],
    }));
    const service = new PenaltyService({ assessLateOccurrence } as never);

    await expect(
      service.assessLateOccurrence({
        tenantId: 'tenant-1',
        lateOccurrenceId: 'late-1',
        correlationId: 'corr-1',
      }),
    ).resolves.toMatchObject({ id: 'settlement-1' });

    expect(assessLateOccurrence).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      lateOccurrenceId: 'late-1',
      correlationId: 'corr-1',
    });
  });

  it('keeps employee proof submission owner-scoped and manager decisions role-scoped', async () => {
    const employeeSettlement = {
      tenantId: 'tenant-1',
      id: 'settlement-1',
      membershipId: 'employee-1',
      branchId: 'branch-1',
      businessDate: new Date('2026-07-21T00:00:00.000Z'),
      status: 'PENDING',
      totalAmountMinor: 50_000n,
    };
    const getSettlement = vi
      .fn()
      .mockResolvedValueOnce(employeeSettlement)
      .mockResolvedValueOnce({ ...employeeSettlement, status: 'SUBMITTED' });
    const transitionPayment = vi
      .fn()
      .mockResolvedValueOnce({ ...employeeSettlement, status: 'SUBMITTED' })
      .mockResolvedValueOnce({ ...employeeSettlement, status: 'CONFIRMED' });
    const service = new PenaltyService({ getSettlement, transitionPayment } as never);

    await service.transitionPayment({
      tenantId: 'tenant-1',
      settlementId: 'settlement-1',
      actorMembershipId: 'employee-1',
      correlationId: 'corr-submit',
      toStatus: 'SUBMITTED',
      amountMinor: 50_000n,
      mediaObjectId: 'media-proof-1',
      reason: 'Da nop tien',
      idempotencyKey: 'submit-1',
      canManage: false,
    });
    await service.transitionPayment({
      tenantId: 'tenant-1',
      settlementId: 'settlement-1',
      actorMembershipId: 'manager-1',
      correlationId: 'corr-confirm',
      toStatus: 'CONFIRMED',
      reason: 'Da xac nhan',
      idempotencyKey: 'confirm-1',
      canManage: true,
    });

    expect(transitionPayment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tenantId: 'tenant-1',
        actorMembershipId: 'employee-1',
        idempotencyKey: 'submit-1',
      }),
    );
    expect(transitionPayment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        tenantId: 'tenant-1',
        actorMembershipId: 'manager-1',
        idempotencyKey: 'confirm-1',
      }),
    );
  });

  it('persists one idempotent transition with an audit record and redacted outbox event', async () => {
    const state = {
      settlement: {
        tenantId: 'tenant-1',
        id: 'settlement-1',
        membershipId: 'employee-1',
        branchId: 'branch-1',
        businessDate: new Date('2026-07-21T00:00:00.000Z'),
        status: 'SUBMITTED' as const,
        totalAmountMinor: 50_000n,
      },
      transitions: [] as Array<Record<string, unknown>>,
      audits: [] as Array<Record<string, unknown>>,
      outbox: [] as Array<Record<string, unknown>>,
    };
    const transaction = {
      penaltyPaymentTransition: {
        findUnique: async (input: {
          where: {
            tenantId_actorMembershipId_idempotencyKey: {
              tenantId: string;
              actorMembershipId: string;
              idempotencyKey: string;
            };
          };
        }) =>
          state.transitions.find((item) => {
            const key = input.where.tenantId_actorMembershipId_idempotencyKey;
            return (
              item.tenantId === key.tenantId &&
              item.actorMembershipId === key.actorMembershipId &&
              item.idempotencyKey === key.idempotencyKey
            );
          }) ?? null,
        create: async (input: { data: Record<string, unknown> }) => {
          state.transitions.push(input.data);
          return input.data;
        },
      },
      penaltySettlement: {
        findUniqueOrThrow: async (input: {
          where: { tenantId_id: { tenantId: string; id: string } };
        }) => {
          const key = input.where.tenantId_id;
          if (key.tenantId !== state.settlement.tenantId || key.id !== state.settlement.id) {
            throw new Error('not found');
          }
          return { ...state.settlement };
        },
        updateMany: async (input: {
          where: { tenantId: string; id: string; status: string };
          data: { status: typeof state.settlement.status };
        }) => {
          if (
            input.where.tenantId !== state.settlement.tenantId ||
            input.where.id !== state.settlement.id ||
            input.where.status !== state.settlement.status
          ) {
            return { count: 0 };
          }
          state.settlement = { ...state.settlement, status: input.data.status };
          return { count: 1 };
        },
      },
      auditEvent: {
        create: async (input: { data: Record<string, unknown> }) => {
          state.audits.push(input.data);
          return input.data;
        },
      },
      outboxEvent: {
        create: async (input: { data: Record<string, unknown> }) => {
          state.outbox.push(input.data);
          return input.data;
        },
      },
    };
    const repository = new PenaltyRepository({
      $transaction: async (operation: (tx: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    } as never);
    const input = {
      tenantId: 'tenant-1',
      settlementId: 'settlement-1',
      toStatus: 'CONFIRMED' as const,
      amountMinor: 50_000n,
      actorMembershipId: 'manager-1',
      reason: 'Da nhan tien',
      idempotencyKey: 'confirm-1',
      correlationId: 'correlation-1',
    };

    await repository.transitionPayment(input);
    await repository.transitionPayment(input);

    expect(state.settlement.status).toBe('CONFIRMED');
    expect(state.transitions).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
    expect(state.outbox).toHaveLength(1);
    expect(state.outbox[0]).toMatchObject({
      tenantId: 'tenant-1',
      eventType: 'attendance.penalty.payment-transitioned',
      dedupeKey: 'attendance-penalty-payment:tenant-1:confirm-1',
    });
    expect(JSON.stringify(state.outbox[0])).not.toContain('mediaObjectId');
  });
});
