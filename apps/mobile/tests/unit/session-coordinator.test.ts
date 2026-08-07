import { createSessionCoordinator, type SessionStorage } from '@/auth/session-coordinator';

const tokens = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: Date.now() + 60_000,
};

describe('session coordinator', () => {
  it('single-flights refresh and stores the rotated token pair', async () => {
    const storage: SessionStorage = {
      load: jest.fn().mockResolvedValue(tokens),
      save: jest.fn(),
      clear: jest.fn(),
    };
    let resolveRefresh!: (value: typeof tokens) => void;
    const refresh = jest.fn(
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
      save: jest.fn(),
      clear: jest.fn(),
    };
    const coordinator = createSessionCoordinator({
      storage,
      refresh: jest.fn().mockRejectedValue(new Error('expired')),
    });

    await expect(coordinator.refreshIfNeeded(true)).rejects.toThrow('expired');
    expect(storage.clear).toHaveBeenCalledTimes(1);
    expect(coordinator.getAccessToken()).toBeUndefined();
  });
});
