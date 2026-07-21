import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import { ProblemError } from '@adsup/domain';

const allowedTypes = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);
const allowedFormats = new Set(['date', 'time', 'date-time', 'email']);

function inspect(node: unknown): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(inspect);
    return;
  }
  const record = node as Record<string, unknown>;
  if ('$ref' in record || '$dynamicRef' in record)
    throw new ProblemError(
      422,
      'VALIDATION_FAILED',
      'Schema không được tham chiếu tài nguyên bên ngoài.',
    );
  if (typeof record.type === 'string' && !allowedTypes.has(record.type))
    throw new ProblemError(
      422,
      'VALIDATION_FAILED',
      `Kiểu trường không được hỗ trợ: ${record.type}`,
    );
  if (typeof record.format === 'string' && !allowedFormats.has(record.format))
    throw new ProblemError(
      422,
      'VALIDATION_FAILED',
      `Định dạng không được hỗ trợ: ${record.format}`,
    );
  Object.values(record).forEach(inspect);
}

export class FormValidator {
  private readonly ajv = new Ajv2020({ strict: true, allErrors: true, validateFormats: false });
  compile(schema: unknown): ValidateFunction {
    inspect(schema);
    const record = schema as Record<string, unknown>;
    if (record.$schema !== 'https://json-schema.org/draft/2020-12/schema')
      throw new ProblemError(
        422,
        'VALIDATION_FAILED',
        'Schema phải khai báo JSON Schema draft 2020-12.',
      );
    try {
      return this.ajv.compile(record);
    } catch (error) {
      throw new ProblemError(422, 'VALIDATION_FAILED', 'Schema biểu mẫu không hợp lệ.', {
        schema: error instanceof Error ? error.message : 'invalid',
      });
    }
  }
  validate(validate: ValidateFunction, data: unknown): void {
    if (validate(data)) return;
    throw new ProblemError(
      422,
      'VALIDATION_FAILED',
      'Dữ liệu biểu mẫu không hợp lệ.',
      (validate.errors ?? []).map((error: ErrorObject) => ({
        path: error.instancePath || '/',
        keyword: error.keyword,
        message: error.message,
      })),
    );
  }
}
