import fs from 'node:fs';
import path from 'node:path';

describe('member join contract', () => {
  const contract = fs.readFileSync(
    path.resolve(__dirname, '../../../../specs/001-multitenant-foundation/contracts/openapi.yaml'),
    'utf8',
  );

  it('publishes invitation acceptance gated by auth with documented failure codes', () => {
    const acceptStart = contract.indexOf('/v1/invitations/accept:');
    const acceptSection = contract.slice(acceptStart, contract.indexOf('  /v1/', acceptStart + 1));
    expect(acceptSection).toContain('operationId: acceptInvitation');
    expect(acceptSection).toContain("- $ref: '#/components/parameters/IdempotencyKey'");
    expect(acceptSection).toContain("'401': { $ref: '#/components/responses/UnauthorizedProblem' }");
    expect(acceptSection).toContain("'409': { $ref: '#/components/responses/ConflictProblem' }");
    expect(acceptSection).toContain("'410': { $ref: '#/components/responses/GoneProblem' }");

    const tokenSchema = contract.slice(
      contract.indexOf('token: { type: string, minLength: 20', acceptStart),
      contract.indexOf("'201':", acceptStart),
    );
    expect(tokenSchema).toContain('minLength: 20');
    expect(tokenSchema).toContain('maxLength: 512');
  });

  it('publishes the machine code the join flow maps profile-confirmation and expiry from', () => {
    const problemStart = contract.indexOf('    Problem:');
    const problemSection = contract.slice(problemStart, problemStart + 600);
    expect(problemSection).toContain('code: { type: string, pattern:');
    expect(problemSection).toContain('^[A-Z0-9_]+$');
  });

  it('requires the idempotency key on accept', () => {
    const idempotencyStart = contract.indexOf('    IdempotencyKey:');
    const idempotencyParam = contract.slice(
      idempotencyStart,
      contract.indexOf('  responses:', idempotencyStart),
    );
    expect(idempotencyParam).toContain('required: true');
    expect(idempotencyParam).toContain('minLength: 8');
  });
});
