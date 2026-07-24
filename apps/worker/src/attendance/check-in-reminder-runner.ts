import {
  buildCheckInReminderMessage,
  isFinalCheckInReminderDue,
  reminderTargetStartLocalTime,
  type CheckInReminderMessage,
  type PendingCheckInReminderRecipient,
} from '@adsup/domain';

export interface CheckInReminderRepository {
  listPendingCheckInReminderRecipients(input: {
    tenantId: string;
    businessDate: string;
    targetStartLocalTime: string;
    take?: number;
  }): Promise<PendingCheckInReminderRecipient[]>;
  listFinalCheckInReminderRecipients(input: {
    tenantId: string;
    businessDate: string;
    take?: number;
  }): Promise<PendingCheckInReminderRecipient[]>;
  emitCheckInReminder(input: CheckInReminderMessage): Promise<unknown>;
}

export class CheckInReminderRunner {
  constructor(private readonly repository: CheckInReminderRepository) {}

  async runTenant(input: {
    tenantId: string;
    businessDate: string;
    timezone?: string;
    now?: Date;
    leadMinutes?: number;
    finalLeadMinutes?: number;
    cutoffLocalTime?: string;
    take?: number;
  }) {
    const now = input.now ?? new Date();
    const leadMinutes = input.leadMinutes ?? 15;
    const timezone = input.timezone ?? 'Asia/Ho_Chi_Minh';
    const targetStartLocalTime = reminderTargetStartLocalTime({
      now,
      timezone,
      leadMinutes,
    });
    const recipients = await this.repository.listPendingCheckInReminderRecipients({
      tenantId: input.tenantId,
      businessDate: input.businessDate,
      targetStartLocalTime,
      take: input.take,
    });
    let reminders = 0;
    for (const group of groupRecipients(recipients)) {
      const reminder = buildCheckInReminderMessage({
        recipients: group,
        reminderAt: now,
        leadMinutes,
      });
      if (!reminder) continue;
      await this.repository.emitCheckInReminder(reminder);
      reminders += 1;
    }
    let processed = recipients.length;
    const finalLeadMinutes = input.finalLeadMinutes ?? 60;
    const cutoffLocalTime = input.cutoffLocalTime ?? '12:00';
    if (
      isFinalCheckInReminderDue({
        now,
        timezone,
        cutoffLocalTime,
        leadMinutes: finalLeadMinutes,
      })
    ) {
      const finalRecipients = await this.repository.listFinalCheckInReminderRecipients({
        tenantId: input.tenantId,
        businessDate: input.businessDate,
        take: input.take,
      });
      processed += finalRecipients.length;
      for (const group of groupRecipients(finalRecipients)) {
        const reminder = buildCheckInReminderMessage({
          recipients: group,
          reminderAt: now,
          reminderKind: 'NOON_FINAL',
          leadMinutes: finalLeadMinutes,
          cutoffLocalTime,
        });
        if (!reminder) continue;
        await this.repository.emitCheckInReminder(reminder);
        reminders += 1;
      }
    }
    return { processed, reminders, targetStartLocalTime };
  }
}

function groupRecipients(
  recipients: PendingCheckInReminderRecipient[],
): PendingCheckInReminderRecipient[][] {
  const groups = new Map<string, PendingCheckInReminderRecipient[]>();
  for (const recipient of recipients) {
    const key = [
      recipient.tenantId,
      recipient.branchId,
      recipient.businessDate,
      recipient.shiftDefinitionId,
    ].join(':');
    const group = groups.get(key) ?? [];
    group.push(recipient);
    groups.set(key, group);
  }
  return [...groups.values()];
}
