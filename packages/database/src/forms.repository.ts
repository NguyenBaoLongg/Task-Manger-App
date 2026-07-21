import type { DatabaseClient } from './client.js';
import type { Prisma } from './generated/prisma/client.js';
import { ProblemError } from '@adsup/domain';

export class FormsRepository {
  constructor(private readonly db: DatabaseClient) {}
  listTemplates(tenantId: string) {
    return this.db.formTemplate.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
  }
  createTemplate(data: {
    tenantId: string;
    code: string;
    name: string;
    description?: string;
    createdByMembershipId: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const template = await tx.formTemplate.create({
        data: {
          tenantId: data.tenantId,
          code: data.code,
          name: data.name,
          description: data.description,
          createdByMembershipId: data.createdByMembershipId,
        },
      });
      await tx.formVersion.create({
        data: {
          tenantId: data.tenantId,
          formTemplateId: template.id,
          versionNumber: 1,
          status: 'DRAFT',
          jsonSchema: {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: data.tenantId,
          actorMembershipId: data.createdByMembershipId,
          correlationId: data.correlationId,
          eventType: 'FORM_TEMPLATE_CREATED',
          targetType: 'FORM_TEMPLATE',
          targetId: template.id,
          reason: 'FORM_TEMPLATE_CREATED_BY_ACTOR',
          afterRedacted: { code: template.code, name: template.name },
        },
      });
      return template;
    });
  }
  getTemplate(tenantId: string, id: string) {
    return this.db.formTemplate.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }
  async publish(data: {
    tenantId: string;
    templateId: string;
    jsonSchema: unknown;
    uiSchema?: unknown;
    actorMembershipId: string;
    effectiveFrom: Date;
    correlationId: string;
    reason: string;
  }) {
    return this.db.$transaction(
      async (tx) => {
        const template = await tx.formTemplate.findUnique({
          where: { tenantId_id: { tenantId: data.tenantId, id: data.templateId } },
        });
        if (!template || template.status !== 'ACTIVE')
          throw new ProblemError(409, 'CONFLICT', 'Biểu mẫu không còn hoạt động.');
        const latest = await tx.formVersion.findFirst({
          where: { tenantId: data.tenantId, formTemplateId: data.templateId },
          orderBy: { versionNumber: 'desc' },
        });
        const version =
          latest?.status === 'DRAFT'
            ? await tx.formVersion.update({
                where: {
                  tenantId_id: { tenantId: data.tenantId, id: latest.id },
                },
                data: {
                  status: 'PUBLISHED',
                  jsonSchema: data.jsonSchema as Prisma.InputJsonValue,
                  uiSchema: data.uiSchema as Prisma.InputJsonValue,
                  effectiveFrom: data.effectiveFrom,
                  publishedAt: new Date(),
                  publishedByMembershipId: data.actorMembershipId,
                },
              })
            : await tx.formVersion.create({
                data: {
                  tenantId: data.tenantId,
                  formTemplateId: data.templateId,
                  versionNumber: (latest?.versionNumber ?? 0) + 1,
                  status: 'PUBLISHED',
                  jsonSchema: data.jsonSchema as Prisma.InputJsonValue,
                  uiSchema: data.uiSchema as Prisma.InputJsonValue,
                  effectiveFrom: data.effectiveFrom,
                  publishedAt: new Date(),
                  publishedByMembershipId: data.actorMembershipId,
                },
              });
        await tx.formTemplate.update({
          where: { tenantId_id: { tenantId: data.tenantId, id: data.templateId } },
          data: { currentPublishedVersionId: version.id },
        });
        await tx.formVersion.create({
          data: {
            tenantId: data.tenantId,
            formTemplateId: data.templateId,
            versionNumber: version.versionNumber + 1,
            status: 'DRAFT',
            jsonSchema: version.jsonSchema as Prisma.InputJsonValue,
            uiSchema: version.uiSchema ?? undefined,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: data.tenantId,
            actorMembershipId: data.actorMembershipId,
            correlationId: data.correlationId,
            eventType: 'FORM_VERSION_PUBLISHED',
            targetType: 'FORM_VERSION',
            targetId: version.id,
            reason: data.reason,
            afterRedacted: {
              templateId: data.templateId,
              versionNumber: version.versionNumber,
              effectiveFrom: data.effectiveFrom.toISOString(),
            },
          },
        });
        return version;
      },
      { isolationLevel: 'Serializable' },
    );
  }
  archiveTemplate(data: {
    tenantId: string;
    templateId: string;
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const before = await tx.formTemplate.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: data.tenantId, id: data.templateId } },
      });
      const template = await tx.formTemplate.update({
        where: { tenantId_id: { tenantId: data.tenantId, id: data.templateId } },
        data: { status: 'ARCHIVED' },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: data.tenantId,
          actorMembershipId: data.actorMembershipId,
          correlationId: data.correlationId,
          eventType: 'FORM_TEMPLATE_ARCHIVED',
          targetType: 'FORM_TEMPLATE',
          targetId: data.templateId,
          reason: data.reason,
          beforeRedacted: { status: before.status },
          afterRedacted: { status: template.status },
        },
      });
      return template;
    });
  }
  retireVersion(data: {
    tenantId: string;
    templateId: string;
    versionId: string;
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.db.$transaction(
      async (tx) => {
        const before = await tx.formVersion.findUnique({
          where: { tenantId_id: { tenantId: data.tenantId, id: data.versionId } },
        });
        if (!before || before.formTemplateId !== data.templateId || before.status !== 'PUBLISHED')
          throw new ProblemError(409, 'CONFLICT', 'Chỉ có thể ngừng phiên bản đã phát hành.');
        const version = await tx.formVersion.update({
          where: { tenantId_id: { tenantId: data.tenantId, id: data.versionId } },
          data: { status: 'RETIRED' },
        });
        await tx.formTemplate.updateMany({
          where: {
            tenantId: data.tenantId,
            id: data.templateId,
            currentPublishedVersionId: data.versionId,
          },
          data: { currentPublishedVersionId: null },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: data.tenantId,
            actorMembershipId: data.actorMembershipId,
            correlationId: data.correlationId,
            eventType: 'FORM_VERSION_RETIRED',
            targetType: 'FORM_VERSION',
            targetId: data.versionId,
            reason: data.reason,
            beforeRedacted: { status: before.status },
            afterRedacted: { status: version.status },
          },
        });
        return version;
      },
      { isolationLevel: 'Serializable' },
    );
  }
  getVersion(tenantId: string, id: string) {
    return this.db.formVersion.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }
  async createSubmission(data: {
    tenantId: string;
    formTemplateId: string;
    formVersionId: string;
    submittedByMembershipId: string;
    branchId?: string;
    payload: unknown;
    idempotencyKey: string;
  }) {
    const existing = await this.db.formSubmission.findUnique({
      where: {
        tenantId_submittedByMembershipId_idempotencyKey: {
          tenantId: data.tenantId,
          submittedByMembershipId: data.submittedByMembershipId,
          idempotencyKey: data.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (
        JSON.stringify(existing.data) !== JSON.stringify(data.payload) ||
        existing.formVersionId !== data.formVersionId
      )
        throw new ProblemError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'Khóa idempotency đã dùng cho submission khác.',
        );
      return existing;
    }
    return this.db.formSubmission.create({
      data: {
        tenantId: data.tenantId,
        formTemplateId: data.formTemplateId,
        formVersionId: data.formVersionId,
        submittedByMembershipId: data.submittedByMembershipId,
        branchId: data.branchId,
        data: data.payload as Prisma.InputJsonValue,
        idempotencyKey: data.idempotencyKey,
      },
    });
  }
}
