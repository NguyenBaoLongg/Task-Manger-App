import { randomUUID } from 'node:crypto';
import { ProblemError, type ObjectStoragePort } from '@adsup/domain';
import type { MediaRepository, OrganizationRbacRepository } from '@adsup/database';

const allowedContentTypes = /^(image\/(jpeg|png|webp)|video\/mp4|application\/pdf)$/;
const sensitiveMediaLogKeys =
  /url|objectkey|bucket|token|secret|checksum|customer|displayname|phone|email|note/i;

export function redactMediaForLog(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !sensitiveMediaLogKeys.test(key)),
  );
}

export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly storage: ObjectStoragePort,
    private readonly bucket: string,
    private readonly signedUrlTtlSeconds: number,
    private readonly authorization?: OrganizationRbacRepository,
    private readonly telemetry?: { increment(name: string): void },
  ) {}
  async createIntent(input: {
    tenantId: string;
    actorMembershipId: string;
    branchId?: string | null;
    sourceType?: string;
    sourceId?: string | null;
    consentId?: string;
    purpose: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
    correlationId: string;
  }) {
    const checksum = input.checksumSha256.toLowerCase();
    if (
      !allowedContentTypes.test(input.contentType) ||
      input.byteSize < 1 ||
      input.byteSize > 524_288_000 ||
      !/^[0-9a-f]{64}$/.test(checksum)
    )
      throw new ProblemError(
        422,
        'VALIDATION_FAILED',
        'Loại, kích thước hoặc checksum media không hợp lệ.',
      );
    const customerPhotoRequest = input.purpose === 'CUSTOMER_BOOKING_PHOTO';
    if (customerPhotoRequest) {
      if (
        input.sourceType !== 'BOOKING' ||
        !input.sourceId ||
        !input.branchId ||
        !input.consentId
      ) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Ảnh khách cần lịch hẹn, cơ sở và đồng ý chụp ảnh hợp lệ.',
        );
      }
      const authorization = await this.repository.getCustomerPhotoAuthorization({
        tenantId: input.tenantId,
        branchId: input.branchId,
        bookingId: input.sourceId,
        consentId: input.consentId,
      });
      if (!authorization) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Đồng ý chụp ảnh không hợp lệ cho lịch hẹn này.',
        );
      }
    } else if (input.sourceId) {
      if (!input.sourceType)
        throw new ProblemError(422, 'VALIDATION_FAILED', 'sourceType là bắt buộc khi có sourceId.');
      const source = await this.repository.getSource(
        input.tenantId,
        input.sourceType,
        input.sourceId,
      );
      if (!source)
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy nguồn media hợp lệ.');
      const canRead =
        source.ownerMembershipId === input.actorMembershipId ||
        (await this.authorization?.hasPermission(
          input.tenantId,
          input.actorMembershipId,
          'media.read',
          source.branchId ?? undefined,
        ));
      if (!canRead)
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy nguồn media hợp lệ.');
      if (source.branchId && input.branchId && source.branchId !== input.branchId)
        throw new ProblemError(422, 'VALIDATION_FAILED', 'Nguồn media không thuộc cơ sở đã chọn.');
    }
    const mediaId = randomUUID();
    const objectKey = `${input.tenantId}/${mediaId}`;
    const upload = await this.adapterCall(() =>
      this.storage.createUploadUrl({
        objectKey,
        contentType: input.contentType,
        byteSize: input.byteSize,
        checksumSha256: checksum,
        expiresInSeconds: this.signedUrlTtlSeconds,
      }),
    );
    const media = await this.repository.createIntent({
      tenantId: input.tenantId,
      ownerMembershipId: input.actorMembershipId,
      branchId: input.branchId,
      sourceType: input.sourceType ?? 'UNATTACHED',
      sourceId: input.sourceId,
      purpose: input.purpose,
      consentId: input.consentId,
      storageProvider: 's3-compatible',
      bucket: this.bucket,
      objectKey,
      contentType: input.contentType,
      byteSize: BigInt(input.byteSize),
      checksumSha256: checksum,
      uploadExpiresAt: new Date(Date.now() + this.signedUrlTtlSeconds * 1_000),
      correlationId: input.correlationId,
    });
    return { media: this.present(media), upload };
  }
  async complete(
    tenantId: string,
    mediaId: string,
    actorMembershipId: string,
    correlationId: string,
  ) {
    const media = await this.get(tenantId, mediaId);
    await this.assertMediaAccess(media, actorMembershipId);
    if (media.status === 'READY') return this.present(media);
    if (media.status !== 'PENDING_UPLOAD' || media.uploadExpiresAt <= new Date())
      throw new ProblemError(409, 'CONFLICT', 'Ý định tải media không còn hiệu lực.');
    const object = await this.adapterCall(() => this.storage.head(media.objectKey));
    if (
      !object ||
      object.contentType !== media.contentType ||
      BigInt(object.byteSize) !== media.byteSize ||
      object.checksumSha256 !== media.checksumSha256
    ) {
      await this.repository.markRejected(tenantId, mediaId, actorMembershipId, correlationId);
      throw new ProblemError(422, 'VALIDATION_FAILED', 'Media tải lên không khớp thông tin đã ký.');
    }
    return this.present(
      await this.repository.markReady(tenantId, mediaId, actorMembershipId, correlationId),
    );
  }
  async download(tenantId: string, mediaId: string, actorMembershipId: string) {
    const media = await this.get(tenantId, mediaId);
    await this.assertMediaAccess(media, actorMembershipId);
    if (media.status !== 'READY') throw new ProblemError(409, 'CONFLICT', 'Media chưa sẵn sàng.');
    return this.adapterCall(() =>
      this.storage.createDownloadUrl(media.objectKey, this.signedUrlTtlSeconds),
    );
  }
  private async get(tenantId: string, id: string) {
    const media = await this.repository.get(tenantId, id);
    if (!media) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy media.');
    return media;
  }
  private async assertMediaAccess(
    media: { tenantId: string; ownerMembershipId: string; branchId: string | null },
    actorMembershipId: string,
  ) {
    if (media.ownerMembershipId === actorMembershipId) return;
    if (
      await this.authorization?.hasPermission(
        media.tenantId,
        actorMembershipId,
        'media.read',
        media.branchId ?? undefined,
      )
    )
      return;
    throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy media.');
  }
  private present<T extends { byteSize: bigint }>(media: T) {
    return { ...media, byteSize: Number(media.byteSize) };
  }
  private async adapterCall<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      this.telemetry?.increment('adapter_failures_total');
      throw error;
    }
  }
}
