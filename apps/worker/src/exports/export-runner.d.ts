import { writeXlsxWorkbook } from './xlsx-writer.js';
type ExportRepositoryLike = {
  claimExport(input: {
    tenantId: string;
    exportId: string;
    workerId: string;
    now: Date;
  }): Promise<ExportClaim | null>;
  listExportRows(input: ExportRowPageInput): Promise<ExportPage>;
  countExportRows?(input: {
    tenantId: string;
    branchIds: string[];
    dateFrom: Date;
    dateTo: Date;
    dataTypes: string[];
  }): Promise<Record<string, number>>;
  getTenantTimezone?(tenantId: string): Promise<string>;
  markProgress(input: {
    tenantId: string;
    exportId: string;
    workerId: string;
    progressRows: number;
    checkpoint: string | null;
  }): Promise<unknown>;
  markReady(input: {
    tenantId: string;
    exportId: string;
    workerId: string;
    ownerMembershipId: string;
    objectKey: string;
    bucket: string;
    content?: Buffer;
    checksumSha256: string;
    byteSize: number;
    rowCount: number;
    expiresAt: Date;
    correlationId: string;
  }): Promise<unknown>;
  markRetryable(input: {
    tenantId: string;
    exportId: string;
    workerId: string;
    code: string;
    now?: Date;
  }): Promise<unknown>;
};
type ExportClaim = {
  id: string;
  tenantId: string;
  requesterMembershipId: string;
  dataTypesJson: unknown;
  branchScopeJson: unknown;
  dateFrom: Date;
  dateTo: Date;
  checkpoint: string | null;
  correlationId: string;
  timezone?: string;
  filterJson?: unknown;
};
type ExportRowPageInput = {
  tenantId: string;
  branchIds: string[];
  dateFrom: Date;
  dateTo: Date;
  dataTypes: string[];
  cursor?: string | null;
  take?: number;
};
type ExportPage = {
  rows: Array<Record<string, unknown>>;
  nextCursor: string | null;
  nextCursors?: Record<string, string | null>;
};
export interface ExportObjectStorage {
  putObject(input: {
    objectKey: string;
    content: Buffer;
    contentType: string;
    checksumSha256: string;
  }): Promise<void>;
  putFile?(input: {
    objectKey: string;
    filePath: string;
    contentType: string;
    checksumSha256: string;
  }): Promise<void>;
}
export declare class ExportRunner {
  private readonly repository;
  private readonly storage;
  private readonly writer;
  constructor(
    repository: ExportRepositoryLike,
    storage: ExportObjectStorage,
    writer?: typeof writeXlsxWorkbook,
  );
  run(input: { tenantId: string; exportId: string; workerId: string; now?: Date }): Promise<
    | {
        claimed: boolean;
        exportId: string;
        rowCount?: undefined;
        checksumSha256?: undefined;
      }
    | {
        claimed: boolean;
        exportId: string;
        rowCount: number;
        checksumSha256: string;
      }
  >;
  private pageRows;
}
export {};
//# sourceMappingURL=export-runner.d.ts.map
