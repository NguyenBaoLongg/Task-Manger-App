import { createAuthTestDouble } from '@/auth/auth-test-double';

describe('local auth test double', () => {
  it('returns a token accepted by the API fake Google verifier', async () => {
    const result = await createAuthTestDouble().signIn();

    expect(result.idToken).toMatch(/^dev-google:[^:]+:[^:]+$/);
  });
});
