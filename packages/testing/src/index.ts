import { createHash, randomUUID } from 'node:crypto';
import type {
  Clock,
  GoogleIdentityVerifier,
  GooglePrincipal,
  IdGenerator,
  ObjectStoragePort,
  PushPort,
  RealtimePort,
  StoredObjectMetadata,
} from '@adsup/domain';

export class FixedClock implements Clock {
  constructor(private current: Date) {}
  now() {
    return new Date(this.current);
  }
  advance(milliseconds: number) {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

export class SequentialIds implements IdGenerator {
  private counter = 0;
  uuid() {
    this.counter += 1;
    return `00000000-0000-4000-8000-${String(this.counter).padStart(12, '0')}`;
  }
}

export class FakeGoogleVerifier implements GoogleIdentityVerifier {
  async verify(idToken: string): Promise<GooglePrincipal> {
    const [prefix, subject, email] = idToken.split(':');
    if (prefix !== 'dev-google' || !subject) throw new Error('INVALID_GOOGLE_TOKEN');
    return { subject, email, emailVerified: Boolean(email), providerName: undefined };
  }
}

export class InMemoryObjectStorage implements ObjectStoragePort {
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

export class NoopPush implements PushPort {
  readonly sent: unknown[] = [];
  async send(input: unknown) {
    this.sent.push(input);
  }
}

export class InMemoryRealtime implements RealtimePort {
  readonly events: Array<{ room: string; event: string; payload: unknown }> = [];
  async publish(room: string, event: string, payload: unknown) {
    this.events.push({ room, event, payload });
  }
}

export const hashForTest = (value: string) => createHash('sha256').update(value).digest('hex');
export const randomIdForTest = () => randomUUID();
export * from './kpi.js';
export * from './timekeeping.js';
