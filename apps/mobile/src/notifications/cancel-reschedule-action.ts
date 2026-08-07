export const createCancelRescheduleFlow = (options: {
  resolve: () => Promise<boolean>;
  submit: () => Promise<void>;
}) => ({
  run: async () => {
    if (!(await options.resolve())) throw new Error('CANCEL_REQUIRES_CURRENT_REASON_AND_STATE');
    await options.submit();
  },
});
