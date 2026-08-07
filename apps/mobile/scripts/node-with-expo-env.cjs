const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const devFlagIndex = args.indexOf('--dev');
const isDevelopmentBundle = devFlagIndex >= 0 && args[devFlagIndex + 1] === 'true';
const result = spawnSync(process.execPath, args, {
  env: {
    ...process.env,
    EXPO_NO_METRO_WORKSPACE_ROOT: '1',
    NODE_ENV: process.env.NODE_ENV || (isDevelopmentBundle ? 'development' : 'production'),
  },
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
