import { OAuth2Client } from 'google-auth-library';
import { ProblemError, type GoogleIdentityVerifier } from '@adsup/domain';

export class ProductionGoogleVerifier implements GoogleIdentityVerifier {
  private readonly client: OAuth2Client;
  constructor(private readonly clientId: string) {
    this.client = new OAuth2Client(clientId);
  }
  async verify(idToken: string) {
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw new Error('missing subject');
      return {
        subject: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified === true,
        providerName: payload.name,
      };
    } catch {
      throw new ProblemError(401, 'AUTHENTICATION_REQUIRED', 'Google token không hợp lệ.');
    }
  }
}

export function createGoogleVerifier(
  mode: 'fake' | 'google',
  clientId: string,
): GoogleIdentityVerifier {
  if (mode === 'fake')
    return {
      async verify(idToken: string) {
        const [prefix, subject, email] = idToken.split(':');
        if (prefix !== 'dev-google' || !subject)
          throw new ProblemError(
            401,
            'AUTHENTICATION_REQUIRED',
            'Google token thử nghiệm không hợp lệ.',
          );
        return { subject, email, emailVerified: Boolean(email) };
      },
    };
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is required in google mode');
  return new ProductionGoogleVerifier(clientId);
}
