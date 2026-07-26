import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

export const openApiPath = fileURLToPath(
  new URL('../../../specs/001-multitenant-foundation/contracts/openapi.yaml', import.meta.url),
);

export const kpiOpenApiPath = fileURLToPath(
  new URL('../../../specs/002-okr-kpi-engine/contracts/openapi.yaml', import.meta.url),
);

export const timekeepingOpenApiPath = fileURLToPath(
  new URL('../../../specs/003-timekeeping-workflows/contracts/openapi.yaml', import.meta.url),
);

export const bookingOpenApiPath = fileURLToPath(
  new URL('../../../specs/004-booking-export/contracts/openapi.yaml', import.meta.url),
);

export async function loadOpenApiDocument(): Promise<Record<string, unknown>> {
  const source = await readFile(openApiPath, 'utf8');
  return YAML.parse(source) as Record<string, unknown>;
}

export async function loadKpiOpenApiDocument(): Promise<Record<string, unknown>> {
  const source = await readFile(kpiOpenApiPath, 'utf8');
  return YAML.parse(source) as Record<string, unknown>;
}

export async function loadTimekeepingOpenApiDocument(): Promise<Record<string, unknown>> {
  const source = await readFile(timekeepingOpenApiPath, 'utf8');
  return YAML.parse(source) as Record<string, unknown>;
}

export async function loadBookingOpenApiDocument(): Promise<Record<string, unknown>> {
  const source = await readFile(bookingOpenApiPath, 'utf8');
  return YAML.parse(source) as Record<string, unknown>;
}

export * from './kpi.js';
export * from './attendance.js';
export * from './booking.js';

export const problemCodes = [
  'AUTHENTICATION_REQUIRED',
  'AUTHORIZATION_DENIED',
  'PROFILE_CONFIRMATION_REQUIRED',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  'CONFLICT',
  'BOOKING_CONFLICT',
  'IDEMPOTENCY_KEY_REUSED',
  'LAST_OWNER_REQUIRED',
  'PROVIDER_UNAVAILABLE',
  'BUSINESS_RULE_VIOLATION',
  'MULTIPLE_ACTIVE_BRANCHES',
  'NO_ACTIVE_BRANCH',
  'INTERNAL_ERROR',
] as const;
