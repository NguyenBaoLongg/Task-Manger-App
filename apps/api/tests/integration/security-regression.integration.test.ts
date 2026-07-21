import { describe, expect, it } from 'vitest';
import { problemDocument, redact } from '@adsup/domain';

describe('security regression', () => {
  it('redacts tokens, signed URLs and oversized JSON', () => {
    const output = redact({
      refreshToken: 'secret',
      nested: { signedUrl: 'https://secret.test' },
      rawEvidence: { objectKey: 'tenant/video.mp4' },
      paymentProofSignedUrl: 'https://payments.example/signed',
      checksumSha256: 'a'.repeat(64),
      payload: 'x'.repeat(3000),
    });
    expect(output).toMatchObject({
      refreshToken: '[REDACTED]',
      nested: { signedUrl: '[REDACTED]' },
      rawEvidence: '[REDACTED]',
      paymentProofSignedUrl: '[REDACTED]',
      checksumSha256: '[REDACTED]',
    });
    expect(JSON.stringify(output)).not.toContain('https://secret.test');
    expect(JSON.stringify(output)).not.toContain('tenant/video.mp4');
    expect(JSON.stringify(output).length).toBeLessThan(2500);
  });
  it('never serializes unknown provider error details', () => {
    const problem = problemDocument(new Error('DATABASE_URL=postgresql://secret'), 'security-1');
    expect(problem).toMatchObject({ code: 'INTERNAL_ERROR', correlationId: 'security-1' });
    expect(JSON.stringify(problem)).not.toContain('postgresql://');
  });
});
