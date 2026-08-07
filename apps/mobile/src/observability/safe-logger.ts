import { redactTelemetry } from './safe-telemetry';

export type LogSink = (level: string, event: string, data: unknown) => void;

export const createSafeLogger = (sink: LogSink = () => undefined) => ({
  info: (event: string, data?: unknown) => sink('info', event, redactTelemetry(data)),
  warn: (event: string, data?: unknown) => sink('warn', event, redactTelemetry(data)),
  error: (event: string, data?: unknown) => sink('error', event, redactTelemetry(data)),
});
