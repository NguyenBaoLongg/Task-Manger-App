import { ProblemError } from '../foundation.js';
import type { BookingStatus } from './types.js';

export type CustomerPhotoDebtState = 'OPEN' | 'RESOLVED' | 'WAIVED';

export function decideArrival(input: {
  readonly status: BookingStatus;
  readonly stateVersion: number;
  readonly expectedStateVersion: number;
  readonly hasReadyCustomerPhoto: boolean;
}) {
  if (input.status === 'ARRIVED') {
    return {
      nextStatus: 'ARRIVED' as const,
      nextStateVersion: input.stateVersion,
      opensPhotoDebt: !input.hasReadyCustomerPhoto,
    };
  }
  if (input.stateVersion !== input.expectedStateVersion) {
    throw new ProblemError(409, 'CONFLICT', 'Phiên bản lịch hẹn đã thay đổi.');
  }
  if (input.status !== 'SCHEDULED') {
    throw new ProblemError(
      422,
      'BUSINESS_RULE_VIOLATION',
      'Chỉ lịch hẹn đang chờ mới có thể ghi nhận khách đến.',
    );
  }
  return {
    nextStatus: 'ARRIVED' as const,
    nextStateVersion: input.stateVersion + 1,
    opensPhotoDebt: !input.hasReadyCustomerPhoto,
  };
}

export function decidePhotoDebtResolution(state: CustomerPhotoDebtState) {
  return state === 'OPEN'
    ? { changed: true, nextState: 'RESOLVED' as const }
    : { changed: false, nextState: state };
}

export function decideTourCompletion(input: {
  readonly status: BookingStatus;
  readonly stateVersion: number;
  readonly expectedStateVersion: number;
  readonly hasReadyCustomerPhoto: boolean;
}) {
  if (input.stateVersion !== input.expectedStateVersion) {
    throw new ProblemError(409, 'CONFLICT', 'Phiên bản lịch hẹn đã thay đổi.');
  }
  if (input.status !== 'ARRIVED') {
    throw new ProblemError(
      422,
      'BUSINESS_RULE_VIOLATION',
      'Khách phải ở trạng thái ARRIVED trước khi hoàn tất tour.',
    );
  }
  if (!input.hasReadyCustomerPhoto) {
    throw new ProblemError(
      422,
      'BUSINESS_RULE_VIOLATION',
      'Ảnh khách hợp lệ phải ở trạng thái READY trước khi hoàn tất tour.',
    );
  }
  return { allowed: true as const };
}
