import { describe, expect, it } from 'vitest';
import { parseConfig, publicConfig } from './index.js';

describe('configuration', () => {
  it('uses safe local adapter defaults', () => {
    const config = parseConfig({
      DATABASE_URL: 'postgresql://local/test',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
    });

    expect(config.authGoogleMode).toBe('fake');
    expect(config.objectStorageDriver).toBe('memory');
    expect(publicConfig(config)).not.toHaveProperty('jwtAccessSecret');
    expect(JSON.stringify(publicConfig(config))).not.toContain('postgresql://');
  });

  it('rejects a short signing secret', () => {
    expect(() =>
      parseConfig({ DATABASE_URL: 'postgresql://local/test', JWT_ACCESS_SECRET: 'short' }),
    ).toThrow();
  });

  it('requires an authenticated relay configuration for webhook push', () => {
    expect(() =>
      parseConfig({
        DATABASE_URL: 'postgresql://local/test',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        PUSH_DRIVER: 'webhook',
      }),
    ).toThrow();

    const config = parseConfig({
      DATABASE_URL: 'postgresql://local/test',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      PUSH_DRIVER: 'webhook',
      PUSH_WEBHOOK_URL: 'https://push.internal/v1/events',
      PUSH_WEBHOOK_SECRET: 'b'.repeat(32),
    });
    expect(config.pushDriver).toBe('webhook');
    expect(publicConfig(config)).not.toHaveProperty('pushWebhookSecret');
  });
});
