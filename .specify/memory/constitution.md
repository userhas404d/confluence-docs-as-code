<!--
  Sync Impact Report
  ========================================
  Version change: N/A → 1.0.0 (initial ratification)
  Modified principles: N/A (all new)
  Added sections:
    - Core Principles (5 principles)
    - Technology & Architecture Constraints
    - Development Workflow
    - Governance
  Removed sections: N/A
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ compatible (no constitution-specific refs)
    - .specify/templates/spec-template.md ✅ compatible (no constitution-specific refs)
    - .specify/templates/tasks-template.md ✅ compatible (no constitution-specific refs)
    - .specify/templates/checklist-template.md ✅ compatible (no constitution-specific refs)
    - .specify/templates/agent-file-template.md ✅ compatible (no constitution-specific refs)
  Follow-up TODOs: None
-->

# Confluence Docs-as-Code Constitution

## Core Principles

### I. Test-First Development (NON-NEGOTIABLE)

All new features and bug fixes MUST follow the Red-Green-Refactor cycle:

- Tests MUST be written before implementation code
- Tests MUST fail before implementation begins (Red)
- Implementation MUST make failing tests pass with minimal code (Green)
- Code MUST then be refactored while keeping tests green (Refactor)
- Code coverage MUST remain above 95% at all times (currently 98.47%)
- The test suite uses Mocha with c8 for coverage; all tests MUST pass
  before a change is considered complete

**Rationale**: This project is a GitHub Action consumed by external teams.
Regressions in sync behavior can silently corrupt or delete Confluence
pages. High test coverage and TDD discipline are the primary safeguard.

### II. Modular Plugin Architecture

The codebase MUST maintain a clear separation between core sync logic,
plugins, renderers, models, and SDKs:

- **Models** (`lib/models/`): Data representations (page, attachment,
  graph, image, meta, local-page, remote-page) MUST be pure data
  structures with no side effects
- **Plugins** (`lib/plugins/`): Markdown-it plugins (fence, image, link)
  MUST be independently composable and testable
- **Renderers** (`lib/renderers/`): Asset, graph, and page renderers MUST
  accept explicit inputs and produce deterministic outputs
- **SDKs** (`lib/confluence-sdk.js`, `lib/kroki-sdk.js`,
  `lib/plantuml-sdk.js`): External service integrations MUST be isolated
  behind clear interfaces and MUST NOT leak HTTP details to callers
- New functionality MUST be placed in the correct architectural layer;
  cross-layer imports MUST flow downward (index → syncer → renderers →
  plugins → models → SDKs)

**Rationale**: The plugin and renderer architecture enables independent
testing of each processing stage and makes it safe to add new diagram
types or output formats without modifying core sync logic.

### III. Idempotent & Safe Sync

The sync process MUST be idempotent and safe by default:

- Publishing MUST only update pages whose content has changed, unless
  `confluence_force_update` is explicitly set to `yes`
- The cleanup operation (`confluence_cleanup`) MUST only remove pages that
  were previously published by this action
- Page ordering and hierarchy MUST be preserved across re-runs
- Failed syncs MUST NOT leave Confluence in a partially updated state;
  errors MUST be surfaced clearly with page titles and error details
- All HTTP calls to Confluence MUST use the retry policy (`lib/retry-policy.js`)

**Rationale**: Users trust this action to manage their documentation
automatically. Silent data loss or partial updates erode that trust and
are difficult to diagnose.

### IV. Backward Compatibility & Deprecation

Breaking changes to action inputs or sync behavior MUST follow a
deprecation path:

- Deprecated inputs MUST continue to function for at least one major
  version cycle with a logged deprecation warning
- New inputs MUST NOT change the default behavior of existing inputs
- The `action.yaml` input schema is the public API contract; changes
  MUST be treated with the same rigor as a library's public interface
- Semantic versioning (MAJOR.MINOR.PATCH) MUST be followed for releases;
  breaking changes MUST increment the MAJOR version

**Rationale**: External repositories pin this action by version tag.
Unexpected behavior changes from a minor or patch bump break CI pipelines
across multiple teams with no warning.

### V. Simplicity & YAGNI

Code MUST remain simple, focused, and free of speculative abstraction:

- Features MUST NOT be added until there is a concrete, documented need
- Configuration options MUST be minimal; prefer sensible defaults over
  extensive configurability
- Dependencies MUST be kept to a minimum; every production dependency
  MUST justify its inclusion
- Code MUST prefer explicit logic over clever abstractions; readability
  is prioritized over brevity

**Rationale**: This project is a focused tool with a clear purpose.
Over-engineering increases maintenance burden and makes it harder for
contributors to understand and extend the codebase.

## Technology & Architecture Constraints

- **Runtime**: Node.js >= 20 (ES modules, `"type": "module"`)
- **Package Manager**: npm (with Volta for Node version pinning)
- **Testing**: Mocha + c8 (coverage) + Chai (assertions) + Sinon (mocks)
  + esmock (ESM mocking) + nock (HTTP mocking)
- **Linting**: ESLint with flat config (`eslint.config.js`); enforces
  4-space indentation, single quotes, semicolons, Unix line endings
- **Pre-commit**: Husky + lint-staged (auto-fix ESLint on staged files)
- **Build**: `@vercel/ncc` compiles to a single `dist/index.js` for the
  GitHub Action runtime
- **Documentation**: JSDoc with clean-jsdoc-theme for API docs
- **External Services**: Confluence REST API, Kroki.io, PlantUML.com
- **No TypeScript**: The project uses plain JavaScript with JSDoc type
  annotations; do NOT introduce TypeScript without a constitution
  amendment

## Development Workflow

1. **Branch**: Create a feature branch from `main`
2. **Write Tests**: Add or update tests in `test/` following the existing
   mirror structure (`test/lib/<module>.test.js`)
3. **Implement**: Write the minimal code to make tests pass
4. **Lint**: Run `npm run posttest` (ESLint) to verify code style
5. **Coverage**: Run `npm test` and verify coverage stays above 95%
6. **Build**: Run `npm run build` to compile the action bundle
7. **Commit**: Use conventional commit format
   (`type(scope): description`)
8. **Review**: All changes MUST be reviewed before merging to `main`

Quality gates that MUST pass before merge:

- All tests pass (`npm test`)
- ESLint reports no errors
- Code coverage >= 95%
- Action builds successfully (`npm run build`)

## Governance

This constitution is the authoritative source of development standards
for the confluence-docs-as-code project. It supersedes any conflicting
guidance found in other documents.

- All pull requests and code reviews MUST verify compliance with these
  principles
- Amendments to this constitution MUST be documented with a version bump,
  rationale, and migration plan (if applicable)
- Complexity beyond what these principles prescribe MUST be justified in
  the relevant spec or plan document
- Runtime development guidance is maintained in the agent-file-template
  and generated per-feature as needed

**Version**: 1.0.0 | **Ratified**: 2026-02-27 | **Last Amended**: 2026-02-27
