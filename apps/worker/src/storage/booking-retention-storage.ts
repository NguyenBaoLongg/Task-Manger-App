import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { LocalExportStorage } from '../exports/export-storage.js';

export interface BookingRetentionDeleteInput {
  tenantId: string;
  objectKey: string;
}

export interface BookingRetentionStorage {
  delete(input: BookingRetentionDeleteInput): Promise<void>;
}

interface S3DeleteClient {
  send(command: DeleteObjectCommand): Promise<unknown>;
}

export interface BookingRetentionStorageConfig {
  objectStorageDriver: 'memory' | 's3';
  s3: {
    region: string;
    bucket: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  localRoot?: string;
}

function assertTenantScopedObjectKey(input: BookingRetentionDeleteInput) {
  const prefix = `${input.tenantId}/`;
  const relativeKey = input.objectKey.slice(prefix.length);
  if (
    !input.objectKey.startsWith(prefix) ||
    relativeKey.length === 0 ||
    relativeKey.split('/').some((segment) => segment === '..' || segment === '.')
  ) {
    throw new Error('BOOKING_OBJECT_SCOPE_VIOLATION');
  }
}

export class LocalRetentionObjectStorage implements BookingRetentionStorage {
  private readonly storage: LocalExportStorage;

  constructor(root = process.env.LOCAL_EXPORT_DIR ?? '.data/exports') {
    this.storage = new LocalExportStorage(root);
  }

  async delete(input: BookingRetentionDeleteInput) {
    assertTenantScopedObjectKey(input);
    await this.storage.delete(input.objectKey);
  }
}

export class S3RetentionObjectStorage implements BookingRetentionStorage {
  private readonly client: S3DeleteClient;

  constructor(
    private readonly bucket: string,
    config: {
      region: string;
      endpoint?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    },
    client?: S3DeleteClient,
  ) {
    if (!bucket) throw new Error('OBJECT_STORAGE_CONFIG_INVALID');
    this.client =
      client ??
      (new S3Client({
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
      }) as unknown as S3DeleteClient);
  }

  async delete(input: BookingRetentionDeleteInput) {
    assertTenantScopedObjectKey(input);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: input.objectKey }));
  }
}

export function createBookingRetentionObjectStorage(
  config: BookingRetentionStorageConfig,
): BookingRetentionStorage {
  if (config.objectStorageDriver === 's3') {
    return new S3RetentionObjectStorage(config.s3.bucket, config.s3);
  }
  return new LocalRetentionObjectStorage(config.localRoot);
}
