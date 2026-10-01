import type { SessionTokens } from './secure-session-storage';

export type SessionTokensInput = Omit<SessionTokens, 'refreshIdempotencyKey'>;

export type SessionStorage = {
  load: () => Promise<SessionTokens | undefined>;
  save: (value: SessionTokens) => Promise<void>;
  clear: () => Promise<void>;
};

type SessionOptions = {
  storage: SessionStorage;
  refresh: (refreshToken: string, idempotencyKey: string) => Promise<SessionTokensInput>;
};

const freshRefreshIdempotencyKey = () =>
  `mobile-refresh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const withRefreshIdempotencyKey = (tokens: SessionTokensInput): SessionTokens =>
  'refreshIdempotencyKey' in tokens && tokens.refreshIdempotencyKey
    ? (tokens as SessionTokens)
    : { ...tokens, refreshIdempotencyKey: freshRefreshIdempotencyKey() };

export const createSessionCoordinator = ({ storage, refresh }: SessionOptions) => {
  let current: SessionTokens | undefined;
  let refreshFlight: Promise<string> | undefined;

  const ensureLoaded = async () => {
    if (!current) {
      const stored = await storage.load();
      current = stored ? withRefreshIdempotencyKey(stored) : undefined;
    }
    return current;
  };

  const refreshIfNeeded = async (force = false): Promise<string> => {
    const loaded = await ensureLoaded();
    if (!loaded) throw new Error('SESSION_REQUIRED');
    if (!force && loaded.expiresAt > Date.now() + 30_000) return loaded.accessToken;
    if (refreshFlight) return refreshFlight;
    refreshFlight = refresh(loaded.refreshToken, loaded.refreshIdempotencyKey)
      .then(async (next) => {
        // Rotate only after a confirmed success so a retried refresh replays
        // the stored response instead of being treated as a replay.
        current = withRefreshIdempotencyKey(next);
        await storage.save(current);
        return current.accessToken;
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
    set: async (tokens: SessionTokensInput) => {
      current = withRefreshIdempotencyKey(tokens);
      await storage.save(current);
    },
    logout: async () => {
      current = undefined;
      await storage.clear();
    },
  };
};
