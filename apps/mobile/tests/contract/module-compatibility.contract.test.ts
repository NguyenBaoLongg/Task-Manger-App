import fs from 'node:fs';
import path from 'node:path';

describe('mobile Module 1-4 compatibility snapshot', () => {
  it('keeps every consumed contract source present and non-empty', () => {
    for (const relative of [
      '001-multitenant-foundation/contracts/openapi.yaml',
      '002-okr-kpi-engine/contracts/openapi.yaml',
      '003-timekeeping-workflows/contracts/openapi.yaml',
      '004-booking-export/contracts/openapi.yaml',
    ]) {
      const value = fs.readFileSync(path.resolve(__dirname, '../../../../specs', relative), 'utf8');
      expect(value).toContain('openapi: 3.1.0');
      expect(value.length).toBeGreaterThan(1000);
    }
  });
});
