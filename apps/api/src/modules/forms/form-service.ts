import { ProblemError } from '@adsup/domain';
import type { FormSubmission, FormTemplate, FormVersion, FormsRepository } from '@adsup/database';
import type { FormValidator } from './form-validator.js';

export class FormService {
  constructor(
    private readonly repository: FormsRepository,
    private readonly validator: FormValidator,
  ) {}
  list(tenantId: string): Promise<FormTemplate[]> {
    return this.repository.listTemplates(tenantId);
  }
  create(input: {
    tenantId: string;
    code: string;
    name: string;
    description?: string;
    actorMembershipId: string;
    correlationId: string;
  }): Promise<FormTemplate> {
    return this.repository.createTemplate({
      tenantId: input.tenantId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      description: input.description,
      createdByMembershipId: input.actorMembershipId,
      correlationId: input.correlationId,
    });
  }
  publish(input: {
    tenantId: string;
    templateId: string;
    jsonSchema: unknown;
    uiSchema?: unknown;
    actorMembershipId: string;
    effectiveFrom: Date;
    correlationId: string;
    reason: string;
  }): Promise<FormVersion> {
    this.validator.compile(input.jsonSchema);
    return this.repository.publish(input);
  }
  archiveTemplate(input: {
    tenantId: string;
    templateId: string;
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.repository.archiveTemplate(input);
  }
  retireVersion(input: {
    tenantId: string;
    templateId: string;
    versionId: string;
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.repository.retireVersion(input);
  }
  async submit(input: {
    tenantId: string;
    templateId: string;
    actorMembershipId: string;
    branchId?: string;
    formVersionId: string;
    data: unknown;
    idempotencyKey: string;
  }): Promise<FormSubmission> {
    const template = await this.repository.getTemplate(input.tenantId, input.templateId);
    if (!template || template.status !== 'ACTIVE')
      throw new ProblemError(
        404,
        'RESOURCE_NOT_FOUND',
        'Không tìm thấy biểu mẫu trong doanh nghiệp.',
      );
    const version = await this.repository.getVersion(input.tenantId, input.formVersionId);
    if (!version || version.formTemplateId !== input.templateId || version.status !== 'PUBLISHED')
      throw new ProblemError(409, 'CONFLICT', 'Phiên bản biểu mẫu không còn hiệu lực.');
    this.validator.validate(this.validator.compile(version.jsonSchema), input.data);
    return this.repository.createSubmission({
      tenantId: input.tenantId,
      formTemplateId: input.templateId,
      formVersionId: version.id,
      submittedByMembershipId: input.actorMembershipId,
      branchId: input.branchId,
      payload: input.data,
      idempotencyKey: input.idempotencyKey,
    });
  }
}
