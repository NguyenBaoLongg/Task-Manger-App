# Mobile Frontend Direction

## Product feel

Adsup Mobile is a work tool for repeated daily use. The visual direction is calm, legible and
operational: a cool neutral canvas, deep navy text, ADSUP blue as the primary action color and
cyan as a restrained brand accent. Green is reserved for successful business states, never used
as the product's dominant identity. Screens prioritize the next useful action over decorative
panels.

The supplied logo at `assets/brand/adsup-logo-source.png` is the brand source of truth. Product
surfaces MUST use the real logo where a brand mark is shown and MUST NOT replace it with a
letter placeholder or recolor the interface to a non-brand dominant hue.

## Navigation

- Dashboard: KPI snapshot, action center, deadlines and badges.
- Workspace: attendance, leave/approval, penalty, booking and forms.
- Chat: tenant-scoped channels, unread state and notification entry points.

## Component inventory

- `ScreenFrame`: safe-area, title and loading/error boundaries.
- `ActionItemRow`: state, deadline, source and accessible deep-link action.
- `MetricTile`: server-provided value, freshness and empty state.
- `ScopeSelector`: membership-derived tenant/branch scope only.
- `AsyncState`: loading, empty, forbidden, conflict, offline and retry states.
- `PrimaryButton` and `IconButton`: minimum 44pt touch targets with visible pressed state.

## Accessibility baseline

All interactive controls expose a semantic label and state. Text remains readable at large dynamic
type sizes, focus order follows the visual order, and color is never the only indication of state.
The layout supports small phones, large phones and tablet portrait/landscape without horizontal
scrolling on primary workflows.
