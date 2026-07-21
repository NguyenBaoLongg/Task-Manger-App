import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ProblemError, redact, type AuditWrite } from '@adsup/domain';
import type { DatabaseClient } from './client.js';
import type { Prisma } from './generated/prisma/client.js';

function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function jsonSafe(value: unknown, depth = 0): unknown {
  if (depth > 16) return '[TRUNCATED]';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((item) => jsonSafe(item, depth + 1));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        jsonSafe(item, depth + 1),
      ]),
    );
  return value;
}

export const requestHash = (value: unknown) =>
  createHash('sha256').update(canonical(value)).digest('hex');

export class GovernanceRepository {
  private readonly cipherKey: Buffer;
  constructor(
    private readonly db: DatabaseClient,
    encryptionSecret = 'local-development-idempotency-key',
    private readonly telemetry?: { increment(name: string): void },
  ) {
    this.cipherKey = createHash('sha256').update(encryptionSecret).digest();
  }

  private encrypt(value: unknown): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.cipherKey, iv);
    const plaintext = JSON.stringify(jsonSafe(value));
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
  }

  private decrypt<T>(ciphertext: string): T {
    const [iv, tag, encrypted] = ciphertext
      .split('.')
      .map((part) => Buffer.from(part!, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', this.cipherKey, iv!);
    decipher.setAuthTag(tag!);
    return JSON.parse(
      Buffer.concat([decipher.update(encrypted!), decipher.final()]).toString('utf8'),
    ) as T;
  }

  async appendAudit(event: AuditWrite): Promise<void> {
    await this.db.auditEvent.create({
      data: {
        tenantId: event.tenantId,
        actorMembershipId: event.actorMembershipId,
        actorUserId: event.actorUserId,
        correlationId: event.correlationId,
        eventType: event.eventType,
        targetType: event.targetType,
        targetId: event.targetId,
        reason: event.reason,
        beforeRedacted: redact(event.before) as Prisma.InputJsonValue,
        afterRedacted: redact(event.after) as Prisma.InputJsonValue,
        metadataRedacted: redact(event.metadata) as Prisma.InputJsonValue,
      },
    });
  }

  async executeTenantIdempotent<T>(input: {
    tenantId: string;
    membershipId: string;
    operation: string;
    key: string;
    request: unknown;
    action: () => Promise<T>;
  }): Promise<{ replayed: boolean; value: T }> {
    const hash = requestHash(input.request);
    const existing = await this.db.tenantIdempotencyRecord.findUnique({
      where: {
        tenantId_membershipId_operation_key: {
          tenantId: input.tenantId,
          membershipId: input.membershipId,
          operation: input.operation,
          key: input.key,
        },
      },
    });
    if (existing?.requestHash !== undefined && existing.requestHash !== hash) {
      throw new ProblemError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'Khóa idempotency đã dùng cho yêu cầu khác.',
      );
    }
    if (existing?.status === 'COMPLETED' && existing.responseBodyCiphertext) {
      this.telemetry?.increment('idempotency_replays_total');
      return { replayed: true, value: this.decrypt<T>(existing.responseBodyCiphertext) };
    }
    if (existing && existing.lockedUntil > new Date())
      throw new ProblemError(409, 'CONFLICT', 'Yêu cầu cùng khóa đang được xử lý.');
    if (existing) {
      const claim = await this.db.tenantIdempotencyRecord.updateMany({
        where: { tenantId: input.tenantId, id: existing.id, lockedUntil: { lte: new Date() } },
        data: { status: 'PROCESSING', lockedUntil: new Date(Date.now() + 30_000) },
      });
      if (claim.count !== 1)
        throw new ProblemError(409, 'CONFLICT', 'Yêu cầu cùng khóa đang được xử lý.');
    } else {
      try {
        await this.db.tenantIdempotencyRecord.create({
          data: {
            tenantId: input.tenantId,
            membershipId: input.membershipId,
            operation: input.operation,
            key: input.key,
            requestHash: hash,
            lockedUntil: new Date(Date.now() + 30_000),
            expiresAt: new Date(Date.now() + 86_400_000),
          },
        });
      } catch (error) {
        const raced = await this.db.tenantIdempotencyRecord.findUnique({
          where: {
            tenantId_membershipId_operation_key: {
              tenantId: input.tenantId,
              membershipId: input.membershipId,
              operation: input.operation,
              key: input.key,
            },
          },
        });
        if (!raced) throw error;
        if (raced.requestHash !== hash)
          throw new ProblemError(
            409,
            'IDEMPOTENCY_KEY_REUSED',
            'Khóa idempotency đã dùng cho yêu cầu khác.',
          );
        throw new ProblemError(409, 'CONFLICT', 'Yêu cầu cùng khóa đang được xử lý.');
      }
    }
    let value: T;
    try {
      value = await input.action();
    } catch (error) {
      await this.db.tenantIdempotencyRecord.update({
        where: {
          tenantId_membershipId_operation_key: {
            tenantId: input.tenantId,
            membershipId: input.membershipId,
            operation: input.operation,
            key: input.key,
          },
        },
        data: { status: 'FAILED_RETRYABLE', lockedUntil: new Date() },
      });
      throw error;
    }
    await this.db.tenantIdempotencyRecord.update({
      where: {
        tenantId_membershipId_operation_key: {
          tenantId: input.tenantId,
          membershipId: input.membershipId,
          operation: input.operation,
          key: input.key,
        },
      },
      data: {
        status: 'COMPLETED',
        responseStatus: 200,
        responseBodyRedacted: redact(value) as Prisma.InputJsonValue,
        responseBodyCiphertext: this.encrypt(value),
      },
    });
    return { replayed: false, value };
  }

  async executeAccountIdempotent<T>(input: {
    userId: string;
    operation: string;
    key: string;
    request: unknown;
    action: () => Promise<T>;
  }): Promise<{ replayed: boolean; value: T }> {
    const hash = requestHash(input.request);
    const key = {
      userId_operation_key: {
        userId: input.userId,
        operation: input.operation,
        key: input.key,
      },
    };
    const existing = await this.db.accountIdempotencyRecord.findUnique({ where: key });
    if (existing && existing.requestHash !== hash)
      throw new ProblemError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'Khóa idempotency đã dùng cho yêu cầu khác.',
      );
    if (existing?.status === 'COMPLETED' && existing.responseBodyCiphertext) {
      this.telemetry?.increment('idempotency_replays_total');
      return { replayed: true, value: this.decrypt<T>(existing.responseBodyCiphertext) };
    }
    if (existing && existing.lockedUntil > new Date())
      throw new ProblemError(409, 'CONFLICT', 'Yêu cầu cùng khóa đang được xử lý.');
    if (existing) {
      const claim = await this.db.accountIdempotencyRecord.updateMany({
        where: { id: existing.id, lockedUntil: { lte: new Date() } },
        data: { status: 'PROCESSING', lockedUntil: new Date(Date.now() + 30_000) },
      });
      if (claim.count !== 1)
        throw new ProblemError(409, 'CONFLICT', 'Yêu cầu cùng khóa đang được xử lý.');
    } else {
      try {
        await this.db.accountIdempotencyRecord.create({
          data: {
            userId: input.userId,
            operation: input.operation,
            key: input.key,
            requestHash: hash,
            lockedUntil: new Date(Date.now() + 30_000),
            expiresAt: new Date(Date.now() + 86_400_000),
          },
        });
      } catch (error) {
        const raced = await this.db.accountIdempotencyRecord.findUnique({ where: key });
        if (!raced) throw error;
        if (raced.requestHash !== hash)
          throw new ProblemError(
            409,
            'IDEMPOTENCY_KEY_REUSED',
            'Khóa idempotency đã dùng cho yêu cầu khác.',
          );
        throw new ProblemError(409, 'CONFLICT', 'Yêu cầu cùng khóa đang được xử lý.');
      }
    }
    let value: T;
    try {
      value = await input.action();
    } catch (error) {
      await this.db.accountIdempotencyRecord.update({
        where: key,
        data: { status: 'FAILED_RETRYABLE', lockedUntil: new Date() },
      });
      throw error;
    }
    await this.db.accountIdempotencyRecord.update({
      where: key,
      data: {
        status: 'COMPLETED',
        responseStatus: 200,
        responseBodyRedacted: redact(value) as Prisma.InputJsonValue,
        responseBodyCiphertext: this.encrypt(value),
      },
    });
    return { replayed: false, value };
  }
}
