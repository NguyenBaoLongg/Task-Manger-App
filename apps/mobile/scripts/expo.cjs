const path = require('node:path');
const { spawn } = require('node:child_process');
const Module = require('node:module');

const projectRoot = path.resolve(__dirname, '..');
const localNodeModules = path.join(projectRoot, 'node_modules');
const expoPackage = require.resolve('expo/package.json', { paths: [projectRoot] });
const expoRoot = path.dirname(expoPackage);
const resolvedNodeModules = path.dirname(expoRoot);
process.env.NODE_PATH = [localNodeModules, resolvedNodeModules, process.env.NODE_PATH]
  .filter(Boolean)
  .join(path.delimiter);
Module._initPaths();

const expoBin = path.join(expoRoot, 'bin', 'cli');
const cliArgs = process.argv.slice(2).filter((arg, index) => !(index === 1 && arg === '--'));
const child =
  process.platform === 'win32'
    ? spawn(process.execPath, [expoBin, ...cliArgs], {
        cwd: projectRoot,
        env: process.env,
        shell: false,
        stdio: 'inherit',
      })
    : spawn(expoBin, cliArgs, {
        cwd: projectRoot,
        env: process.env,
        shell: false,
        stdio: 'inherit',
      });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
