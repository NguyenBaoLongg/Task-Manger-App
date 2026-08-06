export type Badge = { effectKey: string; kind: string; readAt?: number };

export const unreadByKind = (badges: Badge[]) =>
  badges.reduce<Record<string, number>>((counts, badge) => {
    if (badge.readAt) return counts;
    counts[badge.kind] = (counts[badge.kind] ?? 0) + 1;
    return counts;
  }, {});

export const createBadgeStore = () => {
  const entries = new Map<string, Badge>();
  return {
    add: (badge: Badge) => entries.set(badge.effectKey, badge),
    remove: (effectKey: string) => entries.delete(effectKey),
    markRead: (effectKey: string, readAt = Date.now()) => {
      const current = entries.get(effectKey);
      if (current) entries.set(effectKey, { ...current, readAt });
    },
    count: () => Array.from(entries.values()).filter((badge) => !badge.readAt).length,
    snapshot: () => Array.from(entries.values()),
  };
};
