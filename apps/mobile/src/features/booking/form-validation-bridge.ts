export const serverValidationErrors = (problem: {
  fieldErrors?: Record<string, string>;
  formError?: string;
}) => ({ fieldErrors: problem.fieldErrors ?? {}, formError: problem.formError });
