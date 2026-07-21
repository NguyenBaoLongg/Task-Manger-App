---
name: build-booking-export
description: "Specify, implement, and test tenant-scoped customer booking based on dynamic forms, configurable cancellation reasons, one-hour conflict prevention, arrival-triggered photo debt, and native Excel or PDF report export from PostgreSQL. Use for appointment APIs, booking validation, scheduling conflicts, arrival workflows, tenant reports, XLSX generation, or PDF generation."
---

# Build Booking and Native Export

Read [the booking and export requirements](references/Skill_04_Booking_and_Export.md) before planning or implementation. Require dynamic forms, tenant isolation, media storage, and relevant OKR/KPI or penalty data models first.

## Workflow

1. Inspect the current feature specification and shared schemas.
2. Model bookings, bookable resources, customer references, dynamic-form template/version links, cancellation reasons, status history, photo debt, export requests, and export artifacts.
3. Scope all data by tenant and authorize administrative exports through RBAC.
4. Define the booked resource explicitly. Reject conflicting appointments within the required one-hour window for the same tenant and relevant resource.
5. Enforce conflict prevention transactionally at the database boundary where practical; do not rely only on a preflight API query.
6. On transition to `ARRIVED`, set `is_photo_debt = true` idempotently and connect later evidence uploads to that debt.
7. Build aggregate reporting from tenant-scoped PostgreSQL queries across OKR, KPI, penalties, and bookings.
8. Generate XLSX or PDF through a bounded background or streaming workflow. Store large exports in authorized object storage when direct streaming is unsuitable.
9. Protect against formula injection in spreadsheets and unbounded report queries.
10. Test concurrent booking attempts, boundary times, resource scope, status retries, export authorization, large datasets, and tenant isolation.

## Boundaries

- Resolve whether the one-hour radius means 60 minutes before and after the start, duration overlap plus buffer, or another product rule; encode the decision in the feature spec.
- Never export cross-tenant rows.
- Do not depend on Google Sheets.
- Do not load an unbounded report entirely into application memory.

## Completion

Report conflict semantics, database enforcement, APIs, export formats, authorization, performance limits, tests, and any product decisions still open.
