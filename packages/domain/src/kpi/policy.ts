import { ProblemError } from '../foundation.js';
import type {
  BusinessDate,
  DailyPolicyInstants,
  PolicyCandidate,
  TargetCandidate,
} from './types.js';

const SCOPE_PRIORITY: Record<TargetCandidate['scopeType'], number> = {
  TENANT: 1,
  BRANCH: 2,
  DEPARTMENT: 3,
  GROUP: 4,
  MEMBERSHIP: 5,
};

export function resolveTarget(
  candidates: TargetCandidate[],
  instant: Date,
): TargetCandidate | null {
  const applicable = candidates.filter(
    (candidate) =>
      candidate.effectiveFrom <= instant &&
      (!candidate.effectiveTo || candidate.effectiveTo > instant),
  );
  return (
    applicable.sort(
      (left, right) =>
        SCOPE_PRIORITY[right.scopeType] - SCOPE_PRIORITY[left.scopeType] ||
        right.effectiveFrom.getTime() - left.effectiveFrom.getTime() ||
        right.versionNumber - left.versionNumber,
    )[0] ?? null
  );
}

export function resolvePolicy(
  candidates: PolicyCandidate[],
  branchId: string,
  businessDate: BusinessDate,
): PolicyCandidate | null {
  const applicable = candidates.filter(
    (candidate) =>
      candidate.effectiveFromDate <= businessDate &&
      (!candidate.effectiveToDate || candidate.effectiveToDate >= businessDate) &&
      (candidate.scopeType === 'TENANT' || candidate.branchId === branchId),
  );
  return (
    applicable.sort(
      (left, right) =>
        Number(right.scopeType === 'BRANCH') - Number(left.scopeType === 'BRANCH') ||
        right.effectiveFromDate.localeCompare(left.effectiveFromDate) ||
        right.versionNumber - left.versionNumber,
    )[0] ?? null
  );
}

export function isMembershipInPolicyScope(scope: unknown, membershipId: string): boolean {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return true;
  const value = scope as { membershipIds?: unknown; excludedMembershipIds?: unknown };
  const included = Array.isArray(value.membershipIds)
    ? value.membershipIds.filter((item): item is string => typeof item === 'string')
    : [];
  const excluded = Array.isArray(value.excludedMembershipIds)
    ? value.excludedMembershipIds.filter((item): item is string => typeof item === 'string')
    : [];
  if (excluded.includes(membershipId)) return false;
  return included.length === 0 || included.includes(membershipId);
}

function parseDateAndTime(businessDate: string, localTime: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(businessDate);
  const timeMatch = /^(\d{2}):(\d{2}):(\d{2})$/.exec(localTime);
  if (!dateMatch || !timeMatch) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'Ngày hoặc giờ nghiệp vụ không hợp lệ.');
  }
  return {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3]),
  };
}

export function localDateTimeToUtc(
  businessDate: BusinessDate,
  localTime: string,
  timezone: string,
): Date {
  const desired = parseDateAndTime(businessDate, localTime);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const desiredUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second,
  );
  let candidate = desiredUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(candidate))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    );
    const readPart = (name: string) => {
      const value = parts[name];
      if (typeof value !== 'number') {
        throw new ProblemError(422, 'VALIDATION_FAILED', 'Không thể diễn giải múi giờ đã chọn.');
      }
      return value;
    };
    const displayedUtc = Date.UTC(
      readPart('year'),
      readPart('month') - 1,
      readPart('day'),
      readPart('hour'),
      readPart('minute'),
      readPart('second'),
    );
    const difference = desiredUtc - displayedUtc;
    if (difference === 0) return new Date(candidate);
    candidate += difference;
  }
  throw new ProblemError(
    422,
    'VALIDATION_FAILED',
    'Thời điểm không tồn tại trong múi giờ đã chọn.',
  );
}

export function snapshotPolicyInstants(
  policy: Pick<
    PolicyCandidate,
    'timezone' | 'reportOpenLocal' | 'reportCloseLocal' | 'evaluationLocal'
  >,
  businessDate: BusinessDate,
): DailyPolicyInstants {
  const openedAt = localDateTimeToUtc(businessDate, policy.reportOpenLocal, policy.timezone);
  const closedAt = localDateTimeToUtc(businessDate, policy.reportCloseLocal, policy.timezone);
  const evaluationAt = localDateTimeToUtc(businessDate, policy.evaluationLocal, policy.timezone);
  if (!(openedAt < closedAt && closedAt < evaluationAt)) {
    throw new ProblemError(
      422,
      'VALIDATION_FAILED',
      'Thứ tự giờ báo cáo và đánh giá không hợp lệ.',
    );
  }
  return { openedAt, closedAt, evaluationAt };
}

export function isRevisionInWindow(submittedAt: Date, instants: DailyPolicyInstants): boolean {
  return submittedAt >= instants.openedAt && submittedAt < instants.closedAt;
}
