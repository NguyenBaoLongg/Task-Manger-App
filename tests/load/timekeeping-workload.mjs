import { performance } from 'node:perf_hooks';
import { setImmediate as yieldBatch } from 'node:timers/promises';

const percentile = (values, percentileValue) => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return Number((sorted[index] ?? 0).toFixed(3));
};

export async function runTimekeepingLoadProfile(profile) {
  const apiBatchSize = 100;
  const workerBatchSize = 200;
  const tenantCount = 20;
  const schedules = new Map();
  const attendanceEvents = new Map();
  const conversionQueue = [];
  const convertedAssets = new Set();
  const settlements = new Map();
  const actionItems = new Map();
  const apiDurations = [];
  const workerBatchDurations = [];
  const readDurations = [];

  for (let index = 0; index < profile.videoCheckInsPerDay; index += 1) {
    const tenantId = `tenant-${index % tenantCount}`;
    const membershipId = `member-${index}`;
    const key = `${tenantId}:${membershipId}:2026-07-24`;
    schedules.set(key, {
      tenantId,
      membershipId,
      branchId: `branch-${index % 40}`,
      scheduleVersionId: `schedule-${index}`,
      videoPolicyVersionId: `video-policy-${index % tenantCount}`,
    });
    settlements.set(key, { tenantId, membershipId, totalAmountMinor: index % 2 ? 0 : 50_000 });
    actionItems.set(key, { tenantId, membershipId, state: index % 3 ? 'OPEN' : 'COMPLETED' });
  }

  const requests = Array.from({ length: profile.videoCheckInsPerDay }, (_, index) => {
    const tenantId = `tenant-${index % tenantCount}`;
    return {
      tenantId,
      membershipId: `member-${index}`,
      businessDate: '2026-07-24',
      mediaObjectId: `media-${index}`,
      checksum: `sha256-${index}`,
    };
  });

  for (let offset = 0; offset < requests.length; offset += apiBatchSize) {
    const batch = requests.slice(offset, offset + apiBatchSize);
    for (const request of batch) {
      const startedAt = performance.now();
      const key = `${request.tenantId}:${request.membershipId}:${request.businessDate}`;
      const schedule = schedules.get(key);
      if (!schedule || schedule.tenantId !== request.tenantId) {
        throw new Error(`Tenant-scoped schedule missing for ${key}`);
      }
      if (!attendanceEvents.has(key)) {
        attendanceEvents.set(key, {
          tenantId: request.tenantId,
          membershipId: request.membershipId,
          branchId: schedule.branchId,
          businessDate: request.businessDate,
          scheduleVersionId: schedule.scheduleVersionId,
          videoPolicyVersionId: schedule.videoPolicyVersionId,
          mediaObjectId: request.mediaObjectId,
          originalChecksum: request.checksum,
        });
        conversionQueue.push({
          key,
          tenantId: request.tenantId,
          mediaObjectId: request.mediaObjectId,
        });
      }
      apiDurations.push(performance.now() - startedAt);
    }
    await yieldBatch();
  }

  while (conversionQueue.length > 0) {
    const startedAt = performance.now();
    const batch = conversionQueue.splice(0, workerBatchSize);
    for (const asset of batch) {
      const event = attendanceEvents.get(asset.key);
      if (!event || event.tenantId !== asset.tenantId) {
        throw new Error(`Tenant-scoped conversion claim failed for ${asset.key}`);
      }
      convertedAssets.add(`${asset.tenantId}:${asset.mediaObjectId}`);
    }
    workerBatchDurations.push(performance.now() - startedAt);
    await yieldBatch();
  }

  for (const request of requests) {
    const key = `${request.tenantId}:${request.membershipId}:${request.businessDate}`;
    for (const surface of profile.readSurfaces) {
      const startedAt = performance.now();
      const value =
        surface === 'attendance-schedules'
          ? schedules.get(key)
          : surface === 'attendance-penalty-settlements'
            ? settlements.get(key)
            : actionItems.get(key);
      if (!value || value.tenantId !== request.tenantId) {
        throw new Error(`Tenant-scoped ${surface} read failed for ${key}`);
      }
      readDurations.push(performance.now() - startedAt);
    }
  }

  return {
    acceptedCheckIns: attendanceEvents.size,
    convertedVideos: convertedAssets.size,
    apiBatches: Math.ceil(requests.length / apiBatchSize),
    workerBatches: workerBatchDurations.length,
    apiP95Ms: percentile(apiDurations, 95),
    workerBatchP95Ms: percentile(workerBatchDurations, 95),
    readSamples: readDurations.length,
    readP95Ms: percentile(readDurations, 95),
  };
}
