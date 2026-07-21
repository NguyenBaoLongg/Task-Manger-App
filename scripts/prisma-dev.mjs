import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const executable = join(
  root,
  'packages',
  'database',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.CMD' : 'prisma',
);
const action = process.argv[2] ?? 'dev';
const args =
  action === 'dev'
    ? ['dev', '--name', 'adsup-module1']
    : ['migrate', 'status', '--config', 'prisma.config.ts'];
const child = spawn(executable, args, {
  cwd: join(root, 'packages', 'database'),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
