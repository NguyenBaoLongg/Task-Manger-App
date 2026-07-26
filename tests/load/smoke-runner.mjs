import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./foundation.k6.js', import.meta.url), 'utf8');
for (const marker of ['constant-vus', 'http_req_failed', 'p(95)<500', '/health/live']) {
  if (!source.includes(marker)) throw new Error(`Missing load marker: ${marker}`);
}
console.log('LOAD_SMOKE_SCRIPT_OK');
await import('./kpi-smoke-runner.mjs');
await import('./timekeeping-smoke-runner.mjs');
await import('./booking-smoke-runner.mjs');
