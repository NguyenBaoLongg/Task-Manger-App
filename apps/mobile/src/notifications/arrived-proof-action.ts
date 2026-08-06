export const createQuickActionFlow = (options: {
  resolve: () => Promise<boolean>;
  submit: () => Promise<void>;
}) => ({
  run: async () => {
    if (!(await options.resolve()))
      throw new Error('ARRIVED_PROOF_REQUIRES_CURRENT_AUTH_AND_MEDIA');
    await options.submit();
  },
});
