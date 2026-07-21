# Architecture Requirements Checklist: Nền tảng SaaS đa tenant

**Purpose**: Unit-test the completeness, clarity, consistency and measurability of Module 1 requirements
**Created**: 2026-07-19
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] CHK001 Are global/root entities explicitly separated from tenant-owned entities, with the exception boundary documented? [Completeness, Spec §Key Entities, Plan §Tenant isolation strategy]
- [x] CHK002 Are tenant and branch access expectations stated for every privileged actor and data family? [Completeness, Spec §FR-006–FR-012, CR-001–CR-002]
- [x] CHK003 Are onboarding requirements complete for missing Google name, mandatory name confirmation, multiple tenants and inactive membership? [Coverage, Spec §US1, FR-001–FR-006]
- [x] CHK004 Are invitation creation, expiry, revocation, exhaustion, concurrency and duplicate-membership outcomes all defined? [Completeness, Spec §US1, Edge Cases, FR-005]
- [x] CHK005 Are organization assignment and authorization modeled as separate concepts with effective history requirements? [Completeness, Spec §US2, FR-008–FR-009]
- [x] CHK006 Are dynamic form draft, publication, immutable version and submission-validation requirements documented? [Completeness, Spec §US3, FR-013–FR-015]
- [x] CHK007 Are chat authorization, persistence-before-emit, retry identity and reconnect synchronization requirements present? [Completeness, Spec §US4, FR-016, Contract §realtime]
- [x] CHK008 Are media intent, completion verification, signed access and foreign-source denial requirements present? [Completeness, Spec §US5, FR-018–FR-019]

## Requirement Clarity

- [x] CHK009 Is the authoritative identity key distinguished unambiguously from mutable Google email/name fields? [Clarity, Spec §FR-001–FR-002]
- [x] CHK010 Is “tenant context” defined as derived from authenticated membership instead of request body identifiers? [Clarity, Spec §FR-010, Plan §Request and authorization flow]
- [x] CHK011 Is role scope behavior explicit for tenant versus branch binding, including the rule that assignments grant no permission? [Clarity, Spec §FR-008–FR-011, Data Model §MembershipRoleBinding]
- [x] CHK012 Is the last-owner invariant stated in a form that has an objective accept/reject outcome? [Clarity, Spec §FR-012, Data Model §MembershipRoleBinding]
- [x] CHK013 Is idempotency key reuse with the same versus different payload explicitly distinguished? [Clarity, Spec §FR-022, Data Model §TenantIdempotencyRecord]
- [x] CHK014 Are media type, size, checksum, expiry and lifecycle terms bounded rather than described as merely “secure”? [Clarity, Spec §FR-018, OpenAPI §CreateMediaIntent]
- [x] CHK015 Are error responses defined with stable fields and safe non-disclosure behavior? [Clarity, Spec §FR-024, OpenAPI §Problem]

## Requirement Consistency

- [x] CHK016 Do the spec, data model and OpenAPI consistently use membership ID—not display name or email—as the employee/actor identity? [Consistency, Spec §FR-002, Data Model §TenantMembership, OpenAPI §Membership]
- [x] CHK017 Do tenant isolation rules align across HTTP paths, realtime rooms, object keys, idempotency and audit? [Consistency, Spec §CR-001, Plan §Tenant isolation strategy]
- [x] CHK018 Are form version immutability and submission history consistent between the user story, requirements and data model transitions? [Consistency, Spec §US3/FR-013–FR-015, Data Model §FormVersion]
- [x] CHK019 Are local test doubles consistent with the requirement for production-ready S3/Redis/push boundaries? [Consistency, Spec §CR-006, Plan §Infrastructure adapters, Research §§8–10]
- [x] CHK020 Is the Module 1 exclusion of KPI, attendance, penalty, booking and mobile UI stated consistently in scope and assumptions? [Consistency, Spec §Assumptions, Plan §Scale/Scope]

## Acceptance Criteria Quality

- [x] CHK021 Can every P1/P2 user story be demonstrated independently without requiring a downstream business module? [Measurability, Spec §User Scenarios]
- [x] CHK022 Are tenant-isolation outcomes objectively measurable as denial without data, metadata, URL or room leakage? [Measurability, Spec §SC-002]
- [x] CHK023 Are retry outcomes objectively measurable as exactly one business effect? [Measurability, Spec §SC-003]
- [x] CHK024 Are audit completeness and deterministic seed outcomes quantified? [Measurability, Spec §SC-004–SC-005]
- [x] CHK025 Are capacity and latency targets numeric and explicitly not business hard limits? [Measurability, Spec §CR-005, SC-007]
- [x] CHK026 Is the no-live-cloud-credential quality outcome objectively verifiable? [Measurability, Spec §SC-008]

## Scenario and Edge-Case Coverage

- [x] CHK027 Are concurrent tenant creation, invite acceptance, role/membership edits and form publication scenarios covered? [Coverage, Spec §Edge Cases, FR-023]
- [x] CHK028 Are provider outage, retry and partial completion outcomes documented without making providers authoritative? [Coverage, Spec §Edge Cases, Plan §Infrastructure adapters]
- [x] CHK029 Are secret-redaction cases for logs/audit explicitly documented for tokens, invite secrets and signed URLs? [Coverage, Spec §Edge Cases, CR-004]
- [x] CHK030 Are session rotation, refresh replay, suspension and reconnect authorization lifecycles defined? [Coverage, Research §5, Contract §realtime]
- [x] CHK031 Are invalid JSON schema/payload and version-boundary submissions addressed atomically? [Coverage, Spec §US3, Edge Cases]
- [x] CHK032 Are invalid/expired/sized/checksum-mismatched media and repeated completion scenarios included? [Coverage, Spec §Edge Cases, Data Model §MediaObject]

## Non-Functional and Governance Requirements

- [x] CHK033 Are observability signals and secret-safe health/error requirements documented for API, datastore, worker, realtime and adapters? [Completeness, Spec §FR-024–FR-025]
- [x] CHK034 Are retention, legal-hold and backup/restore boundaries referenced without inventing a production SLA in this module? [Scope, PRD §11.2, Research §Resolved Unknowns]
- [x] CHK035 Are migration, seed rerun, contract, tenant-isolation, load, typecheck, lint and build gates all mapped? [Completeness, Spec §CR-006, Plan §Requirement-to-Verification]
- [x] CHK036 Does the plan re-check every constitutional MUST after design with no unjustified exception? [Governance, Plan §Post-Design Constitution Re-check]

## Notes

- Focus: tenant security/isolation and historical/operational correctness.
- Depth: formal reviewer gate for implementation readiness.
- Audience/timing: reviewer before task generation and implementation.
- Validation result: 36/36 requirements-quality checks pass; no ambiguity or gap item remains.
