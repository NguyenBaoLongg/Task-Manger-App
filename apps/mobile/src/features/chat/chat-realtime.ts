export type ChatMessage = { id: string; clientMessageId: string; createdAt: number; body?: string };
export const reconcileMessages = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const byClientId = new Map<string, ChatMessage>();
  for (const message of [...current, ...incoming]) {
    const previous = byClientId.get(message.clientMessageId);
    if (!previous || message.createdAt >= previous.createdAt)
      byClientId.set(message.clientMessageId, message);
  }
  return Array.from(byClientId.values()).sort((a, b) => a.createdAt - b.createdAt);
};
