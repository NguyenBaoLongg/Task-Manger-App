import { expect } from 'vitest';
import { loadOpenApiDocument } from '@adsup/contracts';

export async function expectOperations(expected: string[]) {
  const document = await loadOpenApiDocument();
  const paths = document.paths as Record<
    string,
    Record<string, { operationId?: string; responses?: unknown }>
  >;
  const operations = Object.values(paths).flatMap((path) => Object.values(path));
  const ids = new Set(operations.map((operation) => operation.operationId));
  for (const operationId of expected)
    expect(ids.has(operationId), `missing ${operationId}`).toBe(true);
  for (const operation of operations.filter((item) => expected.includes(item.operationId ?? '')))
    expect(operation.responses).toBeTypeOf('object');
}
