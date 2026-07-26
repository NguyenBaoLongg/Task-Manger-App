import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { once } from 'node:events';
import { neutralizeSpreadsheetCell } from '@adsup/domain';

export interface XlsxSheetInput {
  name: string;
  columns: string[];
  rows: unknown[][];
}

export interface StreamingXlsxSheetInput {
  name: string;
  columns: string[];
  rows: AsyncIterable<unknown[]>;
}

export async function writeXlsxWorkbook(input: { sheets: XlsxSheetInput[] }): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Adsup';
  workbook.created = new Date();
  for (const sheetInput of input.sheets) {
    const sheet = workbook.addWorksheet(sheetInput.name.slice(0, 31));
    sheet.addRow(sheetInput.columns);
    for (const row of sheetInput.rows) {
      sheet.addRow(row.map(neutralizeSpreadsheetCell));
    }
    sheet.autoFilter = {
      from: 'A1',
      to: `${columnName(sheetInput.columns.length)}1`,
    };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function writeXlsxWorkbookToFile(
  input: { sheets: StreamingXlsxSheetInput[] },
  filePath: string,
): Promise<{ byteSize: number; checksumSha256: string }> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: filePath });
  for (const sheetInput of input.sheets) {
    const sheet = workbook.addWorksheet(sheetInput.name.slice(0, 31));
    sheet.addRow(sheetInput.columns).commit();
    for await (const row of sheetInput.rows)
      sheet.addRow(row.map(neutralizeSpreadsheetCell)).commit();
    sheet.autoFilter = {
      from: 'A1',
      to: `${columnName(sheetInput.columns.length)}1`,
    };
    sheet.commit();
  }
  await workbook.commit();
  const digest = createHash('sha256');
  const stream = createReadStream(filePath);
  stream.on('data', (chunk: string | Buffer) => {
    digest.update(chunk);
  });
  await once(stream, 'close');
  return { byteSize: (await stat(filePath)).size, checksumSha256: digest.digest('hex') };
}

function columnName(number: number): string {
  let value = Math.max(1, number);
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}
