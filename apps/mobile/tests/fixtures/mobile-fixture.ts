export const mobileFixture = {
  tenant: { id: 'tenant-demo', name: 'Adsup Demo' },
  membership: {
    id: 'membership-demo',
    displayName: 'Demo Employee',
    status: 'ACTIVE',
    permissions: ['action-item.read', 'attendance.check-in.read'],
  },
  branches: [{ id: 'branch-demo', name: 'Clinic Demo' }],
};
