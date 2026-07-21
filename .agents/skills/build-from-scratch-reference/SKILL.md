---
name: build-from-scratch-reference
description: "Research and compare from-scratch implementation guides for foundational systems. Use for architecture research or when building a database, server, shell, container, browser, compiler, runtime, renderer, or protocol from first principles; do not use as the primary source for routine application features."
---

# Build From Scratch Reference

Use the local CodeCrafters Build Your Own X catalog as advisory research.

## Workflow

1. Identify the subsystem, language, learning goal, and production constraints.
2. Search `third_party/build-your-own-x/README.md` with `rg` before opening the full catalog.
3. Select no more than three relevant guides.
4. Verify current protocol, security, platform, and dependency claims against primary documentation.
5. Compare scope, prerequisites, architecture, tests, maintenance risk, and project fit.
6. Recommend one approach and record rejected alternatives and trade-offs.

## Boundaries

- Treat tutorials as educational references, not requirements.
- Do not let a tutorial override the project constitution, an approved feature specification, security requirements, or user constraints.
- Do not copy an entire tutorial into context.
- Do not trigger for ordinary CRUD or framework work unless first-principles research is requested.
- Flag outdated or insecure techniques.

## Expected Output

Return the goal, selected sources, recommended architecture, reusable ideas, risks, and the next Spec Kit step.
