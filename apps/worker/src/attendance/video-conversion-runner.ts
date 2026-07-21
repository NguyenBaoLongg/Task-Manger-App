export interface VideoConversionRepository {
  listPendingVideoAssets(
    tenantId: string,
    take?: number,
  ): Promise<Array<{ tenantId: string; id: string; attemptCount: number }>>;
  markVideoConversionReady?(input: {
    tenantId: string;
    id: string;
    convertedMediaObjectId?: string;
  }): Promise<unknown>;
  markVideoConversionFailed(input: {
    tenantId: string;
    id: string;
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
  ) {}

  async runTenant(tenantId: string) {
    const assets = await this.repository.listPendingVideoAssets(tenantId);
    let ready = 0;
    let failed = 0;
    for (const asset of assets) {
      try {
        const result = await this.converter.convert({ tenantId: asset.tenantId, id: asset.id });
        await this.repository.markVideoConversionReady?.({
          tenantId: asset.tenantId,
          id: asset.id,
          convertedMediaObjectId: result.convertedMediaObjectId,
        });
        ready += 1;
      } catch {
        await this.repository.markVideoConversionFailed({
          tenantId: asset.tenantId,
          id: asset.id,
          safeErrorCode: 'VIDEO_CONVERSION_FAILED',
        });
        failed += 1;
      }
    }
    return { processed: assets.length, ready, failed };
  }
}
