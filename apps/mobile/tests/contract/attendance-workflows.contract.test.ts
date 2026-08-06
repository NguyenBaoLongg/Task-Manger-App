import fs from 'node:fs';
import path from 'node:path';

describe('attendance and workflow contract', () => {
  const contract = fs.readFileSync(
    path.resolve(__dirname, '../../../../specs/003-timekeeping-workflows/contracts/openapi.yaml'),
    'utf8',
  );
  it('publishes scoped schedule, policy, check-in and workflow routes', () => {
    for (const route of [
      '/attendance/schedules:',
      '/attendance/off-calendar:',
      '/attendance/video-policies:',
      '/attendance/video-policy/acknowledgements:',
      '/attendance/check-ins:',
      '/workflows/requests:',
      '/workflows/requests/{requestId}/decisions:',
      '/attendance/penalty-settlements:',
    ]) {
      expect(contract).toContain(route);
    }
  });
});
