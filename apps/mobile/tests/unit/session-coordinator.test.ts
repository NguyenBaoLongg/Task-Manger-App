import { createSessionCoordinator, type SessionStorage } from '@/auth/session-coordinator';
import type { SessionTokens } from '@/auth/secure-session-storage';

const tokens = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: Date.now() + 60_000,
};

const makeStorage = (stored?: Partial<SessionTokens>): SessionStorage => ({
  load: jest.fn().mockResolvedValue(stored as SessionTokens | undefined),
  save: jest.fn<Promise<void>, [SessionTokens]>(),
  clear: jest.fn(),
});

describe('session coordinator', () => {
  it('single-flights refresh and stores the rotated token pair', async () => {
    const storage: SessionStorage = {
      load: jest.fn().mockResolvedValue(tokens),
      save: jest.fn<Promise<void>, [SessionTokens]>(),
      clear: jest.fn(),
    };
    let resolveRefresh!: (value: typeof tokens) => void;
    const refresh = jest.fn<Promise<typeof tokens>, [string, string]>(
      () => new Promise<typeof tokens>((resolve) => (resolveRefresh = resolve)),
    );
    const coordinator = createSessionCoordinator({ storage, refresh });

    const first = coordinator.refreshIfNeeded(true);
    const second = coordinator.refreshIfNeeded(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refresh).toHaveBeenCalledTimes(1);
    resolveRefresh({ ...tokens, accessToken: 'access-2', refreshToken: 'refresh-2' });

    await expect(Promise.all([first, second])).resolves.toEqual(['access-2', 'access-2']);
    expect(storage.save).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'access-2' }));
  });

  it('clears the session after refresh failure and denies access', async () => {
    const storage: SessionStorage = {
      load: jest.fn().mockResolvedValue(tokens),
      save: jest.fn<Promise<void>, [SessionTokens]>(),
      clear: jest.fn(),
    };
    const coordinator = createSessionCoordinator({
      storage,
      refresh: jest.fn<Promise<typeof tokens>, [string, string]>().mockRejectedValue(new Error('expired')),
    });

    await expect(coordinator.refreshIfNeeded(true)).rejects.toThrow('expired');
    expect(storage.clear).toHaveBeenCalledTimes(1);
    expect(coordinator.getAccessToken()).toBeUndefined();
  });

  it('generates a key for stored sessions that lack one and passes it to refresh', async () => {
    const save = jest.fn<Promise<void>, [SessionTokens]>();
    const storage: SessionStorage = {
      load: jest.fn().mockResolvedValue({ ...tokens }),
      save,
      clear: jest.fn(),
    };
    const refresh = jest
      .fn<Promise<typeof tokens>, [string, string]>()
      .mockResolvedValue({ ...tokens, accessToken: 'access-2', refreshToken: 'refresh-2' });
    const coordinator = createSessionCoordinator({ storage, refresh });

    await expect(coordinator.refreshIfNeeded(true)).resolves.toBe('access-2');
    expect(refresh).toHaveBeenCalledWith('refresh-1', expect.stringMatching(/^mobile-refresh-/));
    const usedKey = refresh.mock.calls[0]![1];
    expect(save).toHaveBeenCalledTimes(1);
    const savedKey = save.mock.calls[0]![0].refreshIdempotencyKey;
    expect(savedKey).toMatch(/^mobile-refresh-/);
    expect(savedKey).not.toBe(usedKey);
  });

  it('rotates the refresh key after each successful refresh', async () => {
    const storage: SessionStorage = makeStorage({ ...tokens });
    const refresh = jest
      .fn<Promise<typeof tokens>, [string, string]>()
      .mockResolvedValue({ ...tokens, accessToken: 'access-2', refreshToken: 'refresh-2' });
    const coordinator = createSessionCoordinator({ storage, refresh });

    await expect(coordinator.refreshIfNeeded(true)).resolves.toBe('access-2');
    await expect(coordinator.refreshIfNeeded(true)).resolves.toBe('access-2');
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(refresh.mock.calls[1]![1]).not.toBe(refresh.mock.calls[0]![1]);
  });
});
