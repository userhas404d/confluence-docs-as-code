# Feature Specification: Confluence → MkDocs Material One-Time Pull

**Feature Branch**: `001-confluence-mkdocs-pull`  
**Created**: 2026-02-27  
**Status**: Draft  
**Input**: User description: "Build a one-time reverse-direction tool that pulls a Confluence page tree and converts it to MkDocs Material-compatible Markdown files with downloaded attachments. Target: Teleport page tree (20 pages, 3 levels of hierarchy)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Pull Page Tree & Generate Markdown Files (Priority: P1)

As a documentation engineer, I want to pull an entire Confluence page tree and receive MkDocs Material-compatible Markdown files so that I can migrate documentation from Confluence to a git-based MkDocs site without manually copying and reformatting each page.

**Why this priority**: This is the core value proposition — without the ability to walk the tree and produce Markdown output, no other feature matters. A user should be able to point the tool at a Confluence root page and receive a complete, browsable docs folder.

**Independent Test**: Run the tool against the Teleport root page (ID `2134835234`). Verify that 20 Markdown files are created in the correct directory hierarchy, each containing the page's text content (even if formatting is basic at this stage). Verify a `mkdocs.yml` file is generated with nav entries matching the page tree structure.

**Acceptance Scenarios**:

1. **Given** a Confluence root page ID and valid credentials, **When** the tool is run, **Then** it recursively discovers all descendant pages (across 3 levels) and outputs one Markdown file per page.
2. **Given** the Teleport page tree, **When** the tool completes, **Then** the output directory contains exactly 20 `.md` files with filenames derived from page titles (lowercase, hyphens, no special characters).
3. **Given** the Teleport page tree, **When** the tool completes, **Then** a `mkdocs.yml` file is generated with a `nav` section reflecting the parent-child hierarchy of the original Confluence tree.
4. **Given** pages at different nesting depths, **When** the tool outputs files, **Then** child pages are placed in subdirectories matching their parent page's slug (e.g., `teleport-and-aws/aws-proxy-deprecation.md`).
5. **Given** the root page of the tree, **When** the tool outputs files, **Then** the root page content is written to `index.md` in the docs root directory.

---

### User Story 2 — Convert Rich ADF Content to MkDocs Material Markdown (Priority: P1)

As a documentation engineer, I want Confluence-specific formatting (admonitions, code blocks, tables, inline code, links) accurately converted to MkDocs Material Markdown syntax so that the migrated docs look correct and leverage MkDocs Material features like admonitions and collapsible sections.

**Why this priority**: Without faithful content conversion, the output files would contain raw or broken formatting, requiring extensive manual cleanup — defeating the purpose of automation.

**Independent Test**: Select 5 pages covering the main content types (panels, code blocks, tables, expand macros, inline code). Compare the tool's Markdown output against the rendered Confluence page to verify formatting fidelity.

**Acceptance Scenarios**:

1. **Given** a page containing `codeBlock` nodes with language attributes, **When** converted, **Then** fenced code blocks are produced with the correct language identifier (e.g., ` ```shell `).
2. **Given** a page containing `panel` nodes (note, warning, info, success), **When** converted, **Then** MkDocs Material admonition blocks are produced (e.g., `!!! warning "Title"`).
3. **Given** a page containing `expand` nodes, **When** converted, **Then** MkDocs Material collapsible admonitions are produced (e.g., `??? "Title"`).
4. **Given** a page containing `expand` wrapping a `panel`, **When** converted, **Then** a typed collapsible admonition is produced (e.g., `???+ warning "Title"`).
5. **Given** a page containing `table`, `tableRow`, `tableHeader`, and `tableCell` nodes, **When** converted, **Then** properly formatted Markdown pipe tables are produced with header separators.
6. **Given** a page containing standard inline marks (bold, italic, inline code, links), **When** converted, **Then** standard Markdown equivalents are produced (`**bold**`, `*italic*`, `` `code` ``, `[text](url)`).
7. **Given** a page containing headings at various levels, **When** converted, **Then** Markdown headings (`#` through `######`) are produced preserving the original hierarchy.
8. **Given** a page containing bullet and ordered lists, **When** converted, **Then** correctly indented Markdown lists are produced.

---

### User Story 3 — Download and Embed Attachments (Priority: P2)

As a documentation engineer, I want images and file attachments referenced in Confluence pages to be automatically downloaded and linked in the Markdown output so that the migrated docs include all visual content without manual file transfers.

**Why this priority**: Images convey critical information (architecture diagrams, screenshots, UI guides). Without them, the documentation is incomplete. However, text content (P1) is still usable without images.

**Independent Test**: Run the tool against pages known to contain images (9 of the 20 pages). Verify that image files are downloaded to the output `images/` directory and that the Markdown files reference them with correct relative paths.

**Acceptance Scenarios**:

1. **Given** a page containing `mediaSingle`/`media` image nodes, **When** the tool runs, **Then** the referenced attachment files are downloaded to an `images/` directory within the docs output folder.
2. **Given** a downloaded image, **When** the Markdown is generated, **Then** the image is referenced with the pattern `![alt text](images/{pageSlug}-{filename})` using the page slug prefix to avoid filename collisions across pages.
3. **Given** an image with alt text in the ADF, **When** converted, **Then** the alt text is preserved in the Markdown image syntax.
4. **Given** an image whose download fails (e.g., deleted attachment), **When** the tool encounters the failure, **Then** it logs a warning and inserts a placeholder comment in the Markdown (e.g., `<!-- Missing attachment: filename.png -->`).

---

### User Story 4 — Resolve Internal Links Between Pages (Priority: P2)

As a documentation engineer, I want Confluence internal page links (smart links, inline cards) to be resolved to relative Markdown file paths so that cross-references between pages work correctly in the MkDocs site.

**Why this priority**: Broken internal links degrade navigation and trust in the docs. However, the content is still readable without working cross-links, so this is secondary to content conversion.

**Independent Test**: Identify pages with `inlineCard` smart links pointing to other pages in the tree. Verify that the output Markdown uses relative `.md` paths that resolve correctly within the output directory structure.

**Acceptance Scenarios**:

1. **Given** an `inlineCard` node linking to another page within the Teleport tree, **When** converted, **Then** a relative Markdown link is produced (e.g., `[Getting Started Guide](getting-started-guide.md)`).
2. **Given** an `inlineCard` node linking to a page outside the Teleport tree (external Confluence page or JIRA issue), **When** converted, **Then** the original URL is preserved as an external link.
3. **Given** an `embedCard` node referencing another Confluence page, **When** converted, **Then** it is converted to a standard Markdown link (not an embed, since Markdown has no embed equivalent).
4. **Given** internal links between pages at different tree depths, **When** converted, **Then** relative paths account for directory nesting (e.g., `../teleport-and-aws/aws-proxy-deprecation.md` from a sibling section).

---

### User Story 5 — Handle Decorative & Non-Portable Content Gracefully (Priority: P3)

As a documentation engineer, I want Confluence-specific decorative features (TOC macros, children macros, text color, layout columns, annotations) handled gracefully — either stripped or converted to best-effort equivalents — so that the output is clean and free of broken artifacts.

**Why this priority**: These features are cosmetic or handled natively by MkDocs Material. Mis-handling them produces visual noise but does not affect the documentation's informational value.

**Independent Test**: Run the tool against pages known to contain TOC macros, children macros, layout columns, colored text, and annotations. Verify that the output is clean, readable, and free of raw ADF artifacts.

**Acceptance Scenarios**:

1. **Given** a page containing `extension/toc` macro nodes, **When** converted, **Then** the macro is silently omitted (MkDocs Material generates TOC automatically).
2. **Given** a page containing `extension/children` macro nodes, **When** converted, **Then** the macro is silently omitted (mkdocs.yml nav defines child page structure).
3. **Given** a page containing `layoutSection`/`layoutColumn` nodes, **When** converted, **Then** the content is flattened into sequential blocks with an HTML comment noting the original layout (e.g., `<!-- Original layout had 2 columns -->`).
4. **Given** a page containing `annotation`/`inlineComment` marks, **When** converted, **Then** the annotations are stripped (editor comments are not published content).
5. **Given** a page containing `emoji` nodes, **When** converted, **Then** the Unicode character from the `text` attribute is preserved (e.g., ✅, ❌).
6. **Given** a page containing `mention` (@user) nodes, **When** converted, **Then** it is converted to plain text `@Display Name`.
7. **Given** a page containing `textColor` marks, **When** converted, **Then** by default the color is stripped; optionally, it can be preserved as inline HTML `<span>` elements via a configuration flag.
8. **Given** marks for `alignment`, `breakout`, or `indentation`, **When** converted, **Then** they are stripped without leaving artifacts.

---

### Edge Cases

- What happens when a page has no body content (empty page)? → An empty Markdown file with only the page title as h1 is created.
- What happens when two sibling pages produce the same filename slug? → The tool appends a numeric suffix (e.g., `page-2.md`) and logs a warning.
- What happens when the Confluence API returns a rate limit error? → The tool retries with exponential backoff (leveraging the existing retry policy).
- What happens when a page title contains special characters (slashes, colons, emoji)? → Special characters are stripped from the filename; the original title is preserved as the h1 heading in the file.
- What happens when a table cell contains complex nested content (lists, code blocks)? → The nested content is rendered inline with best-effort Markdown (noting that pipe tables have limited nested content support).
- What happens when an image attachment is referenced but the attachment API returns 404? → The tool logs a warning and inserts a placeholder comment.
- What happens when the page tree exceeds the expected 20 pages (e.g., new pages added)? → The tool processes all discovered pages without a hard limit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a Confluence root page ID and recursively discover all descendant pages across unlimited nesting depth.
- **FR-002**: System MUST fetch the ADF (Atlassian Document Format) body of each discovered page via the Confluence v2 REST API.
- **FR-003**: System MUST convert ADF content to MkDocs Material-compatible Markdown, supporting all node types listed in the ADF Feature Inventory (paragraphs, headings, lists, code blocks, panels, expand, tables, images, links, inline marks).
- **FR-004**: System MUST map Confluence `panel` types to MkDocs Material admonition types: note→note, warning→warning, info→info, success→success, error→danger, tip→tip, unknown→note (default fallback).
- **FR-005**: System MUST convert `expand` nodes to MkDocs Material collapsible admonitions (`???`), including typed collapsibles when wrapping a `panel` (`???+ type`).
- **FR-006**: System MUST convert `codeBlock` nodes to fenced code blocks, preserving the language attribute when present.
- **FR-007**: System MUST download page attachments referenced by `media` nodes and save them to an `images/` directory with page-slug-prefixed filenames.
- **FR-008**: System MUST resolve `inlineCard` links pointing to pages within the tree to relative `.md` file paths.
- **FR-009**: System MUST preserve external URLs (JIRA links, external sites) as absolute links.
- **FR-010**: System MUST convert `table`/`tableRow`/`tableHeader`/`tableCell` nodes to Markdown pipe tables.
- **FR-011**: System MUST generate a `mkdocs.yml` file with a `nav` section matching the Confluence page tree hierarchy.
- **FR-012**: System MUST derive filenames from page titles using the convention: lowercase, spaces to hyphens, special characters stripped.
- **FR-013**: System MUST silently skip `extension/toc` and `extension/children` macro nodes.
- **FR-014**: System MUST flatten `layoutSection`/`layoutColumn` nodes into sequential content blocks.
- **FR-015**: System MUST strip non-portable marks (alignment, breakout, annotations/inline comments).
- **FR-016**: System MUST convert emoji nodes to their Unicode text equivalent.
- **FR-017**: System MUST convert mention nodes to plain text `@Display Name`.
- **FR-018**: System MUST accept configuration for Confluence base URL, credentials (API token), and root page ID.
- **FR-019**: System MUST produce meaningful log output during execution indicating progress (page discovery count, conversion progress, download status, warnings).
- **FR-020**: System MUST handle API rate limiting using the existing retry policy with exponential backoff.
- **FR-021**: System MUST handle duplicate filename slugs by appending a numeric suffix and logging a warning.

### Key Entities

- **Page Tree Node**: Represents a discovered Confluence page with its ID, title, parent-child relationships, nesting depth, and ADF body content.
- **Attachment**: Represents a downloadable file attached to a Confluence page, with metadata (filename, media type, download URL) and local output path.
- **Conversion Context**: Maintains the mapping of page IDs to output file paths, enabling internal link resolution during conversion.
- **Output Document**: Represents a generated Markdown file with its content, relative path within the output directory, and associated downloaded attachments.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 20 pages in the Teleport tree are successfully pulled and converted to Markdown files with no manual intervention required.
- **SC-002**: The generated `mkdocs.yml` nav structure matches the 3-level hierarchy of the original Confluence page tree.
- **SC-003**: Running `mkdocs serve` on the output directory renders all 20 pages without build errors.
- **SC-004**: At least 95% of content elements (headings, paragraphs, lists, code blocks, tables, admonitions) render correctly in MkDocs Material without manual fixup.
- **SC-005**: All image attachments across the 9 pages containing images are downloaded and render correctly in the MkDocs site.
- **SC-006**: Internal cross-references between pages resolve to working links within the MkDocs site.
- **SC-007**: The tool completes the full pull-and-convert cycle for 20 pages in under 5 minutes (excluding network latency outliers).
- **SC-008**: No Confluence-specific artifacts (raw ADF, broken macros, orphaned markup) appear in the final Markdown output.

## Assumptions

- The target Confluence instance is Confluence Cloud (not Data Center/Server) and supports the v2 REST API with ADF body format.
- Authentication uses an API token (email + token pair), consistent with the existing `confluence-sdk.js` authentication mechanism.
- The tool is designed for one-time use; it does not need to track changes or support incremental sync.
- The 20-page Teleport tree is representative of the content types that need to be converted; no additional ADF node types beyond those inventoried are expected.
- MkDocs Material is used as the documentation theme, so admonition syntax, collapsible blocks, and other Material-specific Markdown extensions are valid output targets.
- The existing codebase (Node.js >=20, ES modules) is the implementation platform — the tool will be added as a new entry point within the same repository.
- Image filenames in Confluence are unique enough that page-slug prefixing is sufficient to avoid collisions (no hash-based naming is needed).
- The `textColor` mark is stripped by default; preserving it as HTML spans is a secondary configuration option, not a primary requirement.
