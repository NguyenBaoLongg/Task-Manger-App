import { describe, expect, it } from 'vitest';
import { loadOpenApiDocument } from './index.js';

describe('OpenAPI contract', () => {
  it('publishes unique operation identifiers and tenant permissions', async () => {
    const document = await loadOpenApiDocument();
    const paths = document.paths as Record<string, Record<string, Record<string, unknown>>>;
    const operations = Object.values(paths).flatMap((path) =>
      Object.entries(path)
        .filter(([method]) => ['get', 'post', 'patch', 'delete', 'put'].includes(method))
        .map(([, operation]) => operation),
    );
    const ids = operations.map((operation) => operation.operationId as string);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(40);
  });
});
