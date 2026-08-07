export type UploadState = 'PENDING' | 'UPLOADING' | 'FAILED' | 'READY' | 'EXPIRED';
export const checksumBytes = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
export const createMediaUploadSession = (input: {
  mediaId: string;
  bytes: Uint8Array;
  expiresAt: number;
}) => {
  let state: UploadState = 'PENDING';
  const snapshot = () => ({
    mediaId: input.mediaId,
    state,
    checksum: checksumBytes(input.bytes),
    expiresAt: input.expiresAt,
  });
  return {
    get state() {
      return state;
    },
    start: () => {
      if (Date.now() >= input.expiresAt) state = 'EXPIRED';
      else state = 'UPLOADING';
    },
    fail: (_reason: string) => {
      if (state === 'UPLOADING') state = 'FAILED';
    },
    retry: () => {
      if (state === 'FAILED') state = 'UPLOADING';
    },
    complete: () => {
      if (state === 'UPLOADING') state = 'READY';
    },
    snapshot,
  };
};
