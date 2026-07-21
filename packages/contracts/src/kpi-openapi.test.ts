import { describe, expect, it } from 'vitest';
import { loadKpiOpenApiDocument } from './index.js';

describe('Module 2 OpenAPI', () => {
  it('publishes 15 uniquely named bearer-protected operations', async () => {
    const document = await loadKpiOpenApiDocument();
    const paths = document.paths as Record<string, Record<string, { operationId?: string }>>;
    const operations = Object.values(paths).flatMap((path) =>
      Object.entries(path)
        .filter(([method]) => ['get', 'post', 'patch', 'put', 'delete'].includes(method))
        .map(([, operation]) => operation.operationId),
    );
    expect(Object.keys(paths)).toHaveLength(13);
    expect(operations).toHaveLength(15);
    expect(new Set(operations).size).toBe(15);
    expect(document.security).toEqual([{ bearerAuth: [] }]);
  });

  it('requires idempotency on every public mutation', async () => {
    const document = await loadKpiOpenApiDocument();
    const paths = document.paths as Record<
      string,
      Record<string, { parameters?: Array<{ $ref?: string }> }>
    >;
    for (const [path, item] of Object.entries(paths)) {
      for (const method of ['post', 'patch', 'put', 'delete']) {
        const operation = item[method];
        if (!operation) continue;
        expect(
          operation.parameters?.some((parameter) => parameter.$ref?.endsWith('/IdempotencyKey')),
          `${method.toUpperCase()} ${path}`,
        ).toBe(true);
      }
    }
  });

  it('models exact money as strings and excludes blocked data errors from financial evaluations', async () => {
    const document = await loadKpiOpenApiDocument();
    const schemas = (document.components as { schemas: Record<string, unknown> }).schemas;
    expect(JSON.stringify(schemas)).toContain('failurePenaltyMinor');
    expect(JSON.stringify(schemas)).toContain('^[0-9]+$');
    expect(JSON.stringify(schemas)).not.toContain('BLOCKED_DATA_ERROR');
  });
});
