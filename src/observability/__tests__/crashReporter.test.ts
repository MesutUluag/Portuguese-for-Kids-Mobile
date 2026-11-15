import * as Crypto from 'expo-crypto';
import { hashUserId, reportCaughtError, scrubPii } from '@/observability/crashReporter';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_alg: string, value: string) =>
    `hashed_${value}_0123456789abcdef`,
  ),
}));

jest.mock('expo-updates', () => ({
  runtimeVersion: 'exposdk:58.0.0',
  updateId: 'update-123',
}));

describe('crashReporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scrubs emails, Bearer tokens, JWTs, and secret query parameters', () => {
    const sampleToken = ['eyJ' + 'testheader', 'eyJ' + 'testpayload', 'testsig0000'].join('.');
    const raw = `Failed for parent@example.com with Bearer abc.def.ghi and token ${sampleToken} at /image?imagePrompt=secret-text&key=myKey`;

    const cleaned = scrubPii(raw);

    expect(cleaned).not.toContain('parent@example.com');
    expect(cleaned).not.toContain('abc.def.ghi');
    expect(cleaned).not.toContain(sampleToken);
    expect(cleaned).not.toContain('secret-text');
    expect(cleaned).not.toContain('myKey');
    expect(cleaned).toContain('[redacted-email]');
    expect(cleaned).toContain('Bearer [redacted]');
    expect(cleaned).toContain('[redacted-jwt]');
    expect(cleaned).toContain('imagePrompt=[redacted]');
    expect(cleaned).toContain('key=[redacted]');
  });

  it('hashes Firebase UIDs into a 16-character non-reversible prefix', async () => {
    const hashed = await hashUserId('firebase-uid-987');

    expect(Crypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', 'firebase-uid-987');
    expect(hashed).toHaveLength(16);
  });

  it('logs a scrubbed payload without raw PII or UIDs', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const err = new Error('Auth failure for user@test.org with Bearer secretToken');
    err.stack = 'Error: user@test.org\n    at StoryMode (StoryMode.tsx:10)';

    const payload = await reportCaughtError(err, {
      mode: 'story',
      uid: 'uid-abc-123',
    });

    expect(payload.mode).toBe('story');
    expect(payload.runtimeVersion).toBe('exposdk:58.0.0');
    expect(payload.updateId).toBe('update-123');
    expect(payload.uidHash).toHaveLength(16);
    expect(payload.message).not.toContain('user@test.org');
    expect(payload.message).not.toContain('secretToken');
    expect(payload.stackPreview).not.toContain('user@test.org');
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });
});
