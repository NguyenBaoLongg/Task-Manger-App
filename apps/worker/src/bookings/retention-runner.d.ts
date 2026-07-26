export interface BookingRetentionCandidate {
  tenantId: string;
  id: string;
  objectKey: string;
  purpose: string;
  legalHoldAt?: Date | null;
  retentionUntil?: Date | null;
}
export interface BookingRetentionRepositoryLike {
  listBookingRetentionCandidates(
    tenantId: string,
    now: Date,
    take?: number,
  ): Promise<BookingRetentionCandidate[]>;
  tombstoneMediaObject(input: {
    tenantId: string;
    mediaObjectId: string;
    policyVersionId?: string | null;
    reason: string;
  }): Promise<unknown>;
}
export interface BookingRetentionObjectDeleter {
  delete(objectKey: string): Promise<void>;
}
export declare class BookingRetentionRunner {
  private readonly repository;
  private readonly storage;
  constructor(repository: BookingRetentionRepositoryLike, storage: BookingRetentionObjectDeleter);
  runTenant(input: { tenantId: string; now?: Date; take?: number }): Promise<{
    processed: number;
    deleted: number;
    skippedLegalHold: number;
    failed: number;
  }>;
}
//# sourceMappingURL=retention-runner.d.ts.map
