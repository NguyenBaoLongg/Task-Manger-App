import {
  HeadObjectCommand,
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ObjectStoragePort, StoredObjectMetadata } from '@adsup/domain';

export class S3ObjectStorage implements ObjectStoragePort {
  private readonly client: S3Client;
  constructor(
    private readonly bucket: string,
    config: { region: string; endpoint?: string; accessKeyId?: string; secretAccessKey?: string },
  ) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: Boolean(config.endpoint),
      ...(config.accessKeyId && config.secretAccessKey
        ? {
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          }
        : {}),
    });
  }
  async createUploadUrl(input: {
    objectKey: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
    expiresInSeconds: number;
  }) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
      ContentLength: input.byteSize,
      Metadata: { sha256: input.checksumSha256 },
    });
    return {
      url: await getSignedUrl(this.client, command, { expiresIn: input.expiresInSeconds }),
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1_000),
      requiredHeaders: {
        'content-type': input.contentType,
        'x-amz-meta-sha256': input.checksumSha256,
      },
    };
  }
  async head(objectKey: string): Promise<StoredObjectMetadata | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      return {
        contentType: result.ContentType ?? 'application/octet-stream',
        byteSize: result.ContentLength ?? 0,
        checksumSha256: result.Metadata?.sha256 ?? '',
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') return null;
      throw error;
    }
  }
  async createDownloadUrl(objectKey: string, expiresInSeconds: number) {
    return {
      url: await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
        { expiresIn: expiresInSeconds },
      ),
      expiresAt: new Date(Date.now() + expiresInSeconds * 1_000),
    };
  }
  async delete(objectKey: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }
}

export class MemoryObjectStorage implements ObjectStoragePort {
  private readonly objects = new Map<string, StoredObjectMetadata>();
  put(objectKey: string, metadata: StoredObjectMetadata) {
    this.objects.set(objectKey, metadata);
  }
  async createUploadUrl(input: {
    objectKey: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
    expiresInSeconds: number;
  }) {
    return {
      url: `memory://upload/${encodeURIComponent(input.objectKey)}`,
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1_000),
      requiredHeaders: {
        'content-type': input.contentType,
        'x-checksum-sha256': input.checksumSha256,
      },
    };
  }
  async head(objectKey: string) {
    return this.objects.get(objectKey) ?? null;
  }
  async createDownloadUrl(objectKey: string, expiresInSeconds: number) {
    return {
      url: `memory://download/${encodeURIComponent(objectKey)}`,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1_000),
    };
  }
  async delete(objectKey: string) {
    this.objects.delete(objectKey);
  }
}
