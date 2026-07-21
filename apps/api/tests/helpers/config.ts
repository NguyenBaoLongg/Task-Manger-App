import type { AppConfig } from '@adsup/config';

export const testConfig: AppConfig = {
  nodeEnv: 'test',
  port: 3000,
  logLevel: 'fatal',
  databaseUrl: 'postgresql://test/test',
  authGoogleMode: 'fake',
  googleClientId: '',
  jwtIssuer: 'adsup-api',
  jwtAudience: 'adsup-test',
  jwtAccessSecret: 'x'.repeat(32),
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 3600,
  objectStorageDriver: 'memory',
  s3: { region: 'ap-southeast-1', bucket: 'test', accessKeyId: '', secretAccessKey: '' },
  pushDriver: 'noop',
  pushWebhookSecret: '',
  realtimeBackplane: 'memory',
  signedUrlTtlSeconds: 300,
};
