export class BookingRetentionRunner {
  repository;
  storage;
  constructor(repository, storage) {
    this.repository = repository;
    this.storage = storage;
  }
  async runTenant(input) {
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
        await this.storage.delete(media.objectKey);
        await this.repository.tombstoneMediaObject({
          tenantId: media.tenantId,
          mediaObjectId: media.id,
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
//# sourceMappingURL=retention-runner.js.map
