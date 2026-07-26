import { createHash } from 'node:crypto';
import { ProblemError } from '../foundation.js';

export const MAX_EXPORT_DAYS = 366;
export const MAX_EXPORT_BRANCHES = 500;

export interface ExportBoundsInput {
  format: 'XLSX';
  dataTypes: string[];
  dateFrom: string;
  dateTo: string;
  branchIds: string[];
  departmentIds?: string[];
  membershipIds?: string[];
}

export function validateExportBounds<T extends ExportBoundsInput>(input: T): T {
  const from = Date.parse(`${input.dateFrom}T00:00:00.000Z`);
  const to = Date.parse(`${input.dateTo}T00:00:00.000Z`);
  const days = Number.isFinite(from) && Number.isFinite(to) ? (to - from) / 86_400_000 + 1 : 0;
  if (!Number.isFinite(from) || !Number.isFinite(to) || days < 1 || days > MAX_EXPORT_DAYS) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'Khoảng thời gian export không hợp lệ.');
  }
  if (input.branchIds.length < 1 || input.branchIds.length > MAX_EXPORT_BRANCHES) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'Phạm vi cơ sở export không hợp lệ.');
  }
  return input;
}

export function neutralizeSpreadsheetCell(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function createExportRequestHash(input: ExportBoundsInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        format: input.format,
        dataTypes: [...input.dataTypes].sort(),
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        branchIds: [...input.branchIds].sort(),
        departmentIds: [...(input.departmentIds ?? [])].sort(),
        membershipIds: [...(input.membershipIds ?? [])].sort(),
      }),
    )
    .digest('hex');
}
