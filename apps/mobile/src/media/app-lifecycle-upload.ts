export const createMediaLifecycle = () => {
  let current: 'UPLOADING' | 'PAUSED' = 'UPLOADING';
  return {
    pause: () => {
      current = 'PAUSED';
    },
    resume: () => {
      current = 'UPLOADING';
    },
    state: () => current,
  };
};
