import pino from 'pino';
import type { AppConfig } from '@adsup/config';

export const createLogger = (config: Pick<AppConfig, 'logLevel'>) =>
  pino({
    level: config.logLevel,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.token',
        '*.refreshToken',
        '*.signedUrl',
        '*.url',
      ],
      censor: '[REDACTED]',
    },
  });

export class Metrics {
  private readonly counters = new Map<string, number>();
  increment(name: string) {
    this.counters.set(name, (this.counters.get(name) ?? 0) + 1);
  }
  observe(name: string, value: number) {
    this.increment(`${name}_count`);
    this.counters.set(`${name}_sum`, (this.counters.get(`${name}_sum`) ?? 0) + value);
    this.counters.set(`${name}_max`, Math.max(this.counters.get(`${name}_max`) ?? 0, value));
  }
  snapshot() {
    return Object.fromEntries(this.counters);
  }
}
