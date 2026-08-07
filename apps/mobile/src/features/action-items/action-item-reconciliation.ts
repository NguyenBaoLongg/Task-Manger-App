import type { ActionItem } from './action-item-feed';

export const reconcileActionItems = (current: ActionItem[], incoming: ActionItem[]) => {
  const next = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    const previous = next.get(item.id);
    if (!previous || item.stateVersion >= previous.stateVersion) next.set(item.id, item);
  }
  return Array.from(next.values());
};
