import { kpiDigest, type KpiSourcePort } from '@adsup/domain';
import type { FormSubmission, KpiSourceMappingVersion } from '@adsup/database';

export interface AttendanceKpiSourceReader {
  readAttendanceOnTime(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    businessDate: string;
  }): Promise<{
    sourceAttendanceEventId: string;
    observedAt: Date;
    value: '100' | '0';
    dayClassification?: string;
    scheduleVersionId?: string;
    policyVersionId?: string;
  } | null>;
}

export interface BookingTourKpiSourceReader {
  getCompletedTourCount(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    businessDate: string;
    asOf: string;
  }): Promise<{
    value: number | null;
    sourceFreshnessAt: string;
    sourceRefs: Array<{ type: 'TOUR_COMPLETION'; id: string; occurredAt: string }>;
  }>;
}

function readJsonPointer(value: unknown, pointer: string): unknown {
  if (pointer === '') return value;
  return pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[segment];
    }, value);
}

export class KpiSourceService {
  constructor(
    private readonly domainSource: KpiSourcePort,
    private readonly attendanceSource?: AttendanceKpiSourceReader,
    private readonly bookingTourSource?: BookingTourKpiSourceReader,
  ) {}

  async read(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    businessDate: string;
    kpiCode: string;
    mapping: KpiSourceMappingVersion;
    submission: FormSubmission | null;
  }) {
    if (input.mapping.sourceType === 'FORM_FIELD') {
      if (
        !input.submission ||
        input.submission.tenantId !== input.tenantId ||
        input.submission.submittedByMembershipId !== input.membershipId ||
        input.submission.branchId !== input.branchId ||
        input.submission.formTemplateId !== input.mapping.formTemplateId ||
        input.submission.formVersionId !== input.mapping.formVersionId ||
        !input.mapping.jsonPointer
      ) {
        return null;
      }
      const raw = readJsonPointer(input.submission.data, input.mapping.jsonPointer);
      if (typeof raw !== 'number' && typeof raw !== 'string') return null;
      const value = String(raw);
      return {
        sourceType: 'FORM_SUBMISSION' as const,
        sourceId: input.submission.id,
        observedAt: input.submission.submittedAt,
        value,
        inputDigest: kpiDigest({
          sourceId: input.submission.id,
          value,
          mappingId: input.mapping.id,
        }),
      };
    }
    if (
      input.mapping.sourceType === 'DOMAIN_ADAPTER' &&
      input.mapping.adapterCode === 'ATTENDANCE_ON_TIME_RATE'
    ) {
      const snapshot = await this.attendanceSource?.readAttendanceOnTime({
        tenantId: input.tenantId,
        membershipId: input.membershipId,
        branchId: input.branchId,
        businessDate: input.businessDate,
      });
      if (!snapshot) return null;
      return {
        sourceType: 'ATTENDANCE' as const,
        sourceId: snapshot.sourceAttendanceEventId,
        observedAt: snapshot.observedAt,
        value: snapshot.value,
        unit: 'PERCENT',
        inputDigest: kpiDigest({
          sourceId: snapshot.sourceAttendanceEventId,
          value: snapshot.value,
          mappingId: input.mapping.id,
          businessDate: input.businessDate,
          dayClassification: snapshot.dayClassification,
          scheduleVersionId: snapshot.scheduleVersionId,
          policyVersionId: snapshot.policyVersionId,
        }),
      };
    }
    if (
      input.mapping.sourceType === 'DOMAIN_ADAPTER' &&
      input.mapping.adapterCode === 'BOOKING_COMPLETED_TOURS'
    ) {
      const snapshot = await this.bookingTourSource?.getCompletedTourCount({
        tenantId: input.tenantId,
        membershipId: input.membershipId,
        branchId: input.branchId,
        businessDate: input.businessDate,
        asOf: new Date().toISOString(),
      });
      if (!snapshot || snapshot.value === null) return null;
      const sourceId = snapshot.sourceRefs.at(-1)?.id ?? input.mapping.id;
      return {
        sourceType: 'DOMAIN' as const,
        sourceId,
        observedAt: new Date(snapshot.sourceFreshnessAt),
        value: String(snapshot.value),
        unit: 'TOUR',
        inputDigest: kpiDigest({
          mappingId: input.mapping.id,
          value: snapshot.value,
          sourceFreshnessAt: snapshot.sourceFreshnessAt,
          sourceRefs: snapshot.sourceRefs,
        }),
      };
    }
    return this.domainSource.read({
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      branchId: input.branchId,
      businessDate: input.businessDate,
      kpiCode: input.kpiCode,
      mappingVersionId: input.mapping.id,
    });
  }
}
