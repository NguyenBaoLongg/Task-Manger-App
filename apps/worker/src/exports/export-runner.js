import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { writeXlsxWorkbook, writeXlsxWorkbookToFile } from './xlsx-writer.js';
export class ExportRunner {
  repository;
  storage;
  writer;
  constructor(repository, storage, writer = writeXlsxWorkbook) {
    this.repository = repository;
    this.storage = storage;
    this.writer = writer;
  }
  async run(input) {
    const now = input.now ?? new Date();
    const exportRequest = await this.repository.claimExport({
      tenantId: input.tenantId,
      exportId: input.exportId,
      workerId: input.workerId,
      now,
    });
    if (!exportRequest) return { claimed: false, exportId: input.exportId };
    const tenantId = exportRequest.tenantId;
    const dataTypes = readStringArray(exportRequest.dataTypesJson);
    const branchIds = readStringArray(exportRequest.branchScopeJson);
    const timezone =
      exportRequest.timezone ?? (await this.repository.getTenantTimezone?.(tenantId)) ?? 'UTC';
    const expectedCounts = this.repository.countExportRows
      ? await this.repository.countExportRows({
          tenantId,
          branchIds,
          dateFrom: exportRequest.dateFrom,
          dateTo: exportRequest.dateTo,
          dataTypes,
        })
      : null;
    const rowCounts = {};
    const sourceCursors = decodeCheckpoint(exportRequest.checkpoint, dataTypes);
    let rowCount = 0;
    try {
      const objectKey = `${tenantId}/exports/${exportRequest.id}.xlsx`;
      let checksumSha256;
      let byteSize;
      let content;
      if (this.storage.putFile) {
        const filePath = join(tmpdir(), `adsup-export-${randomUUID()}.xlsx`);
        try {
          const streamed = await writeXlsxWorkbookToFile(
            {
              sheets: [
                {
                  name: 'Metadata',
                  columns: METADATA_COLUMNS,
                  rows: toAsyncRows(
                    metadataRows({
                      generatedAt: now,
                      timezone,
                      dataTypes,
                      branchIds,
                      dateFrom: exportRequest.dateFrom,
                      dateTo: exportRequest.dateTo,
                      filterJson: exportRequest.filterJson,
                    }),
                  ),
                },
                ...dataTypes.map((dataType) => ({
                  name: sheetName(dataType),
                  columns: columnsFor(dataType),
                  rows: this.pageRows({
                    tenantId,
                    branchIds,
                    dateFrom: exportRequest.dateFrom,
                    dateTo: exportRequest.dateTo,
                    dataType,
                    exportId: exportRequest.id,
                    workerId: input.workerId,
                    progress: {
                      cursor: sourceCursors[dataType] ?? null,
                      rowCount: 0,
                    },
                    rowCounts,
                    sourceCursors,
                  }),
                })),
              ],
            },
            filePath,
          );
          rowCount = Object.values(rowCounts).reduce((total, count) => total + count, 0);
          checksumSha256 = streamed.checksumSha256;
          byteSize = streamed.byteSize;
          await this.storage.putFile({
            objectKey,
            filePath,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            checksumSha256,
          });
        } finally {
          await unlink(filePath).catch(() => undefined);
        }
      } else {
        const sheets = dataTypes.map((dataType) => ({
          name: sheetName(dataType),
          columns: columnsFor(dataType),
          rows: [],
        }));
        for (const [index, dataType] of dataTypes.entries()) {
          let sourceCursor = sourceCursors[dataType] ?? null;
          do {
            const page = await this.repository.listExportRows({
              tenantId,
              branchIds,
              dateFrom: exportRequest.dateFrom,
              dateTo: exportRequest.dateTo,
              dataTypes: [dataType],
              cursor: sourceCursor,
              take: 500,
            });
            sheets[index]?.rows.push(
              ...page.rows.map((row) => columnsFor(dataType).map((column) => row[column] ?? null)),
            );
            rowCounts[dataType] = (rowCounts[dataType] ?? 0) + page.rows.length;
            rowCount = Object.values(rowCounts).reduce((total, count) => total + count, 0);
            sourceCursor = page.nextCursor;
            sourceCursors[dataType] = sourceCursor;
            await this.repository.markProgress({
              tenantId,
              exportId: exportRequest.id,
              workerId: input.workerId,
              progressRows: rowCount,
              checkpoint: encodeCheckpoint(sourceCursors),
            });
          } while (sourceCursor);
        }
        content = await this.writer({
          sheets: [
            {
              name: 'Metadata',
              columns: METADATA_COLUMNS,
              rows: metadataRows({
                generatedAt: now,
                timezone,
                dataTypes,
                branchIds,
                dateFrom: exportRequest.dateFrom,
                dateTo: exportRequest.dateTo,
                filterJson: exportRequest.filterJson,
              }),
            },
            ...sheets,
          ],
        });
        checksumSha256 = createHash('sha256').update(content).digest('hex');
        byteSize = content.byteLength;
        await this.storage.putObject({
          objectKey,
          content,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          checksumSha256,
        });
      }
      assertRowReconciliation(expectedCounts, rowCounts);
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000);
      await this.repository.markReady({
        tenantId,
        exportId: exportRequest.id,
        workerId: input.workerId,
        ownerMembershipId: exportRequest.requesterMembershipId,
        objectKey,
        bucket: 'adsup-local',
        content,
        checksumSha256,
        byteSize,
        rowCount,
        expiresAt,
        correlationId: exportRequest.correlationId,
      });
      return { claimed: true, exportId: exportRequest.id, rowCount, checksumSha256 };
    } catch (error) {
      await this.repository.markRetryable({
        tenantId,
        exportId: exportRequest.id,
        workerId: input.workerId,
        code: error instanceof Error ? error.name : 'EXPORT_FAILED',
        now,
      });
      throw error;
    }
  }
  async *pageRows(input) {
    do {
      const page = await this.repository.listExportRows({
        tenantId: input.tenantId,
        branchIds: input.branchIds,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        dataTypes: [input.dataType],
        cursor: input.progress.cursor,
        take: 500,
      });
      for (const row of page.rows) {
        yield columnsFor(input.dataType).map((column) => row[column] ?? null);
      }
      input.progress.rowCount += page.rows.length;
      input.rowCounts[input.dataType] = (input.rowCounts[input.dataType] ?? 0) + page.rows.length;
      input.progress.cursor = page.nextCursor;
      input.sourceCursors[input.dataType] = page.nextCursor;
      await this.repository.markProgress({
        tenantId: input.tenantId,
        exportId: input.exportId,
        workerId: input.workerId,
        progressRows: Object.values(input.rowCounts).reduce((total, count) => total + count, 0),
        checkpoint: encodeCheckpoint(input.sourceCursors),
      });
    } while (input.progress.cursor);
  }
}
const EXPORT_COLUMNS = [
  'id',
  'branchId',
  'businessDate',
  'status',
  'bookingType',
  'scheduledStartAt',
  'serviceCode',
  'serviceName',
  'assignedMembershipId',
  'bookingId',
  'performedByMembershipId',
  'completedAt',
  'membershipId',
  'kind',
  'amountMinor',
  'currency',
  'ownerMembershipId',
  'itemType',
  'state',
  'title',
];
const METADATA_COLUMNS = ['field', 'value'];
const DATA_TYPE_COLUMNS = {
  BOOKINGS: EXPORT_COLUMNS.slice(0, 9),
  TOURS: ['id', 'branchId', 'businessDate', 'bookingId', 'performedByMembershipId', 'completedAt'],
  KPI: ['id', 'branchId', 'businessDate', 'membershipId', 'status'],
  PENALTIES: [
    'id',
    'branchId',
    'businessDate',
    'membershipId',
    'kind',
    'amountMinor',
    'currency',
    'status',
  ],
  ACTION_ITEMS: [
    'id',
    'branchId',
    'businessDate',
    'ownerMembershipId',
    'itemType',
    'state',
    'title',
  ],
};
function sheetName(dataType) {
  return dataType
    .slice(0, 31)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
function columnsFor(dataType) {
  return DATA_TYPE_COLUMNS[dataType] ?? ['id'];
}
function metadataRows(input) {
  return [
    ['generatedAt', input.generatedAt.toISOString()],
    ['timezone', input.timezone],
    ['format', 'XLSX'],
    ['dataTypes', input.dataTypes.join(',')],
    ['branchIds', input.branchIds.join(',')],
    ['dateFrom', input.dateFrom.toISOString().slice(0, 10)],
    ['dateTo', input.dateTo.toISOString().slice(0, 10)],
    ['filters', JSON.stringify(input.filterJson ?? {})],
  ];
}
async function* toAsyncRows(rows) {
  for (const row of rows) yield row;
}
function decodeCheckpoint(checkpoint, dataTypes) {
  if (!checkpoint) return Object.fromEntries(dataTypes.map((dataType) => [dataType, null]));
  try {
    const parsed = JSON.parse(checkpoint);
    return Object.fromEntries(
      dataTypes.map((dataType) => [
        dataType,
        typeof parsed[dataType] === 'string' ? parsed[dataType] : null,
      ]),
    );
  } catch {
    return Object.fromEntries([[dataTypes[0] ?? 'BOOKINGS', checkpoint]]);
  }
}
function encodeCheckpoint(sourceCursors) {
  const active = Object.fromEntries(
    Object.entries(sourceCursors).filter(([, cursor]) => cursor !== null),
  );
  return Object.keys(active).length ? JSON.stringify(active) : null;
}
function assertRowReconciliation(expectedCounts, actualCounts) {
  if (!expectedCounts) return;
  for (const [dataType, expected] of Object.entries(expectedCounts)) {
    if ((actualCounts[dataType] ?? 0) !== expected)
      throw new Error(`EXPORT_ROW_RECONCILIATION_FAILED:${dataType}`);
  }
}
function readStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}
//# sourceMappingURL=export-runner.js.map
