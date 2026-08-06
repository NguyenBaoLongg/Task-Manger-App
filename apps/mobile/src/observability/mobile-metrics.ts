export const measureAsync = async <T>(name: string, operation: () => Promise<T>) => {
  const started = Date.now();
  const value = await operation();
  return { name, value, durationMs: Date.now() - started };
};
