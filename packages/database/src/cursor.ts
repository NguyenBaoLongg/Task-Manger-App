import { ProblemError } from '@adsup/domain';

export interface TimeCursor {
  timestamp: Date;
  id: string;
}

export interface OrdinalCursor {
  ordinal: number;
  id: string;
}

export function encodeTimeCursor(timestamp: Date, id: string): string {
  return Buffer.from(JSON.stringify({ timestamp: timestamp.toISOString(), id })).toString(
    'base64url',
  );
}

export function decodeTimeCursor(cursor?: string): TimeCursor | undefined {
  if (!cursor) return undefined;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      timestamp?: unknown;
      id?: unknown;
    };
    const timestamp = new Date(String(value.timestamp));
    if (typeof value.id !== 'string' || Number.isNaN(timestamp.getTime())) throw new Error();
    return { timestamp, id: value.id };
  } catch {
    throw new ProblemError(400, 'VALIDATION_FAILED', 'Con trỏ phân trang không hợp lệ.');
  }
}

export function encodeOrdinalCursor(ordinal: number, id: string): string {
  return Buffer.from(JSON.stringify({ ordinal, id })).toString('base64url');
}

export function decodeOrdinalCursor(cursor?: string): OrdinalCursor | undefined {
  if (!cursor) return undefined;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      ordinal?: unknown;
      id?: unknown;
    };
    if (
      typeof value.ordinal !== 'number' ||
      !Number.isSafeInteger(value.ordinal) ||
      value.ordinal < 1 ||
      typeof value.id !== 'string'
    ) {
      throw new Error();
    }
    return { ordinal: value.ordinal, id: value.id };
  } catch {
    throw new ProblemError(400, 'VALIDATION_FAILED', 'Con trỏ phân trang không hợp lệ.');
  }
}
