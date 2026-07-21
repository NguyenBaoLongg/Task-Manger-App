import type { Clock, IdGenerator, MembershipId, TenantId, UserId, UUID } from './foundation.js';

export interface GooglePrincipal {
  subject: string;
  email?: string;
  emailVerified: boolean;
  providerName?: string;
}

export interface GoogleIdentityVerifier {
  verify(idToken: string): Promise<GooglePrincipal>;
}

export interface StoredObjectMetadata {
  contentType: string;
  byteSize: number;
  checksumSha256: string;
}

export interface ObjectStoragePort {
  createUploadUrl(input: {
    objectKey: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; expiresAt: Date; requiredHeaders: Record<string, string> }>;
  head(objectKey: string): Promise<StoredObjectMetadata | null>;
  createDownloadUrl(
    objectKey: string,
    expiresInSeconds: number,
  ): Promise<{ url: string; expiresAt: Date }>;
  delete(objectKey: string): Promise<void>;
}

export interface PushPort {
  send(input: {
    endpointId: UUID;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void>;
}

export interface RealtimePort {
  publish(room: string, event: string, payload: unknown): Promise<void>;
}

export interface AuditWrite {
  tenantId: TenantId;
  actorMembershipId?: MembershipId;
  actorUserId?: UserId;
  correlationId: string;
  eventType: string;
  targetType: string;
  targetId?: UUID;
  reason: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

export interface AuditPort {
  append(event: AuditWrite): Promise<void>;
}

export interface IdempotencyResult<T> {
  replayed: boolean;
  value: T;
}

export interface IdempotencyPort {
  execute<T>(
    scope: string,
    operation: string,
    key: string,
    request: unknown,
    action: () => Promise<T>,
  ): Promise<IdempotencyResult<T>>;
}

export interface UnitOfWork {
  transaction<T>(action: () => Promise<T>): Promise<T>;
}

export type { Clock, IdGenerator };
