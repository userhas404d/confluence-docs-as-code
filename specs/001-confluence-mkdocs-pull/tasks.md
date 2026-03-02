# Tasks: Confluence → MkDocs Material One-Time Pull

**Input**: Design documents from `/specs/001-confluence-mkdocs-pull/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — Constitution mandates Test-First Development (Red-Green-Refactor) with ≥ 95% coverage.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Source**: `lib/pull/` (new pull direction module)
- **Tests**: `test/lib/pull/` (mirror structure)
- **Fixtures**: `test/fixtures/adf/` (ADF sample JSON)
- **SDK extends**: `lib/confluence-sdk.js` and `test/lib/confluence-sdk.test.js`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure, configuration, and shared utilities

- [X] T001 Create directory structure: `lib/pull/`, `lib/pull/adf-nodes/`, `test/lib/pull/`, `test/lib/pull/adf-nodes/`, `test/fixtures/adf/` per plan.md project structure
- [X] T058 [P] Write tests for PullConfig parsing and validation in test/lib/pull/pull-config.test.js — cover required params (confluenceUrl, confluenceUser, confluenceToken, rootPageId), optional outputDir with default, CLI flags vs env var precedence, missing required param error per data-model.md PullConfig entity
- [X] T002 [P] Implement PullConfig parsing with CLI flags (parseArgs) and env var fallback in lib/pull/pull-config.js — validate confluenceUrl, confluenceUser, confluenceToken, rootPageId (required) and outputDir (optional, default ./output) per research.md R8
- [X] T011 [P] Write tests for slug utility in test/lib/pull/slug.test.js — cover spaces, special chars, emoji, consecutive hyphens, leading/trailing hyphens, duplicate slug collision with numeric suffix per research.md R7 examples
- [X] T003 [P] Implement slug utility (lowercase, spaces→hyphens, strip special chars, collapse hyphens, duplicate suffix handling) in lib/pull/slug.js per research.md R7

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: SDK extensions and ADF conversion engine that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Add `getPageBody(pageId)` method to lib/confluence-sdk.js — calls `GET /wiki/api/v2/pages/{id}?body-format=atlas_doc_format`, returns page object with parsed ADF body per contracts/get-page-body.json
- [X] T005 [P] Add `getPageChildren(pageId)` method to lib/confluence-sdk.js — calls `GET /wiki/api/v2/pages/{id}/direct-children?sort=child-position`, paginates via `_links.next`, filters `type === 'page'`, returns ordered array per contracts/get-page-children.json
- [X] T006 Write tests for `getPageBody()` and `getPageChildren()` methods using nock HTTP mocking in test/lib/confluence-sdk.test.js — cover success, pagination, 401/404 errors, non-page type filtering, and 429 rate-limit retry behavior
- [X] T007 [P] Create ADF converter engine with visitor-pattern dispatch in lib/pull/adf-converter.js — accept ADF JSON doc + ConversionContext, iterate `content[]`, dispatch to registered node handlers, return Markdown string per data-model.md ConversionContext entity
- [X] T008 [P] Create ADF node handler registry in lib/pull/adf-nodes/index.js — export `handlers` Map keyed by ADF node type name, provide `registerHandler(type, fn)` and `convertNode(node, context)` functions
- [X] T009 Write tests for ADF converter engine dispatch and unknown-node handling in test/lib/pull/adf-converter.test.js — include edge cases: empty page (title-only h1 output), ADF conversion failure (fallback to raw JSON as code block)
- [X] T010 [P] Create full-page ADF fixture with mixed node types in test/fixtures/adf/full-page.json — include paragraph, heading, list, code block, and text with marks for integration testing

**Checkpoint**: Foundation ready — SDK can fetch pages and children, ADF engine can dispatch to handlers. User story implementation can now begin.

---

## Phase 3: User Story 1 — Pull Page Tree & Generate Markdown Files (Priority: P1) 🎯 MVP

**Goal**: Run the tool against a Confluence root page ID and receive a complete docs/ directory with 20 Markdown files in the correct hierarchy, plus a generated mkdocs.yml nav structure.

**Independent Test**: Run the tool against Teleport root page (ID `2134835234`). Verify 20 Markdown files are created in correct directory hierarchy. Verify mkdocs.yml nav matches tree structure.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T012 [P] [US1] Write tests for tree-walker in test/lib/pull/tree-walker.test.js — cover recursive DFS traversal, 3-level nesting, PageTreeNode construction, slug assignment, outputPath computation, root→index.md mapping, non-page filtering, empty children per data-model.md PageTreeNode entity
- [X] T013 [P] [US1] Write tests for mkdocs-generator in test/lib/pull/mkdocs-generator.test.js — cover NavTree→YAML generation, 3-level hierarchy, root as Home→index.md, section parents as subdirectory index.md, leaf pages as direct files, Material theme config per research.md R10
- [X] T014 [P] [US1] Write tests for paragraph handler in test/lib/pull/adf-nodes/paragraph.test.js — cover paragraph, heading (levels 1-6), blockquote, hardBreak, text node, rule (horizontal rule)
- [X] T015 [P] [US1] Write tests for list handler in test/lib/pull/adf-nodes/list.test.js — cover bulletList, orderedList, listItem, nested lists with correct indentation, mixed list types
- [X] T016 [P] [US1] Write tests for marks handler in test/lib/pull/adf-nodes/marks.test.js — cover strong, em, code, link, strike marks, multiple simultaneous marks on text, link with title

### Implementation for User Story 1

- [X] T017 [US1] Implement tree-walker with recursive DFS in lib/pull/tree-walker.js — use SDK `getPageChildren()` to discover children, build PageTreeNode tree, compute slugs and outputPaths, handle root→index.md, section parents→subdirectory/index.md per data-model.md
- [X] T018 [P] [US1] Implement paragraph handler (paragraph, heading, blockquote, hardBreak, text, rule) in lib/pull/adf-nodes/paragraph.js — headings use `#` based on attrs.level, blockquote prefixes `> `, hardBreak outputs `<br>`, rule outputs `---`
- [X] T019 [P] [US1] Implement list handler (bulletList, orderedList, listItem) in lib/pull/adf-nodes/list.js — bulletList uses `- `, orderedList uses `1. `, nested lists increase indentation by 4 spaces, track depth via ConversionContext
- [X] T020 [P] [US1] Implement marks handler (strong, em, code, link, strike) in lib/pull/adf-nodes/marks.js — strong→`**text**`, em→`*text*`, code→`` `text` ``, link→`[text](href)`, strike→`~~text~~`
- [X] T021 [US1] Register US1 handlers (paragraph, heading, blockquote, hardBreak, text, rule, bulletList, orderedList, listItem) in lib/pull/adf-nodes/index.js
- [X] T022 [US1] Implement mkdocs-generator in lib/pull/mkdocs-generator.js — convert PageTreeNode tree to NavTree, generate mkdocs.yml with Material theme, admonition/details/superfences extensions, and nav section per research.md R10
- [X] T023 [US1] Implement CLI entry point and orchestration in lib/pull/index.js — parse config, initialize SDK, walk tree, fetch page bodies, convert ADF→Markdown via converter, write files to outputDir/docs/, generate mkdocs.yml, output summary

**Checkpoint**: User Story 1 complete — `node lib/pull/index.js` pulls 20 pages and generates Markdown files with basic formatting + mkdocs.yml. Content is readable even without rich formatting.

---

## Phase 4: User Story 2 — Convert Rich ADF Content to MkDocs Material Markdown (Priority: P1)

**Goal**: Confluence-specific formatting (admonitions, code blocks, tables, expand macros) accurately converted to MkDocs Material Markdown syntax.

**Independent Test**: Select 5 pages covering panels, code blocks, tables, expand macros, inline code. Compare tool's output against rendered Confluence page for formatting fidelity.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T024 [P] [US2] Write tests for code-block handler in test/lib/pull/adf-nodes/code-block.test.js — cover fenced code block with language attr, without language, empty code block, multiline content; create fixture test/fixtures/adf/code-block.json
- [X] T025 [P] [US2] Write tests for panel handler in test/lib/pull/adf-nodes/panel.test.js — cover all panelType→admonition mappings (info→info, note→note, warning→warning, error→danger, success→success, unknown→note), panel with title, nested content; create fixtures test/fixtures/adf/panel-note.json and test/fixtures/adf/panel-warning.json
- [X] T026 [P] [US2] Write tests for expand handler in test/lib/pull/adf-nodes/expand.test.js — cover expand→`???` collapsible, expand wrapping panel→`???+ type`, expand with title, nested content indentation; create fixtures test/fixtures/adf/expand.json and test/fixtures/adf/expand-panel.json
- [X] T027 [P] [US2] Write tests for table handler in test/lib/pull/adf-nodes/table.test.js — cover table with headers and data rows, header separator row, empty cells, cells with inline marks, multiline cell content; create fixture test/fixtures/adf/table.json

### Implementation for User Story 2

- [X] T028 [P] [US2] Implement code-block handler in lib/pull/adf-nodes/code-block.js — output fenced code block with ` ```language ` from attrs.language, default to no language; 4-space indent when inside admonition context
- [X] T029 [P] [US2] Implement panel handler in lib/pull/adf-nodes/panel.js — map panelType to admonition keyword per research.md R5 mapping table, output `!!! type "title"` with 4-space indented content
- [X] T030 [P] [US2] Implement expand handler in lib/pull/adf-nodes/expand.js — output `??? note "title"` for plain expand, `???+ type "title"` when wrapping a panel (detect first child is panel), 4-space indented content
- [X] T031 [P] [US2] Implement table handler (table, tableRow, tableHeader, tableCell) in lib/pull/adf-nodes/table.js — output pipe table with `| cell | cell |` rows, `|---|---|` header separator after first row, handle header cells vs data cells
- [X] T032 [US2] Register US2 handlers (codeBlock, panel, expand, table, tableRow, tableHeader, tableCell) in lib/pull/adf-nodes/index.js

**Checkpoint**: User Stories 1 AND 2 complete — all rich formatting (code blocks, admonitions, collapsible sections, tables) renders correctly in MkDocs Material.

---

## Phase 5: User Story 3 — Download and Embed Attachments (Priority: P2)

**Goal**: Images and file attachments referenced in Confluence pages are automatically downloaded and linked in Markdown output.

**Independent Test**: Run tool against 9 pages containing images. Verify image files downloaded to output images/ directory, Markdown references use correct relative paths.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T035 [US3] Write tests for `getAttachments()` and `downloadAttachment()` in test/lib/confluence-sdk.test.js — cover pagination, image-type filtering, download success, 404 fallback with placeholder
- [X] T036 [P] [US3] Write tests for attachment-downloader in test/lib/pull/attachment-downloader.test.js — cover image download, page-slug filename prefixing, media type filtering (only image/*), download failure with warning log and placeholder comment, duplicate filename handling per data-model.md AttachmentInfo entity
- [X] T037 [P] [US3] Write tests for media handler in test/lib/pull/adf-nodes/media.test.js — cover mediaSingle→image embed, media node with fileId resolution via attachmentMap, alt text preservation, missing attachment placeholder; create fixture test/fixtures/adf/media.json

### Implementation for User Story 3

- [X] T033 [P] [US3] Add `getAttachments(pageId)` method to lib/confluence-sdk.js — calls `GET /wiki/api/v2/pages/{id}/attachments`, paginates via `_links.next`, returns array of AttachmentInfo per contracts/get-attachments.json
- [X] T034 [P] [US3] Add `downloadAttachment(downloadUrl, destPath)` method to lib/confluence-sdk.js — authenticated GET with `responseType: 'stream'`, pipe to `createWriteStream(destPath)` per contracts/download-attachment.json
- [X] T038 [US3] Implement attachment-downloader in lib/pull/attachment-downloader.js — list attachments via SDK, filter to image media types, download to images/ dir with `{pageSlug}-{filename}` naming, build attachmentMap (fileId→localPath), handle download failures gracefully with warnings
- [X] T039 [US3] Implement media handler (mediaSingle, media, mediaGroup) in lib/pull/adf-nodes/media.js — resolve fileId via ConversionContext.attachmentMap, output `![alt](images/{filename})`, handle missing attachments as `<!-- Missing attachment: filename -->`
- [X] T040 [US3] Register media handler and integrate attachment downloads into CLI orchestration in lib/pull/index.js — download attachments per page before ADF conversion, populate ConversionContext.attachmentMap

**Checkpoint**: User Stories 1, 2, AND 3 complete — all images download and render correctly in MkDocs output.

---

## Phase 6: User Story 4 — Resolve Internal Links Between Pages (Priority: P2)

**Goal**: Confluence internal page links (smart links, inline cards) resolved to relative Markdown file paths for working cross-references.

**Independent Test**: Identify pages with inlineCard smart links to other pages in the tree. Verify output Markdown uses relative .md paths that resolve correctly within output directory.

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T041 [P] [US4] Write tests for link-resolver in test/lib/pull/link-resolver.test.js — cover Confluence URL parsing (extract page ID from `/wiki/spaces/{key}/pages/{id}/{title}` patterns), pageSlugMap lookup, relative path computation across different directory depths, external URL passthrough, short-link fallback per research.md R6
- [X] T042 [P] [US4] Write tests for inline-card handler in test/lib/pull/adf-nodes/inline-card.test.js — cover inlineCard with internal page link→relative .md path, inlineCard with external URL→absolute link, embedCard→standard link; create fixture test/fixtures/adf/inline-card.json

### Implementation for User Story 4

- [X] T043 [US4] Implement link-resolver in lib/pull/link-resolver.js — build pageSlugMap (Map<pageId, relativeMdPath>) from PageTreeNode tree, extract page IDs from Confluence URLs using regex patterns, compute relative paths between files accounting for directory nesting per research.md R6
- [X] T044 [US4] Implement inline-card handler (inlineCard, embedCard) in lib/pull/adf-nodes/inline-card.js — resolve URL via link-resolver, output `[title](relative-path.md)` for internal or `[title](url)` for external links
- [X] T045 [US4] Register inline-card handler, integrate link-resolver into CLI orchestration in lib/pull/index.js — build pageSlugMap after tree walk, pass to ConversionContext, also update marks.js link handler to resolve Confluence URLs

**Checkpoint**: User Stories 1–4 complete — all internal cross-references resolve to working relative links.

---

## Phase 7: User Story 5 — Handle Decorative & Non-Portable Content Gracefully (Priority: P3)

**Goal**: Confluence-specific decorative features (TOC macros, children macros, text color, layout columns, annotations) handled gracefully — stripped or converted to best-effort equivalents.

**Independent Test**: Run tool against pages with TOC macros, children macros, layout columns, colored text, annotations. Verify output is clean, readable, and free of raw ADF artifacts.

### Tests for User Story 5

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T046 [P] [US5] Write tests for layout handler in test/lib/pull/adf-nodes/layout.test.js — cover layoutSection/layoutColumn→flattened sequential blocks, HTML comment noting original column count; create fixture test/fixtures/adf/layout.json
- [X] T047 [P] [US5] Write tests for emoji handler in test/lib/pull/adf-nodes/emoji.test.js — cover emoji node→Unicode text from `attrs.text`, fallback to `:shortName:` if no text attr
- [X] T048 [P] [US5] Write tests for mention handler in test/lib/pull/adf-nodes/mention.test.js — cover mention node→`@Display Name` plain text from `attrs.text`

### Implementation for User Story 5

- [X] T049 [P] [US5] Implement layout handler (layoutSection, layoutColumn) in lib/pull/adf-nodes/layout.js — flatten content into sequential blocks, prepend `<!-- Original layout had N columns -->` HTML comment
- [X] T050 [P] [US5] Implement emoji handler in lib/pull/adf-nodes/emoji.js — output Unicode character from `attrs.text`, fallback to `:shortName:` if text not available
- [X] T051 [P] [US5] Implement mention handler in lib/pull/adf-nodes/mention.js — output `@Display Name` from `attrs.text`
- [X] T052 [US5] Add extension/macro skip logic to lib/pull/adf-converter.js — silently skip `extension/toc` and `extension/children` macro nodes, log debug message for skipped macros
- [X] T053 [US5] Add non-portable mark stripping to lib/pull/adf-nodes/marks.js — strip textColor, alignment, breakout, indentation, annotation/inlineComment marks without leaving artifacts

**Note**: P3 ADF node types (`status`, `date`, `mediaInline`, `nestedExpand`, `underline`, `subsup`) are intentionally deferred — not present in the target Teleport documentation. Unknown node types are handled by the converter's default pass-through/warning behavior (T009).

**Checkpoint**: All 5 user stories complete — output is clean, correctly formatted MkDocs Material Markdown with no Confluence-specific artifacts.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T054 [P] Add structured progress logging and summary report (pages processed, attachments downloaded, warnings) to lib/pull/index.js per quickstart.md expected output format
- [X] T055 [P] Add JSDoc type annotations and module documentation to all lib/pull/ files per plan.md constitution (No TypeScript — use JSDoc)
- [X] T056 Run quickstart.md end-to-end validation — execute full pull against Teleport tree, verify 20 files + mkdocs.yml + images, run `mkdocs serve` to confirm zero build errors, measure wall-clock time (must complete in < 5 minutes per SC-007)
- [X] T057 Code cleanup, lint pass (eslint), and ensure ≥ 95% test coverage across all lib/pull/ modules via `npm run test:coverage`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) — delivers MVP
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) — can run in parallel with US1
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) — can run in parallel with US1/US2
- **User Story 4 (Phase 6)**: Depends on US1 (needs tree-walker for pageSlugMap)
- **User Story 5 (Phase 7)**: Depends on Foundational (Phase 2) — can run in parallel with US1-US4
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependencies on other stories. **This is the MVP.**
- **User Story 2 (P1)**: After Foundational — independent of US1, but extends the same handler registry
- **User Story 3 (P2)**: After Foundational — needs SDK extensions (getAttachments, downloadAttachment) added in this phase
- **User Story 4 (P2)**: After US1 — needs tree-walker output (pageSlugMap) for link resolution
- **User Story 5 (P3)**: After Foundational — independent of all other stories

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Test-First / Red-Green-Refactor)
- Handler tests before handler implementation
- Handlers before registry registration
- All handlers registered before integration with CLI orchestration
- Story complete and tested before moving to next priority

### Parallel Opportunities

- **Phase 1**: T058 and T011 can run in parallel (test tasks); T002 and T003 can run in parallel (implementation, after their tests)
- **Phase 2**: T004, T005, T007, T008, T010 can all run in parallel (different files)
- **Phase 3**: All test tasks (T012–T016) can run in parallel; all handler implementations (T018–T020) can run in parallel
- **Phase 4**: All test tasks (T024–T027) can run in parallel; all handler implementations (T028–T031) can run in parallel
- **Phase 5**: Test tasks (T035, T036, T037) in parallel; SDK methods (T033, T034) in parallel after tests
- **Phase 6**: Test tasks (T041, T042) in parallel
- **Phase 7**: All test tasks (T046–T048) in parallel; all handler implementations (T049–T051) in parallel
- **Cross-phase**: US2, US3, US5 can run in parallel with US1 after Foundational completes (if team capacity allows)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (Red phase):
Task T012: "Write tests for tree-walker in test/lib/pull/tree-walker.test.js"
Task T013: "Write tests for mkdocs-generator in test/lib/pull/mkdocs-generator.test.js"
Task T014: "Write tests for paragraph handler in test/lib/pull/adf-nodes/paragraph.test.js"
Task T015: "Write tests for list handler in test/lib/pull/adf-nodes/list.test.js"
Task T016: "Write tests for marks handler in test/lib/pull/adf-nodes/marks.test.js"

# Then launch all handler implementations in parallel (Green phase):
Task T018: "Implement paragraph handler in lib/pull/adf-nodes/paragraph.js"
Task T019: "Implement list handler in lib/pull/adf-nodes/list.js"
Task T020: "Implement marks handler in lib/pull/adf-nodes/marks.js"
```

---

## Parallel Example: User Story 2

```bash
# Launch all US2 tests in parallel (Red phase):
Task T024: "Write tests for code-block handler"
Task T025: "Write tests for panel handler"
Task T026: "Write tests for expand handler"
Task T027: "Write tests for table handler"

# Then launch all US2 handler implementations in parallel (Green phase):
Task T028: "Implement code-block handler"
Task T029: "Implement panel handler"
Task T030: "Implement expand handler"
Task T031: "Implement table handler"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run `node lib/pull/index.js` against Teleport root page — verify 20 .md files + mkdocs.yml
5. Deploy/demo if ready — basic Markdown output is usable

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → **MVP!** (basic tree pull + Markdown)
3. Add User Story 2 → Test independently → Rich formatting (admonitions, code blocks, tables)
4. Add User Story 3 → Test independently → Images download and render
5. Add User Story 4 → Test independently → Internal links resolve correctly
6. Add User Story 5 → Test independently → Clean output, no artifacts
7. Polish → Production quality with logging, docs, coverage
8. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (tree walking, basic handlers, CLI)
   - Developer B: User Story 2 (rich ADF handlers)
   - Developer C: User Story 3 (attachments) + User Story 5 (decorative)
3. After US1 complete: Developer D can start User Story 4 (link resolution)
4. Stories integrate via the shared handler registry

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (Red-Green-Refactor per Constitution I)
- Commit after each phase checkpoint (per speckit-phase-commits workflow)
- No new npm dependencies — custom ADF converter, built-in parseArgs (Constitution V)
- Coverage target: ≥ 95% across all lib/pull/ modules
- Existing codebase files are NOT modified except lib/confluence-sdk.js (additive methods only)
- P3 ADF node types (status, date, mediaInline, nestedExpand, underline, subsup) are intentionally out of scope — not present in target content
