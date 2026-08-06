import type { SessionTokens } from './secure-session-storage';

export type SessionStorage = {
  load: () => Promise<SessionTokens | undefined>;
  save: (value: SessionTokens) => Promise<void>;
  clear: () => Promise<void>;
};

type SessionOptions = {
  storage: SessionStorage;
  refresh: (refreshToken: string) => Promise<SessionTokens>;
};

export const createSessionCoordinator = ({ storage, refresh }: SessionOptions) => {
  let current: SessionTokens | undefined;
  let refreshFlight: Promise<string> | undefined;

  const ensureLoaded = async () => {
    current ??= await storage.load();
    return current;
  };

  const refreshIfNeeded = async (force = false): Promise<string> => {
    const loaded = await ensureLoaded();
    if (!loaded) throw new Error('SESSION_REQUIRED');
    if (!force && loaded.expiresAt > Date.now() + 30_000) return loaded.accessToken;
    if (refreshFlight) return refreshFlight;
    refreshFlight = refresh(loaded.refreshToken)
      .then(async (next) => {
        current = next;
        await storage.save(next);
        return next.accessToken;
      })
      .catch(async (error: unknown) => {
        current = undefined;
        await storage.clear();
        throw error;
      })
      .finally(() => {
        refreshFlight = undefined;
      });
    return refreshFlight;
  };

  return {
    getAccessToken: () => current?.accessToken,
    refreshIfNeeded,
    load: ensureLoaded,
    set: async (tokens: SessionTokens) => {
      current = tokens;
      await storage.save(tokens);
    },
    logout: async () => {
      current = undefined;
      await storage.clear();
    },
  };
};
