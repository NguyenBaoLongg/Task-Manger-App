import { performance } from 'node:perf_hooks';

const membershipCount = 10_000;
const batchSize = 200;
const memberships = Array.from(
  { length: membershipCount },
  (_, index) => `member-${String(index + 1).padStart(5, '0')}`,
);
let checkpoint;
let processed = 0;
let pages = 0;
while (processed < memberships.length) {
  const start = checkpoint ? memberships.indexOf(checkpoint) + 1 : 0;
  const page = memberships.slice(start, start + batchSize);
  if (!page.length) break;
  checkpoint = page.at(-1);
  processed += page.length;
  pages += 1;
}
if (processed !== membershipCount || checkpoint !== 'member-10000' || pages !== 50) {
  throw new Error('KPI checkpoint fixture did not cover exactly 10,000 memberships');
}

const actionItems = Array.from({ length: membershipCount * 3 }, (_, index) => ({
  membershipId: memberships[index % membershipCount],
  state: index % 4 === 0 ? 'COMPLETED' : 'OPEN',
  remaining: String(index % 101),
}));
const samples = [];
for (let run = 0; run < 100; run += 1) {
  const started = performance.now();
  const membershipId = memberships[(run * 97) % membershipCount];
  actionItems.filter((item) => item.membershipId === membershipId && item.state === 'OPEN');
  samples.push(performance.now() - started);
}
samples.sort((left, right) => left - right);
const p95 = samples[Math.floor(samples.length * 0.95)] ?? Infinity;
if (p95 >= 500) throw new Error(`Local action-item fixture p95 ${p95.toFixed(2)}ms exceeds 500ms`);
process.stdout.write(
  `${JSON.stringify({ marker: 'KPI_LOAD_SMOKE_OK', membershipCount, batchSize, pages, p95Ms: Number(p95.toFixed(2)) })}\n`,
);
