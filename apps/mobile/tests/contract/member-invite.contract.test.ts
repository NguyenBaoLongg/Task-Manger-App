import fs from 'node:fs';
import path from 'node:path';

describe('member invite contract', () => {
  const contract = fs.readFileSync(
    path.resolve(__dirname, '../../../../specs/001-multitenant-foundation/contracts/openapi.yaml'),
    'utf8',
  );

  it('publishes role listing gated by role.read', () => {
    const rolesStart = contract.indexOf('/v1/tenants/{tenantId}/roles:');
    const rolesSection = contract.slice(rolesStart, contract.indexOf('  /v1/', rolesStart + 1));
    expect(rolesSection).toContain('operationId: listRoles');
    expect(rolesSection).toContain('x-permission: role.read');
    expect(rolesSection).toContain("'403': { $ref: '#/components/responses/ForbiddenProblem' }");
  });

  it('requires an idempotency key and documents validation failures on invitation create', () => {
    const createSection = contract.slice(
      contract.indexOf('/v1/tenants/{tenantId}/invitations:'),
      contract.indexOf('/v1/tenants/{tenantId}/invitations/{invitationId}/revoke:'),
    );
    expect(createSection).toContain('operationId: createInvitation');
    expect(createSection).toContain('x-permission: member.invite');
    expect(createSection).toContain("- $ref: '#/components/parameters/IdempotencyKey'");
    expect(createSection).toContain("'403': { $ref: '#/components/responses/ForbiddenProblem' }");
    expect(createSection).toContain("'422': { $ref: '#/components/responses/ValidationProblem' }");
    const idempotencyStart = contract.indexOf('    IdempotencyKey:');
    const idempotencyParam = contract.slice(
      idempotencyStart,
      contract.indexOf('  responses:', idempotencyStart),
    );
    expect(idempotencyParam).toContain('required: true');
    expect(idempotencyParam).toContain('minLength: 8');
  });
});
