# Implementation Plan: Confluence → MkDocs Material One-Time Pull

**Branch**: `001-confluence-mkdocs-pull` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-confluence-mkdocs-pull/spec.md`

## Summary

Build a one-time CLI tool that pulls a Confluence page tree (starting from a root page ID), fetches each page's ADF body via the Confluence v2 REST API, converts ADF to MkDocs Material-compatible Markdown, downloads image attachments, resolves internal cross-links, and outputs a complete `docs/` directory with a generated `mkdocs.yml` nav structure. Targets the 20-page Teleport documentation tree (3 levels deep).

## Technical Context

**Language/Version**: Node.js >= 20 (ES modules, `"type": "module"`)
**Primary Dependencies**: axios (HTTP client), axios-retry (retry policy), yaml (YAML generation), form-data — all already present in `package.json`
**Storage**: Local filesystem output (`output/docs/` directory with Markdown files and `images/` subdirectory)
**Testing**: Mocha + c8 (coverage) + Chai (assertions) + Sinon (mocks) + esmock (ESM mocking) + nock (HTTP mocking) — all already present
**Target Platform**: macOS/Linux CLI (one-time local execution, not a GitHub Action)
**Project Type**: Single project — new `lib/pull/` module added alongside existing `lib/` structure
**Performance Goals**: Complete 20-page pull in < 5 minutes (dominated by API latency, not computation)
**Constraints**: Must not modify existing sync direction code; must reuse existing SDK patterns (axios instance, retry policy, auth)
**Scale/Scope**: 20 pages, ~30 attachments, 3 levels of nesting — fixed target, no growth expected

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle                           | Status     | Notes                                                                                                                                                                              |
| ----------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Test-First Development**       | PASS       | All new modules (ADF converter, tree walker, SDK extensions) will follow Red-Green-Refactor. Coverage must stay ≥ 95%.                                                             |
| **II. Modular Plugin Architecture** | PASS       | New code follows the same layered architecture: SDK → models → converters → CLI entry point. Import flow is downward. ADF node handlers are independent and composable.            |
| **III. Idempotent & Safe Sync**     | PASS (N/A) | This is a read-only pull tool (no writes to Confluence). Idempotency is achieved by overwriting local output on re-run. All HTTP calls use the existing retry policy.              |
| **IV. Backward Compatibility**      | PASS       | No changes to existing `action.yaml` inputs or sync behavior. New code is an additive entry point (`lib/pull/index.js`).                                                           |
| **V. Simplicity & YAGNI**           | PASS       | Custom ADF converter (no new dependency) handles only the 20 node types inventoried in the target pages. No speculative generalization. Minimal configuration (4 required params). |
| **No TypeScript**                   | PASS       | Plain JavaScript with JSDoc type annotations.                                                                                                                                      |

**Gate result: ALL PASS** — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-confluence-mkdocs-pull/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (Confluence API contract schemas)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
lib/
├── pull/                        # NEW — pull direction module
│   ├── index.js                 # CLI entry point (parseArgs, orchestration)
│   ├── pull-config.js           # Simplified config (env vars, no @actions/core)
│   ├── tree-walker.js           # Recursive page tree discovery
│   ├── adf-converter.js         # ADF → Markdown conversion engine
│   ├── adf-nodes/               # Individual ADF node type handlers
│   │   ├── index.js             # Registry of all node handlers
│   │   ├── paragraph.js         # paragraph, heading, blockquote, hardBreak
│   │   ├── list.js              # bulletList, orderedList, listItem
│   │   ├── code-block.js        # codeBlock → fenced code blocks
│   │   ├── panel.js             # panel → MkDocs admonitions
│   │   ├── expand.js            # expand → collapsible admonitions
│   │   ├── table.js             # table, tableRow, tableHeader, tableCell
│   │   ├── media.js             # mediaSingle, media → image download + embed
│   │   ├── inline-card.js       # inlineCard, embedCard → links
│   │   ├── layout.js            # layoutSection, layoutColumn → flatten
│   │   ├── emoji.js             # emoji → Unicode text
│   │   ├── mention.js           # mention → @DisplayName
│   │   └── marks.js             # strong, em, code, link, textColor, etc.
│   ├── attachment-downloader.js # Download attachments from Confluence
│   ├── link-resolver.js         # Resolve page IDs → relative .md paths
│   ├── slug.js                  # Page title → filename slug
│   └── mkdocs-generator.js     # Generate mkdocs.yml from tree
├── confluence-sdk.js            # EXTEND — add getPageBody(), getPageChildren(), getAttachments(), downloadAttachment()
└── [existing files unchanged]

test/
├── lib/
│   ├── pull/                    # NEW — test mirror structure
│   │   ├── tree-walker.test.js
│   │   ├── adf-converter.test.js
│   │   ├── adf-nodes/
│   │   │   ├── paragraph.test.js
│   │   │   ├── code-block.test.js
│   │   │   ├── panel.test.js
│   │   │   ├── expand.test.js
│   │   │   ├── table.test.js
│   │   │   ├── media.test.js
│   │   │   ├── inline-card.test.js
│   │   │   ├── layout.test.js
│   │   │   ├── emoji.test.js
│   │   │   ├── mention.test.js
│   │   │   ├── marks.test.js
│   │   │   └── list.test.js
│   │   ├── attachment-downloader.test.js
│   │   ├── link-resolver.test.js
│   │   ├── slug.test.js
│   │   └── mkdocs-generator.test.js
│   └── confluence-sdk.test.js   # EXTEND — tests for new SDK methods
├── fixtures/
│   └── adf/                     # NEW — ADF sample fixtures per node type
│       ├── code-block.json
│       ├── panel-note.json
│       ├── panel-warning.json
│       ├── expand.json
│       ├── expand-panel.json
│       ├── table.json
│       ├── media.json
│       ├── inline-card.json
│       ├── layout.json
│       └── full-page.json
└── [existing test files unchanged]
```

**Structure Decision**: Single project layout, extending the existing `lib/` and `test/` directories with a new `pull/` subdirectory. This keeps the pull direction code isolated from the existing push direction while sharing the SDK and utility layers. No new top-level directories needed.

## Constitution Re-Check (Post Phase 1 Design)

*Re-evaluated after completing research.md, data-model.md, contracts/, and quickstart.md.*

| Principle                           | Status     | Post-Design Notes                                                                                                                                                                              |
| ----------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Test-First Development**       | PASS       | data-model.md defines 6 testable entities with validation rules. Contracts provide API response fixtures for nock mocking. Test structure mirrors source in plan.                              |
| **II. Modular Plugin Architecture** | PASS       | Import flow confirmed: `index.js → tree-walker → adf-converter → adf-nodes/* → SDK`. Pure data structures (PullConfig, PageTreeNode, etc). ADF handlers independently composable and testable. |
| **III. Idempotent & Safe Sync**     | PASS (N/A) | Pull is read-only. Re-running overwrites local output. All HTTP calls use retry-policy.js. Error handling: fail fast on auth, continue on per-page failures.                                   |
| **IV. Backward Compatibility**      | PASS       | Zero changes to action.yaml or existing sync. New SDK methods are additive. lib/pull/ is fully isolated from push direction.                                                                   |
| **V. Simplicity & YAGNI**           | PASS       | No new npm dependencies (parseArgs built-in, custom ADF converter). 4 required config params. Only ~20 ADF node types handled — scoped to target content.                                      |
| **No TypeScript**                   | PASS       | All JavaScript with JSDoc type annotations.                                                                                                                                                    |

**Gate result: ALL PASS** — design is constitution-compliant. Ready for `/speckit.tasks`.

## Complexity Tracking

> No constitution violations to justify — all gates pass at both pre-research and post-design checkpoints.
