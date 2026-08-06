export type ApiProblem = {
  code: string;
  message: string;
  correlationId?: string;
  status?: number;
};

export class ApiProblemError extends Error {
  readonly code: string;
  readonly correlationId?: string;
  readonly status?: number;

  constructor(problem: ApiProblem) {
    super(problem.message);
    this.name = 'ApiProblemError';
    this.code = problem.code;
    this.correlationId = problem.correlationId;
    this.status = problem.status;
  }
}

export const parseProblem = (body: unknown, status: number): ApiProblem => {
  if (typeof body === 'object' && body !== null) {
    const value = body as Record<string, unknown>;
    return {
      code: typeof value.code === 'string' ? value.code : 'HTTP_ERROR',
      message: typeof value.message === 'string' ? value.message : 'Yêu cầu không thành công.',
      correlationId: typeof value.correlationId === 'string' ? value.correlationId : undefined,
      status,
    };
  }
  return { code: 'HTTP_ERROR', message: 'Yêu cầu không thành công.', status };
};
