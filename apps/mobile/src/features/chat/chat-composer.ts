export const validateMessage = (value: string) => {
  const body = value.trim();
  if (!body) throw new Error('MESSAGE_REQUIRED');
  if (body.length > 4000) throw new Error('MESSAGE_TOO_LONG');
  return body;
};
