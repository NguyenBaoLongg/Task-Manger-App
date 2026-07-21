import { z } from 'zod';

const optionalUrl = z.string().url().optional().or(z.literal(''));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    DATABASE_URL: z.string().min(1),
    AUTH_GOOGLE_MODE: z.enum(['fake', 'google']).default('fake'),
    GOOGLE_CLIENT_ID: z.string().optional().default(''),
    JWT_ISSUER: z.string().min(1).default('adsup-api'),
    JWT_AUDIENCE: z.string().min(1).default('adsup-mobile'),
    JWT_ACCESS_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3600).default(2_592_000),
    OBJECT_STORAGE_DRIVER: z.enum(['memory', 's3']).default('memory'),
    S3_REGION: z.string().default('ap-southeast-1'),
    S3_BUCKET: z.string().optional().default(''),
    S3_ENDPOINT: optionalUrl,
    S3_ACCESS_KEY_ID: z.string().optional().default(''),
    S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
    PUSH_DRIVER: z.enum(['noop', 'webhook']).default('noop'),
    PUSH_WEBHOOK_URL: optionalUrl,
    PUSH_WEBHOOK_SECRET: z.string().optional().default(''),
    REALTIME_BACKPLANE: z.enum(['memory', 'redis-streams']).default('memory'),
    REDIS_URL: optionalUrl,
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(300),
  })
  .superRefine((env, context) => {
    if (env.PUSH_DRIVER !== 'webhook') return;
    if (!env.PUSH_WEBHOOK_URL) {
      context.addIssue({
        code: 'custom',
        path: ['PUSH_WEBHOOK_URL'],
        message: 'PUSH_WEBHOOK_URL is required when PUSH_DRIVER=webhook',
      });
    }
    if (env.PUSH_WEBHOOK_SECRET.length < 32) {
      context.addIssue({
        code: 'custom',
        path: ['PUSH_WEBHOOK_SECRET'],
        message: 'PUSH_WEBHOOK_SECRET must contain at least 32 characters',
      });
    }
  });

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  databaseUrl: string;
  authGoogleMode: 'fake' | 'google';
  googleClientId: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtAccessSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  objectStorageDriver: 'memory' | 's3';
  s3: {
    region: string;
    bucket: string;
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  pushDriver: 'noop' | 'webhook';
  pushWebhookUrl?: string;
  pushWebhookSecret: string;
  realtimeBackplane: 'memory' | 'redis-streams';
  redisUrl?: string;
  signedUrlTtlSeconds: number;
}

export function parseConfig(
  input: NodeJS.ProcessEnv | Record<string, string | undefined>,
): AppConfig {
  const env = envSchema.parse(input);
  const s3: AppConfig['s3'] = {
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  };
  if (env.S3_ENDPOINT) s3.endpoint = env.S3_ENDPOINT;

  const result: AppConfig = {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    authGoogleMode: env.AUTH_GOOGLE_MODE,
    googleClientId: env.GOOGLE_CLIENT_ID,
    jwtIssuer: env.JWT_ISSUER,
    jwtAudience: env.JWT_AUDIENCE,
    jwtAccessSecret: env.JWT_ACCESS_SECRET,
    accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: env.REFRESH_TOKEN_TTL_SECONDS,
    objectStorageDriver: env.OBJECT_STORAGE_DRIVER,
    s3,
    pushDriver: env.PUSH_DRIVER,
    pushWebhookSecret: env.PUSH_WEBHOOK_SECRET,
    realtimeBackplane: env.REALTIME_BACKPLANE,
    signedUrlTtlSeconds: env.SIGNED_URL_TTL_SECONDS,
  };
  if (env.REDIS_URL) result.redisUrl = env.REDIS_URL;
  if (env.PUSH_WEBHOOK_URL) result.pushWebhookUrl = env.PUSH_WEBHOOK_URL;
  return result;
}

export function publicConfig(config: AppConfig) {
  return {
    nodeEnv: config.nodeEnv,
    port: config.port,
    logLevel: config.logLevel,
    authGoogleMode: config.authGoogleMode,
    objectStorageDriver: config.objectStorageDriver,
    pushDriver: config.pushDriver,
    realtimeBackplane: config.realtimeBackplane,
    signedUrlTtlSeconds: config.signedUrlTtlSeconds,
  } as const;
}
