export interface RetentionMediaObject {
  tenantId: string;
  id: string;
  objectKey: string;
  legalHoldAt?: Date | null;
}

export interface MediaRetentionRepositoryLike {
  listRetentionCandidates(
    tenantId: string,
    now: Date,
    take?: number,
  ): Promise<RetentionMediaObject[]>;
  tombstoneMediaObject(input: {
    tenantId: string;
    mediaObjectId: string;
    deletedByJobRunId?: string | null;
    reason: string;
  }): Promise<unknown>;
}

export interface RetentionObjectDeleter {
  delete(objectKey: string): Promise<void>;
}

export class MediaRetentionRunner {
  constructor(
    private readonly repository: MediaRetentionRepositoryLike,
    private readonly storage?: RetentionObjectDeleter,
  ) {}

  async runTenant(input: { tenantId: string; now?: Date; take?: number }) {
    const now = input.now ?? new Date();
    const candidates = await this.repository.listRetentionCandidates(
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
        await this.storage?.delete(media.objectKey);
        await this.repository.tombstoneMediaObject({
          tenantId: media.tenantId,
          mediaObjectId: media.id,
          reason: 'RETENTION_EXPIRED',
        });
        deleted += 1;
      } catch {
        failed += 1;
      }
    }
    return { processed: candidates.length, deleted, skippedLegalHold, failed };
  }
}
