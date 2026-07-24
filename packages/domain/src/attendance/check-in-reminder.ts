import type { AttendanceBranchId, AttendanceBusinessDate } from './types.js';
import type { MembershipId, TenantId, UUID } from '../foundation.js';

const timezoneOffsets: Record<string, number> = {
  'Asia/Ho_Chi_Minh': 7 * 60,
  'Asia/Saigon': 7 * 60,
  UTC: 0,
};

export interface PendingCheckInReminderRecipient {
  tenantId: TenantId;
  membershipId: MembershipId;
  branchId: AttendanceBranchId;
  businessDate: AttendanceBusinessDate;
  scheduleVersionId: UUID;
  shiftDefinitionId: UUID;
  shiftCode: string;
  shiftStartLocalTime: string;
  membershipDisplayName: string;
}

export type CheckInReminderKind = 'PRE_SHIFT' | 'NOON_FINAL';

export interface CheckInReminderMessage {
  tenantId: TenantId;
  branchId: AttendanceBranchId;
  businessDate: AttendanceBusinessDate;
  shiftDefinitionId: UUID;
  shiftCode: string;
  shiftStartLocalTime: string;
  reminderKind: CheckInReminderKind;
  reminderLeadMinutes: number;
  cutoffLocalTime?: string;
  reminderAt: Date;
  mentionMembershipIds: MembershipId[];
  mentionDisplayNames: string[];
  messageBody: string;
  dedupeKey: string;
}

export function reminderTargetStartLocalTime(input: {
  now: Date;
  timezone: string;
  leadMinutes?: number;
}): string {
  const leadMinutes = input.leadMinutes ?? 15;
  return formatTenantLocalTime(
    new Date(input.now.getTime() + leadMinutes * 60_000),
    input.timezone,
  );
}

export function currentTenantLocalTime(input: { now: Date; timezone: string }): string {
  return formatTenantLocalTime(input.now, input.timezone);
}

export function finalCheckInReminderLocalTime(input?: {
  cutoffLocalTime?: string;
  leadMinutes?: number;
}): string {
  const cutoffLocalTime = input?.cutoffLocalTime ?? '12:00';
  const leadMinutes = input?.leadMinutes ?? 60;
  const [hours = '0', minutes = '0'] = cutoffLocalTime.split(':');
  const totalMinutes = Number(hours) * 60 + Number(minutes) - leadMinutes;
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(
    normalized % 60,
  ).padStart(2, '0')}`;
}

export function isFinalCheckInReminderDue(input: {
  now: Date;
  timezone: string;
  cutoffLocalTime?: string;
  leadMinutes?: number;
}): boolean {
  return (
    currentTenantLocalTime({ now: input.now, timezone: input.timezone }) ===
    finalCheckInReminderLocalTime({
      cutoffLocalTime: input.cutoffLocalTime,
      leadMinutes: input.leadMinutes,
    })
  );
}

export function buildCheckInReminderMessage(input: {
  recipients: PendingCheckInReminderRecipient[];
  reminderAt: Date;
  leadMinutes?: number;
  reminderKind?: CheckInReminderKind;
  cutoffLocalTime?: string;
}): CheckInReminderMessage | null {
  const [first] = input.recipients;
  if (!first) return null;
  const recipients = dedupeRecipients(input.recipients);
  for (const recipient of recipients) {
    if (
      recipient.tenantId !== first.tenantId ||
      recipient.branchId !== first.branchId ||
      recipient.businessDate !== first.businessDate ||
      recipient.shiftDefinitionId !== first.shiftDefinitionId
    ) {
      throw new Error('CHECKIN_REMINDER_GROUP_SCOPE_MISMATCH');
    }
  }
  const mentionMembershipIds = recipients.map((recipient) => recipient.membershipId);
  const mentionDisplayNames = recipients.map((recipient) =>
    displayNameForMention(recipient.membershipDisplayName, recipient.membershipId),
  );
  const mentionText = mentionDisplayNames.map((name) => `@${name}`).join(', ');
  const leadMinutes = input.leadMinutes ?? 15;
  const reminderKind = input.reminderKind ?? 'PRE_SHIFT';
  const cutoffLocalTime = input.cutoffLocalTime ?? '12:00';
  const messageBody =
    reminderKind === 'NOON_FINAL'
      ? `Nhắc check-in lần cuối trước ${cutoffLocalTime} ca ${first.shiftStartLocalTime}: ${mentionText} chưa check-in video. Sau ${cutoffLocalTime} sẽ tính lỗi không check-in và phạt theo policy nếu không có OFF/nghỉ hợp lệ.`
      : `Nhắc check-in ca ${first.shiftStartLocalTime}: ${mentionText} chưa check-in video.`;
  const dedupeKey =
    reminderKind === 'NOON_FINAL'
      ? `attendance-checkin-reminder-final:${first.tenantId}:${first.branchId}:${first.businessDate}:${first.shiftDefinitionId}:${cutoffLocalTime}:${leadMinutes}`
      : `attendance-checkin-reminder:${first.tenantId}:${first.branchId}:${first.businessDate}:${first.shiftDefinitionId}:${leadMinutes}`;
  return {
    tenantId: first.tenantId,
    branchId: first.branchId,
    businessDate: first.businessDate,
    shiftDefinitionId: first.shiftDefinitionId,
    shiftCode: first.shiftCode,
    shiftStartLocalTime: first.shiftStartLocalTime,
    reminderKind,
    reminderLeadMinutes: leadMinutes,
    cutoffLocalTime: reminderKind === 'NOON_FINAL' ? cutoffLocalTime : undefined,
    reminderAt: input.reminderAt,
    mentionMembershipIds,
    mentionDisplayNames,
    messageBody,
    dedupeKey,
  };
}

function formatTenantLocalTime(value: Date, timezone: string): string {
  const offset = timezoneOffsets[timezone] ?? 0;
  const local = new Date(value.getTime() + offset * 60_000);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(
    2,
    '0',
  )}`;
}

function dedupeRecipients(
  recipients: PendingCheckInReminderRecipient[],
): PendingCheckInReminderRecipient[] {
  const seen = new Set<MembershipId>();
  const deduped: PendingCheckInReminderRecipient[] = [];
  for (const recipient of recipients) {
    if (seen.has(recipient.membershipId)) continue;
    seen.add(recipient.membershipId);
    deduped.push(recipient);
  }
  return deduped.sort((a, b) =>
    displayNameForMention(a.membershipDisplayName, a.membershipId).localeCompare(
      displayNameForMention(b.membershipDisplayName, b.membershipId),
      'vi',
    ),
  );
}

function displayNameForMention(name: string, fallback: MembershipId): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}
