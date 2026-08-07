const sensitiveKeys = /token|email|phone|url|key|payload|media|name/i;

export const redactTelemetry = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactTelemetry);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKeys.test(key) ? '[REDACTED]' : redactTelemetry(item),
    ]),
  );
};
