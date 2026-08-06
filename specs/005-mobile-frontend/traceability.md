# Mobile Traceability

| Requirement | Artifact/test owner |
|---|---|
| FR-001 auth/workspace | T027-T037, `auth-workspace` contract/integration/a11y |
| FR-006 employee filters | `action-item-feed.ts`, T039 |
| FR-006 manager filters | `action-item-feed.ts`, T039 |
| FR-010 video check-in | T049-T064 |
| FR-020 booking/ARRIVED | T065-T080 |
| FR-030 chat/notifications | T081-T095 |
| SC-001 95% under 60s | T118, `auth-workspace-performance.e2e.ts`, denominator 20 per device profile |
| SC-003 95% under 3s | T119, `dashboard-performance.e2e.ts`, denominator 20 per data/device profile |
| SC-009 recovery >=95% | T120, `recovery-rate.integration.test.ts`, denominator 20 injected scenarios minimum |
| Native actions | T121-T122, `native-action-handler.ts`, shared resolver T046 |

The shared resolver is the only owner of tenant, branch, permission, freshness and mutation
validation for action-item, push and native-action intents. Native adapters only normalize platform
identifiers and call that resolver.
