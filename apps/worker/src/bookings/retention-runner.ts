export interface BookingRetentionCandidate {
  tenantId: string;
  id: string;
  objectKey: string;
  purpose: string;
  createdAt?: Date;
  legalHoldAt?: Date | null;
  retentionUntil?: Date | null;
}

export interface BookingRetentionRepositoryLike {
  listBookingRetentionCandidates(
    tenantId: string,
    now: Date,
    take?: number,
  ): Promise<BookingRetentionCandidate[]>;
  getRetentionPolicyAt?(input: { tenantId: string; at: Date }): Promise<{ id: string } | null>;
  tombstoneMediaObject(input: {
    tenantId: string;
    mediaObjectId: string;
    policyVersionId?: string | null;
    reason: string;
  }): Promise<unknown>;
}

export type BookingRetentionObjectDeleter = BookingRetentionStorage;

export class BookingRetentionRunner {
  constructor(
    private readonly repository: BookingRetentionRepositoryLike,
    private readonly storage: BookingRetentionObjectDeleter,
  ) {}

  async runTenant(input: { tenantId: string; now?: Date; take?: number }) {
    const now = input.now ?? new Date();
    const candidates = await this.repository.listBookingRetentionCandidates(
      input.tenantId,
      now,
      input.take,
    );
    let deleted = 0;
    let skippedLegalHold = 0;
    let failed = 0;
    for (const media of candidates) {
      if (media.legalHoldAt) {
        skippedLegalHold += 1;
        continue;
      }
      try {
        const deleteInput: BookingRetentionDeleteInput = {
          tenantId: media.tenantId,
          objectKey: media.objectKey,
        };
        await this.storage.delete(deleteInput);
        const policy =
          media.createdAt && this.repository.getRetentionPolicyAt
            ? await this.repository.getRetentionPolicyAt({
                tenantId: media.tenantId,
                at: media.createdAt,
              })
            : null;
        await this.repository.tombstoneMediaObject({
          tenantId: media.tenantId,
          mediaObjectId: media.id,
          policyVersionId: policy?.id,
          reason: `RETENTION_EXPIRED:${media.purpose}`,
        });
        deleted += 1;
      } catch {
        failed += 1;
      }
    }
    return { processed: candidates.length, deleted, skippedLegalHold, failed };
  }
}
import type {
  BookingRetentionDeleteInput,
  BookingRetentionStorage,
} from '../storage/booking-retention-storage.js';
