import { createExportRequestHash, ProblemError, validateExportBounds } from '@adsup/domain';
import type { CreateExportInput } from '@adsup/contracts';

type ExportRepositoryLike = {
  createOrGetRequest(input: {
    tenantId: string;
    requesterMembershipId: string;
    idempotencyKey: string;
    correlationId: string;
    requestHash: string;
    format: 'XLSX';
    dataTypes: string[];
    dateFrom: Date;
    dateTo: Date;
    branchIds: string[];
    departmentIds?: string[];
    membershipIds?: string[];
  }): Promise<ExportRequestRow>;
  listExports(input: {
    tenantId: string;
    requesterMembershipId: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: ExportRequestRow[]; nextCursor: string | null }>;
  getExport(tenantId: string, exportId: string): Promise<ExportRequestRow | null>;
};

type ExportRequestRow = {
  id: string;
  requesterMembershipId: string;
  requestHash: string;
  createdAt: Date;
  format: string;
  dataTypesJson: unknown;
  dateFrom: Date;
  dateTo: Date;
  branchScopeJson: unknown;
  state: string;
  progressRows: number;
  byteSize: bigint | number | null;
  checksumSha256: string | null;
  expiresAt: Date | null;
  safeErrorCode: string | null;
  mediaObject?: { objectKey: string } | null;
};

type AuthorizationLike = {
  hasPermission?(
    tenantId: string,
    membershipId: string,
    permission: string,
    branchId?: string,
  ): Promise<boolean>;
  resolvePermissionScope?(
    tenantId: string,
    membershipId: string,
    permission: string,
  ): Promise<{
    tenantWide: boolean;
    branchIds: string[];
  }>;
};

type DownloadStorage = {
  createDownloadUrl(
    objectKey: string,
    expiresInSeconds: number,
  ): Promise<{ url: string; expiresAt: Date }>;
};

export class ExportService {
  constructor(
    private readonly repository: ExportRepositoryLike,
    private readonly authorization: AuthorizationLike,
    private readonly storage?: DownloadStorage,
  ) {}

  async create(input: {
    tenantId: string;
    actorMembershipId: string;
    allowedBranchIds?: string[];
    idempotencyKey: string;
    correlationId: string;
    input: CreateExportInput;
  }) {
    validateExportBounds(input.input);
    const scope = input.allowedBranchIds
      ? { tenantWide: false, branchIds: input.allowedBranchIds }
      : ((await this.authorization.resolvePermissionScope?.(
          input.tenantId,
          input.actorMembershipId,
          'booking.export.create',
        )) ?? { tenantWide: false, branchIds: [] });
    if (
      !scope.tenantWide &&
      input.input.branchIds.some((branchId) => !scope.branchIds.includes(branchId))
    ) {
      throw new ProblemError(
        403,
        'AUTHORIZATION_DENIED',
        'Export branch is outside the actor scope.',
      );
    }
    const requestHash = createExportRequestHash(input.input);
    const request = await this.repository.createOrGetRequest({
      tenantId: input.tenantId,
      requesterMembershipId: input.actorMembershipId,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      requestHash,
      format: input.input.format,
      dataTypes: input.input.dataTypes,
      dateFrom: new Date(`${input.input.dateFrom}T00:00:00.000Z`),
      dateTo: new Date(`${input.input.dateTo}T00:00:00.000Z`),
      branchIds: input.input.branchIds,
      departmentIds: input.input.departmentIds,
      membershipIds: input.input.membershipIds,
    });
    if (request.requestHash !== requestHash) {
      throw new ProblemError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'Idempotency key đã được dùng cho payload khác.',
      );
    }
    return {
      export: presentExport(request),
      replayed: request.createdAt < new Date(Date.now() - 1_000),
    };
  }

  async list(input: {
    tenantId: string;
    actorMembershipId: string;
    cursor?: string;
    limit?: number;
  }) {
    const result = await this.repository.listExports({
      tenantId: input.tenantId,
      requesterMembershipId: input.actorMembershipId,
      cursor: input.cursor,
      limit: input.limit,
    });
    return { items: result.items.map(presentExport), nextCursor: result.nextCursor };
  }

  async get(input: { tenantId: string; actorMembershipId: string; exportId: string }) {
    const request = await this.repository.getExport(input.tenantId, input.exportId);
    if (!request || request.requesterMembershipId !== input.actorMembershipId) {
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy export.');
    }
    return presentExport(request);
  }

  async createDownloadUrl(input: {
    tenantId: string;
    actorMembershipId: string;
    exportId: string;
  }) {
    if (!this.storage)
      throw new ProblemError(503, 'PROVIDER_UNAVAILABLE', 'Storage chưa sẵn sàng.');
    const request = await this.repository.getExport(input.tenantId, input.exportId);
    if (!request || request.state !== 'READY' || !request.mediaObject?.objectKey) {
      throw new ProblemError(409, 'CONFLICT', 'Export chưa sẵn sàng để tải.');
    }
    if (request.expiresAt && request.expiresAt <= new Date()) {
      throw new ProblemError(409, 'CONFLICT', 'Export đã hết hạn.');
    }
    const branchIds = readStringArray(request.branchScopeJson);
    for (const branchId of branchIds) {
      const allowed = await this.authorization.hasPermission?.(
        input.tenantId,
        input.actorMembershipId,
        'booking.export.download',
        branchId,
      );
      if (!allowed)
        throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Quyền download không còn hợp lệ.');
    }
    return this.storage.createDownloadUrl(request.mediaObject.objectKey, 300);
  }
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function presentExport(row: ExportRequestRow) {
  return {
    id: row.id,
    format: row.format,
    dataTypes: readStringArray(row.dataTypesJson),
    dateFrom: row.dateFrom.toISOString().slice(0, 10),
    dateTo: row.dateTo.toISOString().slice(0, 10),
    branchIds: readStringArray(row.branchScopeJson),
    state: row.state,
    progressRows: row.progressRows,
    byteSize: row.byteSize === null || row.byteSize === undefined ? null : Number(row.byteSize),
    checksumSha256: row.checksumSha256 ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    safeErrorCode: row.safeErrorCode ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
