import { randomUUID } from 'node:crypto';

export interface VideoConversionRepository {
  claimPendingVideoAssets(input: {
    tenantId: string;
    leaseOwner: string;
    now: Date;
    leaseDurationMs?: number;
    take?: number;
  }): Promise<Array<{ tenantId: string; id: string; attemptCount: number }>>;
  markVideoConversionReady?(input: {
    tenantId: string;
    id: string;
    leaseOwner: string;
    convertedMediaObjectId?: string;
  }): Promise<unknown>;
  markVideoConversionFailed(input: {
    tenantId: string;
    id: string;
    leaseOwner: string;
    safeErrorCode: string;
  }): Promise<unknown>;
}

export interface VideoConverter {
  convert(input: { tenantId: string; id: string }): Promise<{ convertedMediaObjectId?: string }>;
}

export class VideoConversionRunner {
  constructor(
    private readonly repository: VideoConversionRepository,
    private readonly converter: VideoConverter,
    private readonly leaseOwner = `video-conversion:${randomUUID()}`,
    private readonly leaseDurationMs = 300_000,
  ) {}

  async runTenant(tenantId: string) {
    const assets = await this.repository.claimPendingVideoAssets({
      tenantId,
      leaseOwner: this.leaseOwner,
      now: new Date(),
      leaseDurationMs: this.leaseDurationMs,
    });
    let ready = 0;
    let failed = 0;
    for (const asset of assets) {
      try {
        const result = await this.converter.convert({ tenantId: asset.tenantId, id: asset.id });
        await this.repository.markVideoConversionReady?.({
          tenantId: asset.tenantId,
          id: asset.id,
          leaseOwner: this.leaseOwner,
          convertedMediaObjectId: result.convertedMediaObjectId,
        });
        ready += 1;
      } catch {
        await this.repository.markVideoConversionFailed({
          tenantId: asset.tenantId,
          id: asset.id,
          leaseOwner: this.leaseOwner,
          safeErrorCode: 'VIDEO_CONVERSION_FAILED',
        });
        failed += 1;
      }
    }
    return { processed: assets.length, ready, failed };
  }
}
