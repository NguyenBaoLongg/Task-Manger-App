import { createHash } from 'node:crypto';

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`)
    .join(',')}}`;
}

export function kpiDigest(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

export function redactKpiMetadata(value: Record<string, unknown>): Record<string, unknown> {
  const blocked = /token|secret|url|email|name|revenue|actual|target|form|payload/i;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !blocked.test(key)));
}
