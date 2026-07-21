import { describe, expect, it } from 'vitest';
import { loadOpenApiDocument } from './index.js';

describe('OpenAPI quality gate', () => {
  it('is OpenAPI 3.1 and defines problem responses for every operation', async () => {
    const document = await loadOpenApiDocument();
    expect(document.openapi).toMatch(/^3\.1\./);
    expect(document.paths).toBeTypeOf('object');
    expect((document.components as Record<string, unknown>).schemas).toBeTypeOf('object');
  });

  it('conforms all 47 operations to idempotency, field, status and cursor decisions', async () => {
    const document = await loadOpenApiDocument();
    const paths = document.paths as Record<string, Record<string, Operation>>;
    const operations = Object.entries(paths).flatMap(([path, item]) =>
      Object.entries(item)
        .filter(([method]) => methods.has(method))
        .map(([method, operation]) => ({ path, method, operation })),
    );
    expect(operations).toHaveLength(47);
    const ids = operations.map(({ operation }) => operation.operationId);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids)).toHaveProperty('size', 47);

    const idempotentOperations = new Set([
      'authenticateWithGoogle',
      'refreshSession',
      'logoutSession',
      'confirmCurrentUserProfile',
      'createTenant',
      'updateTenantStatus',
      'acceptInvitation',
      'createInvitation',
      'revokeInvitation',
      'createBranch',
      'createDepartment',
      'createPosition',
      'updateBranchStatus',
      'updateDepartmentStatus',
      'updatePositionStatus',
      'updateMembership',
      'createAssignment',
      'createRole',
      'grantRoleBinding',
      'createFormTemplate',
      'publishFormVersion',
      'archiveFormTemplate',
      'retireFormVersion',
      'submitDynamicForm',
      'createChannel',
      'sendMessage',
      'registerNotificationEndpoint',
      'revokeNotificationEndpoint',
      'createMediaUploadIntent',
      'completeMediaUpload',
    ]);
    const declaredIdempotent = new Set(
      operations
        .filter(({ operation }) =>
          operation.parameters?.some(
            (parameter) => parameter.$ref === '#/components/parameters/IdempotencyKey',
          ),
        )
        .map(({ operation }) => operation.operationId!),
    );
    expect(declaredIdempotent).toEqual(idempotentOperations);

    const bodySchema = (operationId: string) => {
      const operation = operations.find(
        (item) => item.operation.operationId === operationId,
      )!.operation;
      return operation.requestBody!.content['application/json']!.schema as JsonSchema;
    };
    expect(bodySchema('acceptInvitation')).toMatchObject({
      required: ['token'],
      additionalProperties: false,
    });
    expect(bodySchema('createInvitation')).toMatchObject({
      $ref: '#/components/schemas/CreateInvitation',
    });
    const updateMembership = bodySchema('updateMembership');
    expect(updateMembership.required).toEqual(['reason']);
    expect(Object.keys(updateMembership.properties ?? {})).toEqual([
      'displayName',
      'employeeCode',
      'status',
      'reason',
    ]);
    expect(bodySchema('submitDynamicForm').required).toEqual(['formVersionId', 'data']);
    expect(bodySchema('createRole')).toMatchObject({
      $ref: '#/components/schemas/CreateRole',
    });
    for (const operationId of [
      'updateTenantStatus',
      'updateBranchStatus',
      'updateDepartmentStatus',
      'updatePositionStatus',
    ]) {
      expect(bodySchema(operationId)).toHaveProperty('$ref');
    }
    const message = bodySchema('sendMessage');
    expect(message.properties?.clientMessageId).toMatchObject({ minLength: 8, maxLength: 100 });
    expect(message.properties?.body).toMatchObject({ minLength: 1, maxLength: 4000 });

    const expectedStatuses: Record<string, string> = {
      acceptInvitation: '201',
      publishFormVersion: '201',
      submitDynamicForm: '201',
      sendMessage: '201',
      registerNotificationEndpoint: '200',
      revokeNotificationEndpoint: '204',
      completeMediaUpload: '200',
      updateTenantStatus: '200',
      archiveFormTemplate: '200',
      retireFormVersion: '200',
    };
    for (const [operationId, status] of Object.entries(expectedStatuses)) {
      const operation = operations.find(
        (item) => item.operation.operationId === operationId,
      )!.operation;
      expect(operation.responses).toHaveProperty(status);
    }

    for (const operationId of [
      'listMemberships',
      'listMessages',
      'listAuditEvents',
      'listMembershipAssignments',
    ]) {
      const operation = operations.find(
        (item) => item.operation.operationId === operationId,
      )!.operation;
      if (operationId !== 'listMembershipAssignments') {
        expect(
          operation.parameters?.some(
            (parameter) => parameter.$ref === '#/components/parameters/Cursor',
          ),
        ).toBe(true);
        const responseSchema = operation.responses!['200']!.content!['application/json']!
          .schema as JsonSchema;
        expect(responseSchema.$ref).toMatch(/Page$/);
      } else {
        expect(operation.parameters?.some((parameter) => parameter.name === 'at')).toBe(true);
        expect(operation.parameters?.some((parameter) => parameter.name === 'includeHistory')).toBe(
          true,
        );
      }
    }
  });
});

const methods = new Set(['get', 'post', 'patch', 'put', 'delete']);

interface JsonSchema {
  $ref?: string;
  required?: string[];
  additionalProperties?: boolean;
  properties?: Record<string, JsonSchema>;
  minLength?: number;
  maxLength?: number;
}

interface Operation {
  operationId?: string;
  parameters?: Array<{ $ref?: string; name?: string }>;
  requestBody?: { content: Record<string, { schema: JsonSchema }> };
  responses?: Record<string, { content?: Record<string, { schema: JsonSchema }> }>;
}
