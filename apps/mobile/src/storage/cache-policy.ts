const sensitiveParts = new Set(['media', 'payment-proof', 'signed-url', 'private']);

export const createCachePolicy = () => ({
  isSensitive: (key: readonly unknown[]) =>
    key.some((part) => typeof part === 'string' && sensitiveParts.has(part)),
  evictSensitive: (keys: readonly (readonly unknown[])[]) =>
    keys.filter((key) => key.some((part) => typeof part === 'string' && sensitiveParts.has(part))),
});
