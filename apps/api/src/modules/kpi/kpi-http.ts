export function kpiJsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(kpiJsonSafe);
  if (value && typeof value === 'object') {
    if ('toFixed' in value && typeof (value as { toFixed?: unknown }).toFixed === 'function') {
      return (value as { toFixed(): string }).toFixed();
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        kpiJsonSafe(nested),
      ]),
    );
  }
  return value;
}
