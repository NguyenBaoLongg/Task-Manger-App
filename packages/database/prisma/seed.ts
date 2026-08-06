import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for seed');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

const tenantId = '10000000-0000-4000-8000-000000000001';
const ownerUserId = '20000000-0000-4000-8000-000000000001';
const ownerMembershipId = '30000000-0000-4000-8000-000000000001';
const permissionCodes = [
  'tenant.read',
  'branch.manage',
  'organization.manage',
  'member.read',
  'member.invite',
  'member.manage',
  'role.read',
  'role.manage',
  'form.read',
  'form.manage',
  'form.submit',
  'chat.read',
  'chat.write',
  'chat.manage',
  'media.create',
  'media.read',
  'audit.read',
  // Append-only: permission IDs are deterministic and already referenced by seeded bindings.
  'tenant.manage',
  'kpi.view',
  'kpi.configure',
  'kpi.target.manage',
  'kpi.policy.manage',
  'kpi.report.submit',
  'kpi.evaluation.view',
  'kpi.evaluation.rerun',
  'kpi.penalty.adjust',
  'attendance.schedule.self',
  'attendance.schedule.manage',
  'attendance.video-policy.manage',
  'attendance.video.review',
  'attendance.penalty-policy.manage',
  'workflow.configure',
  'workflow.decide',
  'attendance.leave.manage',
  'attendance.off-calendar.manage',
  'attendance.penalty.self',
  'attendance.penalty.payment.manage',
  'attendance.media.legal-hold',
  'booking.customer.read',
  'booking.customer.manage',
  'booking.read',
  'booking.manage',
  'booking.arrival.manage',
  'booking.outcome.manage',
  'booking.outcome.correct',
  'booking.tour.complete',
  'booking.photo-debt.read',
  'booking.config.read',
  'booking.config.manage',
  'booking.report.rerun',
  'booking.export.read',
  'booking.export.create',
  'booking.export.download',
  'booking.retention.manage',
  'booking.legal-hold.manage',
] as const;

const branchScopedPermissionCodes = new Set([
  'branch.manage',
  'kpi.view',
  'kpi.target.manage',
  'kpi.report.submit',
  'kpi.evaluation.view',
  'kpi.evaluation.rerun',
  'kpi.penalty.adjust',
  'attendance.schedule.manage',
  'attendance.video-policy.manage',
  'attendance.video.review',
  'attendance.penalty-policy.manage',
  'workflow.configure',
  'workflow.decide',
  'attendance.leave.manage',
  'attendance.off-calendar.manage',
  'attendance.penalty.payment.manage',
  'booking.customer.read',
  'booking.customer.manage',
  'booking.read',
  'booking.manage',
  'booking.arrival.manage',
  'booking.outcome.manage',
  'booking.outcome.correct',
  'booking.tour.complete',
  'booking.photo-debt.read',
  'booking.config.read',
  'booking.config.manage',
  'booking.report.rerun',
  'booking.export.read',
  'booking.export.create',
  'booking.export.download',
  'booking.retention.manage',
  'booking.legal-hold.manage',
]);

const stable = (prefix: number, index: number) =>
  `${String(prefix).padStart(8, '0')}-0000-4000-8000-${String(index).padStart(12, '0')}`;

async function main() {
  for (const [index, code] of permissionCodes.entries()) {
    await prisma.permission.upsert({
      where: { code },
      update: {
        description: code,
        allowedScopes: branchScopedPermissionCodes.has(code) ? ['TENANT', 'BRANCH'] : ['TENANT'],
      },
      create: {
        id: stable(10, index + 1),
        code,
        description: code,
        allowedScopes: branchScopedPermissionCodes.has(code) ? ['TENANT', 'BRANCH'] : ['TENANT'],
      },
    });
  }

  await prisma.user.upsert({
    where: { id: ownerUserId },
    update: {
      fullName: 'Nguyễn Chủ Doanh Nghiệp',
      fullNameConfirmedAt: new Date('2026-07-10T00:00:00Z'),
    },
    create: {
      id: ownerUserId,
      fullName: 'Nguyễn Chủ Doanh Nghiệp',
      fullNameConfirmedAt: new Date('2026-07-10T00:00:00Z'),
    },
  });
  await prisma.externalIdentity.upsert({
    where: {
      provider_providerSubject: { provider: 'GOOGLE', providerSubject: 'local-mobile-user' },
    },
    update: {
      userId: ownerUserId,
      email: 'mobile@adsup.local',
      emailVerified: true,
    },
    create: {
      userId: ownerUserId,
      provider: 'GOOGLE',
      providerSubject: 'local-mobile-user',
      email: 'mobile@adsup.local',
      emailVerified: true,
    },
  });
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: { name: 'Công ty TNHH ABC' },
    create: {
      id: tenantId,
      name: 'Công ty TNHH ABC',
      slug: 'cong-ty-tnhh-abc',
      timezone: 'Asia/Ho_Chi_Minh',
      createdByUserId: ownerUserId,
    },
  });
  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId, userId: ownerUserId } },
    update: { membershipDisplayName: 'Nguyễn Chủ Doanh Nghiệp', status: 'ACTIVE' },
    create: {
      tenantId,
      id: ownerMembershipId,
      userId: ownerUserId,
      membershipDisplayName: 'Nguyễn Chủ Doanh Nghiệp',
      employeeCode: 'NV001',
      status: 'ACTIVE',
      joinedAt: new Date('2026-07-10T00:00:00Z'),
    },
  });

  const branches = [
    { id: stable(40, 1), code: 'CS-Q1', name: 'Cơ sở Quận 1' },
    { id: stable(40, 2), code: 'CS-Q3', name: 'Cơ sở Quận 3' },
    { id: stable(40, 3), code: 'CS-TD', name: 'Cơ sở Thủ Đức' },
  ];
  for (const branch of branches) {
    await prisma.branch.upsert({
      where: { tenantId_code: { tenantId, code: branch.code } },
      update: { name: branch.name },
      create: { tenantId, ...branch, createdByMembershipId: ownerMembershipId },
    });
  }
  const departments = [
    { id: stable(41, 1), code: 'KINH-DOANH', name: 'Kinh doanh' },
    { id: stable(41, 2), code: 'KY-THUAT', name: 'Kỹ thuật viên' },
    { id: stable(41, 3), code: 'MARKETING', name: 'Marketing' },
    { id: stable(41, 4), code: 'VAN-HANH', name: 'Vận hành' },
  ];
  for (const department of departments) {
    await prisma.department.upsert({
      where: { tenantId_code: { tenantId, code: department.code } },
      update: { name: department.name },
      create: { tenantId, ...department },
    });
  }
  const positions = [
    { id: stable(42, 1), code: 'QUAN-TRI', name: 'Quản trị viên' },
    { id: stable(42, 2), code: 'TRUONG-PHONG', name: 'Trưởng phòng' },
    { id: stable(42, 3), code: 'NHAN-VIEN', name: 'Nhân viên' },
  ];
  for (const position of positions) {
    await prisma.position.upsert({
      where: { tenantId_code: { tenantId, code: position.code } },
      update: { name: position.name },
      create: { tenantId, ...position },
    });
  }

  const roles = [
    { id: stable(43, 1), code: 'TENANT_OWNER', name: 'Chủ doanh nghiệp' },
    { id: stable(43, 2), code: 'MANAGER', name: 'Quản lý' },
    { id: stable(43, 3), code: 'EMPLOYEE', name: 'Nhân viên' },
  ];
  for (const role of roles) {
    await prisma.role.upsert({
      where: { tenantId_code: { tenantId, code: role.code } },
      update: { name: role.name },
      create: { tenantId, ...role, kind: 'SYSTEM' },
    });
  }

  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        tenantId_roleId_permissionId: {
          tenantId,
          roleId: roles[0]!.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: { tenantId, roleId: roles[0]!.id, permissionId: permission.id },
    });
  }
  const managerCodes = new Set([
    'tenant.read',
    'branch.manage',
    'organization.manage',
    'member.read',
    'member.invite',
    'member.manage',
    'role.read',
    'form.read',
    'form.manage',
    'form.submit',
    'chat.read',
    'chat.write',
    'chat.manage',
    'media.create',
    'media.read',
    'kpi.view',
    'kpi.report.submit',
    'kpi.target.manage',
    'kpi.evaluation.view',
    'kpi.evaluation.rerun',
    'attendance.schedule.manage',
    'attendance.video.review',
    'workflow.decide',
    'attendance.leave.manage',
    'attendance.off-calendar.manage',
    'attendance.penalty.self',
    'attendance.penalty.payment.manage',
    'booking.customer.read',
    'booking.customer.manage',
    'booking.read',
    'booking.manage',
    'booking.arrival.manage',
    'booking.outcome.manage',
    'booking.outcome.correct',
    'booking.tour.complete',
    'booking.photo-debt.read',
    'booking.config.read',
    'booking.config.manage',
    'booking.report.rerun',
    'booking.export.read',
    'booking.export.create',
    'booking.export.download',
  ]);
  const employeeCodes = new Set([
    'tenant.read',
    'member.read',
    'form.read',
    'form.submit',
    'chat.read',
    'chat.write',
    'media.create',
    'media.read',
    'kpi.view',
    'kpi.report.submit',
    'attendance.schedule.self',
    'attendance.penalty.self',
    'booking.customer.read',
    'booking.read',
    'booking.arrival.manage',
    'booking.tour.complete',
    'booking.photo-debt.read',
  ]);
  for (const permission of allPermissions) {
    if (managerCodes.has(permission.code))
      await prisma.rolePermission.upsert({
        where: {
          tenantId_roleId_permissionId: {
            tenantId,
            roleId: roles[1]!.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: { tenantId, roleId: roles[1]!.id, permissionId: permission.id },
      });
    if (employeeCodes.has(permission.code))
      await prisma.rolePermission.upsert({
        where: {
          tenantId_roleId_permissionId: {
            tenantId,
            roleId: roles[2]!.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: { tenantId, roleId: roles[2]!.id, permissionId: permission.id },
      });
  }
  await prisma.membershipRoleBinding.upsert({
    where: { tenantId_id: { tenantId, id: stable(44, 1) } },
    update: {},
    create: {
      tenantId,
      id: stable(44, 1),
      membershipId: ownerMembershipId,
      roleId: roles[0]!.id,
      scopeType: 'TENANT',
      effectiveFrom: new Date('2026-07-10T00:00:00Z'),
      grantedByMembershipId: ownerMembershipId,
    },
  });

  await prisma.assignment.upsert({
    where: { tenantId_id: { tenantId, id: stable(50, 1) } },
    update: {
      branchId: branches[0]!.id,
      departmentId: departments[0]!.id,
      positionId: positions[0]!.id,
      status: 'ACTIVE',
      effectiveTo: null,
    },
    create: {
      tenantId,
      id: stable(50, 1),
      membershipId: ownerMembershipId,
      branchId: branches[0]!.id,
      departmentId: departments[0]!.id,
      positionId: positions[0]!.id,
      effectiveFrom: new Date('2026-07-10T00:00:00Z'),
      createdByMembershipId: ownerMembershipId,
      reason: 'MVP_SINGLE_BRANCH_ASSIGNMENT',
    },
  });

  for (let index = 2; index <= 30; index += 1) {
    const userId = stable(20, index);
    const membershipId = stable(30, index);
    const name = `Nhân viên ${String(index).padStart(2, '0')}`;
    await prisma.user.upsert({
      where: { id: userId },
      update: { fullName: name },
      create: { id: userId, fullName: name, fullNameConfirmedAt: new Date('2026-07-10T00:00:00Z') },
    });
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      update: { membershipDisplayName: name },
      create: {
        tenantId,
        id: membershipId,
        userId,
        membershipDisplayName: name,
        employeeCode: `NV${String(index).padStart(3, '0')}`,
        status: 'ACTIVE',
        joinedAt: new Date('2026-07-10T00:00:00Z'),
      },
    });
    await prisma.assignment.upsert({
      where: { tenantId_id: { tenantId, id: stable(50, index) } },
      update: {},
      create: {
        tenantId,
        id: stable(50, index),
        membershipId,
        branchId: branches[index % branches.length]!.id,
        departmentId: departments[index % departments.length]!.id,
        positionId: index <= 4 ? positions[1]!.id : positions[2]!.id,
        effectiveFrom: new Date('2026-07-10T00:00:00Z'),
        createdByMembershipId: ownerMembershipId,
      },
    });
    const role = index <= 4 ? roles[1]! : roles[2]!;
    await prisma.membershipRoleBinding.upsert({
      where: { tenantId_id: { tenantId, id: stable(44, index) } },
      update: {},
      create: {
        tenantId,
        id: stable(44, index),
        membershipId,
        roleId: role.id,
        scopeType: index <= 4 ? 'BRANCH' : 'TENANT',
        branchId: index <= 4 ? branches[index % branches.length]!.id : null,
        effectiveFrom: new Date('2026-07-10T00:00:00Z'),
        grantedByMembershipId: ownerMembershipId,
      },
    });
  }

  await prisma.chatChannel.upsert({
    where: { tenantId_id: { tenantId, id: stable(60, 1) } },
    update: { name: 'Kênh chung' },
    create: {
      tenantId,
      id: stable(60, 1),
      type: 'TENANT_GENERAL',
      name: 'Kênh chung',
      createdByMembershipId: ownerMembershipId,
    },
  });

  const formSeeds = [
    {
      id: stable(65, 1),
      versionId: stable(66, 1),
      code: 'DAILY_WORK_REPORT',
      name: 'Báo cáo công việc hằng ngày',
      jsonSchema: {
        type: 'object',
        required: ['revenue', 'completedTasks'],
        properties: {
          revenue: { type: 'string', pattern: '^[0-9]+$' },
          completedTasks: { type: 'integer', minimum: 0 },
          notes: { type: 'string', maxLength: 2000 },
        },
        additionalProperties: false,
      },
    },
    {
      id: stable(65, 2),
      versionId: stable(66, 2),
      code: 'LEAVE_REQUEST',
      name: 'Xin nghỉ phép',
      jsonSchema: {
        type: 'object',
        required: ['fromDate', 'toDate', 'reason'],
        properties: {
          fromDate: { type: 'string', format: 'date' },
          toDate: { type: 'string', format: 'date' },
          reason: { type: 'string', minLength: 3, maxLength: 1000 },
        },
        additionalProperties: false,
      },
    },
    {
      id: stable(65, 3),
      versionId: stable(66, 3),
      code: 'ATTENDANCE_CHECKIN',
      name: 'Chấm công',
      jsonSchema: {
        type: 'object',
        required: ['shiftCode'],
        properties: {
          shiftCode: { type: 'string', enum: ['SHIFT_0830', 'SHIFT_0930'] },
          note: { type: 'string', maxLength: 1000 },
        },
        additionalProperties: false,
      },
    },
    {
      id: stable(65, 4),
      versionId: stable(66, 4),
      code: 'BOOKING_FORM',
      name: 'Thông tin lịch hẹn',
      jsonSchema: {
        type: 'object',
        required: ['customerNeed'],
        properties: {
          customerNeed: { type: 'string', minLength: 1, maxLength: 1000 },
          note: { type: 'string', maxLength: 2000 },
        },
        additionalProperties: false,
      },
    },
  ];
  for (const form of formSeeds) {
    await prisma.formTemplate.upsert({
      where: { tenantId_code: { tenantId, code: form.code } },
      update: { name: form.name, status: 'ACTIVE' },
      create: {
        tenantId,
        id: form.id,
        code: form.code,
        name: form.name,
        createdByMembershipId: ownerMembershipId,
      },
    });
    await prisma.formVersion.upsert({
      where: { tenantId_id: { tenantId, id: form.versionId } },
      update: { jsonSchema: form.jsonSchema, status: 'PUBLISHED' },
      create: {
        tenantId,
        id: form.versionId,
        formTemplateId: form.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        jsonSchema: form.jsonSchema,
        uiSchema: {},
        effectiveFrom: new Date('2026-07-10T00:00:00Z'),
        publishedAt: new Date('2026-07-10T00:00:00Z'),
        publishedByMembershipId: ownerMembershipId,
      },
    });
    await prisma.formTemplate.update({
      where: { tenantId_id: { tenantId, id: form.id } },
      data: { currentPublishedVersionId: form.versionId },
    });
  }

  const kpiDefinitions = [
    {
      id: stable(70, 1),
      code: 'DAILY_REVENUE',
      name: 'Doanh số',
      valueType: 'MONEY' as const,
      unit: 'VND',
      direction: 'AT_LEAST' as const,
      sourceType: 'FORM_FIELD' as const,
    },
    {
      id: stable(70, 2),
      code: 'COMPLETED_TASKS',
      name: 'Số nhiệm vụ hoàn thành',
      valueType: 'COUNT' as const,
      unit: 'TASK',
      direction: 'AT_LEAST' as const,
      sourceType: 'FORM_FIELD' as const,
    },
    {
      id: stable(70, 3),
      code: 'ON_TIME_RATE',
      name: 'Tỷ lệ đi làm đúng giờ',
      valueType: 'PERCENTAGE' as const,
      unit: 'PERCENT',
      direction: 'AT_LEAST' as const,
      sourceType: 'DOMAIN_ADAPTER' as const,
    },
  ];
  for (const definition of kpiDefinitions) {
    await prisma.kpiDefinition.upsert({
      where: { tenantId_code: { tenantId, code: definition.code } },
      update: {
        name: definition.name,
        valueType: definition.valueType,
        unit: definition.unit,
        direction: definition.direction,
        sourceType: definition.sourceType,
        status: 'ACTIVE',
      },
      create: { tenantId, ...definition, createdByMembershipId: ownerMembershipId },
    });
  }

  const defaultTargets = [
    { id: stable(71, 1), kpiDefinitionId: stable(70, 1), targetMoneyMinor: 10_000_000n },
    { id: stable(71, 2), kpiDefinitionId: stable(70, 2), targetCount: 10n },
    { id: stable(71, 3), kpiDefinitionId: stable(70, 3), targetPercentage: 100 },
  ];
  for (const target of defaultTargets) {
    await prisma.kpiTargetVersion.upsert({
      where: { tenantId_id: { tenantId, id: target.id } },
      update: {},
      create: {
        tenantId,
        ...target,
        scopeType: 'TENANT',
        required: true,
        effectiveFrom: new Date('2026-07-10T00:00:00Z'),
        versionNumber: 1,
        createdByMembershipId: ownerMembershipId,
        reason: 'MVP_DEFAULT_TARGET',
      },
    });
  }

  const sourceMappings = [
    {
      id: stable(72, 1),
      kpiDefinitionId: stable(70, 1),
      sourceType: 'FORM_FIELD' as const,
      formTemplateId: stable(65, 1),
      formVersionId: stable(66, 1),
      jsonPointer: '/revenue',
      adapterCode: null,
      aggregation: 'LATEST',
    },
    {
      id: stable(72, 2),
      kpiDefinitionId: stable(70, 2),
      sourceType: 'FORM_FIELD' as const,
      formTemplateId: stable(65, 1),
      formVersionId: stable(66, 1),
      jsonPointer: '/completedTasks',
      adapterCode: null,
      aggregation: 'LATEST',
    },
    {
      id: stable(72, 3),
      kpiDefinitionId: stable(70, 3),
      sourceType: 'DOMAIN_ADAPTER' as const,
      formTemplateId: null,
      formVersionId: null,
      jsonPointer: null,
      adapterCode: 'ATTENDANCE_ON_TIME_RATE',
      aggregation: 'LATEST',
    },
  ];
  for (const mapping of sourceMappings) {
    await prisma.kpiSourceMappingVersion.upsert({
      where: { tenantId_id: { tenantId, id: mapping.id } },
      update: {},
      create: {
        tenantId,
        ...mapping,
        requiresEvidence: false,
        effectiveFrom: new Date('2026-07-10T00:00:00Z'),
        versionNumber: 1,
        createdByMembershipId: ownerMembershipId,
        reason: 'MVP_DEFAULT_SOURCE_MAPPING',
      },
    });
  }

  await prisma.dailyKpiPolicyVersion.upsert({
    where: { tenantId_id: { tenantId, id: stable(73, 1) } },
    update: {},
    create: {
      tenantId,
      id: stable(73, 1),
      scopeType: 'TENANT',
      versionNumber: 1,
      effectiveFromDate: new Date('2026-07-10T00:00:00Z'),
      timezone: 'Asia/Ho_Chi_Minh',
      reportOpenLocal: '18:00:00',
      reportCloseLocal: '20:00:00',
      evaluationLocal: '20:00:01',
      failurePenaltyMinor: 100_000n,
      currency: 'VND',
      kpiScopeJson: { kpiDefinitionIds: kpiDefinitions.map((item) => item.id) },
      membershipScopeJson: { activeEmployees: true },
      exemptionRuleJson: {},
      evidenceEnabled: false,
      evidenceGraceSeconds: 300,
      createdByMembershipId: ownerMembershipId,
      reason: 'MVP_DEFAULT_DAILY_KPI_POLICY',
    },
  });

  const shiftDefinitions = [
    {
      id: stable(80, 1),
      code: 'SHIFT_0830',
      name: 'Ca 1 - 08:30',
      startLocalTime: '08:30',
    },
    {
      id: stable(80, 2),
      code: 'SHIFT_0930',
      name: 'Ca 2 - 09:30',
      startLocalTime: '09:30',
    },
  ];
  for (const shift of shiftDefinitions) {
    await prisma.shiftDefinition.upsert({
      where: { tenantId_id: { tenantId, id: shift.id } },
      update: {
        code: shift.code,
        name: shift.name,
        startLocalTime: shift.startLocalTime,
        status: 'ACTIVE',
        effectiveToDate: null,
      },
      create: {
        tenantId,
        ...shift,
        timezone: 'Asia/Ho_Chi_Minh',
        status: 'ACTIVE',
        effectiveFromDate: new Date('2026-07-10T00:00:00Z'),
        versionNumber: 1,
        createdByMembershipId: ownerMembershipId,
        reason: 'MVP_DEFAULT_SHIFT',
      },
    });
  }

  await prisma.videoPolicyVersion.upsert({
    where: { tenantId_id: { tenantId, id: stable(81, 1) } },
    update: {
      requiresAcknowledgement: true,
      requiresFullBody: true,
      requiresWorkArea: true,
      manualReviewRequired: true,
      missingCheckinPenaltyMinor: 50_000n,
      videoFailedPenaltyMinor: 50_000n,
      currency: 'VND',
    },
    create: {
      tenantId,
      id: stable(81, 1),
      scopeType: 'TENANT',
      branchId: null,
      versionNumber: 1,
      effectiveFromDate: new Date('2026-07-10T00:00:00Z'),
      requiresAcknowledgement: true,
      requiresFullBody: true,
      requiresWorkArea: true,
      manualReviewRequired: true,
      acknowledgementText:
        'Báº¯t buá»™c check-in báº±ng video quay rÃµ cáº£ ngÆ°á»i vÃ  khu vá»±c lÃ m viá»‡c thá»±c táº¿.',
      missingCheckinPenaltyMinor: 50_000n,
      videoFailedPenaltyMinor: 50_000n,
      currency: 'VND',
      createdByMembershipId: ownerMembershipId,
      reason: 'MVP_DEFAULT_VIDEO_POLICY',
    },
  });

  await prisma.attendancePenaltyPolicyVersion.upsert({
    where: { tenantId_id: { tenantId, id: stable(82, 1) } },
    update: {
      lateFixed1To15Minor: 20_000n,
      lateExcessPerMinuteMinor: 2_000n,
      lateExcessAfterMinutes: 15,
      lateMaxThresholdMinutes: 90,
      lateMaxMinor: 200_000n,
      lateNoNoticeMinor: 100_000n,
      suddenLeaveNoNoticeMinor: 50_000n,
      suddenLeaveOverLimitMinor: 100_000n,
      leaveRuleViolationMinor: 200_000n,
      monthlySuddenLeaveFreeDays: 1,
      monthlyAbsenceNotifyThresholdDays: 5,
      currency: 'VND',
    },
    create: {
      tenantId,
      id: stable(82, 1),
      scopeType: 'TENANT',
      branchId: null,
      versionNumber: 1,
      effectiveFromDate: new Date('2026-07-10T00:00:00Z'),
      timezone: 'Asia/Ho_Chi_Minh',
      lateFixed1To15Minor: 20_000n,
      lateExcessPerMinuteMinor: 2_000n,
      lateExcessAfterMinutes: 15,
      lateMaxThresholdMinutes: 90,
      lateMaxMinor: 200_000n,
      lateNoNoticeMinor: 100_000n,
      suddenLeaveNoNoticeMinor: 50_000n,
      suddenLeaveOverLimitMinor: 100_000n,
      leaveRuleViolationMinor: 200_000n,
      monthlySuddenLeaveFreeDays: 1,
      monthlyAbsenceNotifyThresholdDays: 5,
      currency: 'VND',
      createdByMembershipId: ownerMembershipId,
      reason: 'MVP_DEFAULT_ATTENDANCE_PENALTY_POLICY',
    },
  });

  const workflowDefinitions = [
    { id: stable(83, 1), requestType: 'SHIFT_CHANGE' as const },
    { id: stable(83, 2), requestType: 'LATE_NOTICE' as const },
    { id: stable(83, 3), requestType: 'LEAVE_SCHEDULE' as const },
    { id: stable(83, 4), requestType: 'SUDDEN_LEAVE' as const },
  ];
  for (const workflow of workflowDefinitions) {
    await prisma.workflowDefinitionVersion.upsert({
      where: { tenantId_id: { tenantId, id: workflow.id } },
      update: {
        stepsJson: [
          {
            mode: 'SEQUENTIAL',
            approverRule: 'TENANT_OWNER',
            requiredApprovalCount: 1,
          },
        ],
      },
      create: {
        tenantId,
        ...workflow,
        scopeType: 'TENANT',
        branchId: null,
        versionNumber: 1,
        effectiveFromDate: new Date('2026-07-10T00:00:00Z'),
        stepsJson: [
          {
            mode: 'SEQUENTIAL',
            approverRule: 'TENANT_OWNER',
            requiredApprovalCount: 1,
          },
        ],
        parallelRuleJson: {},
        createdByMembershipId: ownerMembershipId,
        reason: 'MVP_DEFAULT_TIMEKEEPING_WORKFLOW',
      },
    });
  }

  const offCalendarVersions = [
    {
      id: stable(84, 1),
      scopeType: 'TENANT' as const,
      branchId: null,
      name: 'Táº¿t dÆ°Æ¡ng lá»‹ch',
      startDate: new Date('2027-01-01T00:00:00Z'),
      endDate: new Date('2027-01-01T00:00:00Z'),
    },
    {
      id: stable(84, 2),
      scopeType: 'BRANCH' as const,
      branchId: branches[0]!.id,
      name: 'Báº£o trÃ¬ cÆ¡ sá»Ÿ',
      startDate: new Date('2026-12-31T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    },
  ];
  for (const calendar of offCalendarVersions) {
    await prisma.companyOffCalendarVersion.upsert({
      where: { tenantId_id: { tenantId, id: calendar.id } },
      update: {
        name: calendar.name,
        startDate: calendar.startDate,
        endDate: calendar.endDate,
        status: 'ACTIVE',
      },
      create: {
        tenantId,
        ...calendar,
        timezone: 'Asia/Ho_Chi_Minh',
        versionNumber: 1,
        status: 'ACTIVE',
        createdByMembershipId: ownerMembershipId,
        reason: 'MVP_DEFAULT_OFF_CALENDAR',
      },
    });
  }

  const bookingCustomerId = stable(90, 1);
  const bookingServiceId = stable(91, 1);
  const bookingServiceVersionId = stable(92, 1);
  const bookingId = stable(93, 1);
  const consentPolicyId = stable(94, 1);
  const retentionPolicyId = stable(95, 1);
  const cancellationReasonId = stable(96, 1);
  const cancellationReasonVersionId = stable(97, 1);

  await prisma.customer.upsert({
    where: { tenantId_id: { tenantId, id: bookingCustomerId } },
    update: { displayName: 'Khách hàng mẫu' },
    create: {
      tenantId,
      id: bookingCustomerId,
      displayName: 'Khách hàng mẫu',
      phoneNormalized: '0900000000',
      createdByMembershipId: ownerMembershipId,
    },
  });
  await prisma.customerBranchAccess.upsert({
    where: {
      tenantId_customerId_branchId: {
        tenantId,
        customerId: bookingCustomerId,
        branchId: branches[0]!.id,
      },
    },
    update: { revokedAt: null },
    create: {
      tenantId,
      customerId: bookingCustomerId,
      branchId: branches[0]!.id,
      grantedByMembershipId: ownerMembershipId,
    },
  });
  await prisma.serviceOffering.upsert({
    where: { tenantId_code: { tenantId, code: 'FACIAL_BASIC' } },
    update: {},
    create: {
      tenantId,
      id: bookingServiceId,
      code: 'FACIAL_BASIC',
      createdByMembershipId: ownerMembershipId,
    },
  });
  await prisma.serviceOfferingVersion.upsert({
    where: { tenantId_id: { tenantId, id: bookingServiceVersionId } },
    update: { name: 'Chăm sóc da cơ bản', status: 'ACTIVE' },
    create: {
      tenantId,
      id: bookingServiceVersionId,
      serviceOfferingId: bookingServiceId,
      versionNumber: 1,
      name: 'Chăm sóc da cơ bản',
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-07-10T00:00:00Z'),
      createdByMembershipId: ownerMembershipId,
    },
  });
  await prisma.serviceBranchAvailability.upsert({
    where: { tenantId_id: { tenantId, id: stable(98, 1) } },
    update: { status: 'ACTIVE', effectiveTo: null },
    create: {
      tenantId,
      id: stable(98, 1),
      serviceOfferingId: bookingServiceId,
      serviceOfferingVersionId: bookingServiceVersionId,
      branchId: branches[0]!.id,
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-07-10T00:00:00Z'),
    },
  });
  await prisma.customerPhotoConsentPolicyVersion.upsert({
    where: { tenantId_id: { tenantId, id: consentPolicyId } },
    update: {},
    create: {
      tenantId,
      id: consentPolicyId,
      versionNumber: 1,
      title: 'Đồng ý lưu ảnh khách hàng',
      policyText: 'Khách hàng đồng ý để cơ sở lưu ảnh phục vụ ghi nhận công tour.',
      allowedMethods: ['VERBAL', 'WRITTEN'],
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-07-10T00:00:00Z'),
      createdByMembershipId: ownerMembershipId,
    },
  });
  await prisma.bookingCancellationReason.upsert({
    where: { tenantId_code: { tenantId, code: 'CUSTOMER_REQUEST' } },
    update: {},
    create: {
      tenantId,
      id: cancellationReasonId,
      code: 'CUSTOMER_REQUEST',
      createdByMembershipId: ownerMembershipId,
    },
  });
  await prisma.bookingCancellationReasonVersion.upsert({
    where: { tenantId_id: { tenantId, id: cancellationReasonVersionId } },
    update: { label: 'Khách yêu cầu hủy' },
    create: {
      tenantId,
      id: cancellationReasonVersionId,
      reasonId: cancellationReasonId,
      versionNumber: 1,
      label: 'Khách yêu cầu hủy',
      appliesToCancellation: true,
      appliesToReschedule: true,
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-07-10T00:00:00Z'),
      createdByMembershipId: ownerMembershipId,
    },
  });
  await prisma.bookingReportDestination.upsert({
    where: { tenantId_id: { tenantId, id: stable(99, 1) } },
    update: { status: 'ACTIVE' },
    create: {
      tenantId,
      id: stable(99, 1),
      branchId: null,
      reportType: 'TOMORROW_SCHEDULE',
      chatChannelId: stable(60, 1),
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-07-10T00:00:00Z'),
      createdByMembershipId: ownerMembershipId,
    },
  });
  await prisma.bookingRetentionPolicyVersion.upsert({
    where: { tenantId_id: { tenantId, id: retentionPolicyId } },
    update: {},
    create: {
      tenantId,
      id: retentionPolicyId,
      versionNumber: 1,
      customerPhotoDays: 180,
      xlsxDays: 30,
      platformBoundsJson: { customerPhotoDaysMax: 3650, xlsxDaysMax: 365 },
      effectiveFrom: new Date('2026-07-10T00:00:00Z'),
      createdByMembershipId: ownerMembershipId,
    },
  });
  await prisma.booking.upsert({
    where: { tenantId_id: { tenantId, id: bookingId } },
    update: {},
    create: {
      tenantId,
      id: bookingId,
      branchId: branches[0]!.id,
      customerId: bookingCustomerId,
      serviceOfferingId: bookingServiceId,
      serviceOfferingVersionId: bookingServiceVersionId,
      serviceCodeSnapshot: 'FACIAL_BASIC',
      serviceNameSnapshot: 'Chăm sóc da cơ bản',
      assignedMembershipId: ownerMembershipId,
      formVersionId: stable(66, 4),
      bookingType: 'SCHEDULED',
      scheduledStartAt: new Date('2026-07-25T02:00:00Z'),
      businessDate: new Date('2026-07-25T00:00:00Z'),
      timezoneSnapshot: 'Asia/Ho_Chi_Minh',
      status: 'SCHEDULED',
      createdByMembershipId: ownerMembershipId,
    },
  });
}

await main().finally(() => prisma.$disconnect());
