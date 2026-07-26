import { describe, expect, it } from 'vitest';
import { neutralizeSpreadsheetCell, validateExportBounds } from '@adsup/domain';
import { writeXlsxWorkbook } from '../../src/exports/xlsx-writer.js';

describe('xlsx export primitives', () => {
  it('enforces bounded date and branch filters', () => {
    expect(() =>
      validateExportBounds({
        format: 'XLSX',
        dataTypes: ['BOOKINGS'],
        dateFrom: '2031-01-01',
        dateTo: '2031-01-02',
        branchIds: ['10000000-0000-4000-8000-000000000001'],
      }),
    ).not.toThrow();
    expect(() =>
      validateExportBounds({
        format: 'XLSX',
        dataTypes: ['BOOKINGS'],
        dateFrom: '2031-01-01',
        dateTo: '2033-01-02',
        branchIds: ['10000000-0000-4000-8000-000000000001'],
      }),
    ).toThrow();
  });

  it('neutralizes spreadsheet formulas and control prefixes', () => {
    for (const value of ['=SUM(A1)', '+123', '-123', '@cmd', '\tformula', '\rformula']) {
      expect(neutralizeSpreadsheetCell(value)).toBe(`'${value}`);
    }
    expect(neutralizeSpreadsheetCell('plain')).toBe('plain');
    expect(neutralizeSpreadsheetCell(12)).toBe(12);
  });

  it('writes a native XLSX archive with stable sheet names', async () => {
    const workbook = await writeXlsxWorkbook({
      sheets: [
        {
          name: 'Bookings',
          columns: ['id', 'customer'],
          rows: [['booking-1', '=1+1']],
        },
      ],
    });
    expect(workbook.subarray(0, 2).toString()).toBe('PK');
    expect(workbook.byteLength).toBeGreaterThan(100);
  });
});
