# Research: Confluence → MkDocs Material One-Time Pull

**Date**: 2025-02-27 | **Phase**: 0 — Outline & Research
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## R1: Confluence v2 REST API — Page Retrieval with ADF Body

### Decision

Use `GET /wiki/api/v2/pages/{id}?body-format=atlas_doc_format` to retrieve page metadata and ADF body in a single request.

### Rationale

- The v2 API natively supports `atlas_doc_format` as a body format, returning structured ADF JSON — no HTML parsing needed.
- The existing codebase uses v1 API (`/wiki/rest/api/content`) which returns `storage` format (Confluence XML). ADF is a cleaner, well-documented format for conversion.
- Single request per page: the `body-format` query parameter returns the body inline, avoiding a second call.
- Auth is identical to v1: `Authorization: Basic base64(email:apiToken)` — existing SDK auth pattern applies directly.

### Alternatives Considered

| Alternative                                            | Reason Rejected                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| v1 API with `storage` body format                      | Returns Confluence XML/HTML, requires complex HTML→Markdown parsing with lossy edge cases        |
| v1 API with `atlas_doc_format` expand                  | v1 requires `expand=body.atlas_doc_format` which is less reliable and officially deprecated path |
| Export API (`/wiki/spaces/{key}/export`)               | Only exports entire spaces as PDF/HTML, not structured content                                   |
| Third-party ADF libraries (e.g. `@atlaskit/adf-utils`) | Massive dependency tree (React ecosystem), violates Constitution V (Simplicity/YAGNI)            |

### API Contract

```
GET /wiki/api/v2/pages/{id}?body-format=atlas_doc_format

Headers:
  Authorization: Basic {base64(email:apiToken)}
  Accept: application/json

Response 200:
{
  "id": "2134835234",
  "status": "current",
  "title": "Page Title",
  "spaceId": "12345",
  "parentId": "67890",
  "parentType": "page",
  "position": 0,
  "version": { "number": 5, "message": "", "minorEdit": false, "createdAt": "..." },
  "body": {
    "atlas_doc_format": {
      "value": "{\"version\":1,\"type\":\"doc\",\"content\":[...]}",  // JSON string
      "representation": "atlas_doc_format"
    }
  },
  "_links": {
    "base": "https://leolabs.atlassian.net/wiki"
  }
}
```

**Key detail**: `body.atlas_doc_format.value` is a **JSON string** that must be `JSON.parse()`'d to get the ADF document object.

---

## R2: Confluence v2 REST API — Child Page Discovery (Tree Walking)

### Decision

Use `GET /wiki/api/v2/pages/{id}/direct-children` with pagination to discover child pages, filtering by `type === 'page'`. Walk tree recursively starting from root page ID.

### Rationale

- The `direct-children` endpoint returns all child content types (pages, databases, whiteboards, folders, embeds) with a `childPosition` field for ordering.
- Filtering to `type === 'page'` ensures we only process page content.
- `childPosition` provides explicit ordering — use this to maintain nav order in mkdocs.yml.
- Uses the same pagination pattern as the existing v1 SDK (`_links.next`), making it familiar and consistent.
- The older `GET /pages/{id}/children` endpoint is **DEPRECATED** — avoid it.

### Alternatives Considered

| Alternative                                             | Reason Rejected                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `GET /wiki/api/v2/pages/{id}/children` (v2, deprecated) | Marked DEPRECATED in API docs; will be removed in future                     |
| `GET /wiki/rest/api/content/{id}/child/page` (v1)       | v1 endpoint, doesn't return `childPosition` for explicit ordering            |
| `GET /wiki/api/v2/pages?parent-id={id}` (search)        | Less efficient; no `childPosition`; search-based rather than hierarchy-based |
| Ancestors API (bottom-up)                               | Wrong direction — we need top-down tree traversal                            |

### API Contract

```
GET /wiki/api/v2/pages/{id}/direct-children?limit=25&sort=child-position

Headers:
  Authorization: Basic {base64(email:apiToken)}
  Accept: application/json

Response 200:
{
  "results": [
    {
      "id": "111222333",
      "status": "current",
      "title": "Child Page Title",
      "type": "page",
      "spaceId": "12345",
      "childPosition": 0
    },
    {
      "id": "444555666",
      "status": "current",
      "title": "Another Child",
      "type": "whiteboard",     // ← skip non-page types
      "spaceId": "12345",
      "childPosition": 1
    }
  ],
  "_links": {
    "next": "/wiki/api/v2/pages/{id}/direct-children?cursor=abc123",
    "base": "https://leolabs.atlassian.net/wiki"
  }
}
```

**Pagination**: If `_links.next` exists, follow it with full URL (`base + next`). Continue until `_links.next` is absent. Same pattern as `getChildPages()` in existing `confluence-sdk.js`.

**Recursion strategy**: BFS or DFS — DFS preferred for simplicity (recursive async function), matching the existing `processLevel()` pattern in `confluence-syncer.js`.

---

## R3: Confluence v2 REST API — Attachment Listing & Download

### Decision

Use `GET /wiki/api/v2/pages/{id}/attachments` to list attachments per page, then download each via the `downloadLink` field using an authenticated GET request with `responseType: 'stream'`.

### Rationale

- v2 attachment endpoint returns all metadata needed: `title` (filename), `mediaType`, `fileSize`, `downloadLink`.
- Download URL from `downloadLink` field is relative to `_links.base` — construct full URL as `base + downloadLink`.
- Reuse the `createWriteStream` + `pipe` pattern from `base-sdk.js` `toPng()` method for binary downloads.
- Filter to image media types (`image/png`, `image/jpeg`, `image/gif`, `image/svg+xml`, `image/webp`) since spec only requires image attachments.

### Alternatives Considered

| Alternative                                            | Reason Rejected                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| v1 attachment API (`/rest/api/content/{id}/child/att`) | v1 endpoint, inconsistent response format, no `downloadLink` field       |
| Download via `_links.download` on attachment object    | Same as `downloadLink` — both available; `downloadLink` is more explicit |
| Batch download all attachments then map to pages       | More complex; per-page download is simpler and sufficient for 20 pages   |
| Use `fileId` to construct download URL                 | Undocumented URL pattern; `downloadLink` is the official mechanism       |

### API Contract

```
GET /wiki/api/v2/pages/{id}/attachments?limit=25

Headers:
  Authorization: Basic {base64(email:apiToken)}
  Accept: application/json

Response 200:
{
  "results": [
    {
      "id": "att123456",
      "status": "current",
      "title": "screenshot.png",
      "mediaType": "image/png",
      "mediaTypeDescription": "PNG Image",
      "fileSize": 45678,
      "fileId": "abc-def-ghi",
      "downloadLink": "/wiki/rest/api/content/att123456/download",
      "pageId": "2134835234",
      "version": { "number": 1 },
      "_links": {
        "download": "/rest/api/content/att123456/download"
      }
    }
  ],
  "_links": {
    "next": "/wiki/api/v2/pages/{id}/attachments?cursor=xyz",
    "base": "https://leolabs.atlassian.net/wiki"
  }
}
```

**Download**:
```
GET {_links.base}{downloadLink}

Headers:
  Authorization: Basic {base64(email:apiToken)}

Response: Binary stream (image/png, etc.)
```

---

## R4: ADF Document Format — Node Types & Conversion Strategy

### Decision

Build a custom ADF → Markdown converter using a visitor pattern with per-node-type handlers. Handle the ~20 node types expected in Confluence Teleport documentation. No third-party ADF library.

### Rationale

- The ADF spec is well-documented with a finite set of node types (14 block + 8 inline + 11 marks).
- The Teleport docs likely use a subset: paragraph, heading, codeBlock, bulletList, orderedList, table, mediaSingle, panel, expand, inlineCard, plus basic marks.
- A custom converter lets us target MkDocs Material-specific syntax (admonitions for panels, collapsible details for expand, etc.).
- No npm dependency needed — aligns with Constitution V (Simplicity/YAGNI).
- Handler-per-node pattern mirrors the existing plugin architecture (fence.js, image.js, link.js).

### ADF Node Types (Complete Inventory)

#### Top-Level Block Nodes

| ADF Node      | Markdown Output                              | Priority |
| ------------- | -------------------------------------------- | -------- |
| `doc`         | Root container — iterate `content`           | P1       |
| `paragraph`   | Text + `\n\n`                                | P1       |
| `heading`     | `#` .. `######` based on `attrs.level`       | P1       |
| `bulletList`  | `- ` prefixed list items                     | P1       |
| `orderedList` | `1. ` prefixed list items                    | P1       |
| `codeBlock`   | ` ``` ` fenced block with `attrs.language`   | P1       |
| `blockquote`  | `> ` prefixed lines                          | P1       |
| `table`       | Pipe table with header separator             | P1       |
| `mediaSingle` | `![alt](images/filename.ext)` image embed    | P1       |
| `mediaGroup`  | Multiple `![alt](...)` on separate lines     | P2       |
| `panel`       | `!!! note/warning/info/tip/error` admonition | P1       |
| `expand`      | `??? note "title"` collapsible admonition    | P1       |
| `rule`        | `---` horizontal rule                        | P2       |

#### Child Block Nodes

| ADF Node       | Markdown Output                    | Priority |
| -------------- | ---------------------------------- | -------- |
| `listItem`     | Child of bullet/ordered lists      | P1       |
| `media`        | Image reference inside mediaSingle | P1       |
| `nestedExpand` | Collapsible inside table/panel     | P3       |
| `tableRow`     | Pipe row `                         | cell     | cell | ` | P1 |
| `tableHeader`  | Header cell in first row           | P1       |
| `tableCell`    | Data cell                          | P1       |

#### Inline Nodes

| ADF Node      | Markdown Output                  | Priority |
| ------------- | -------------------------------- | -------- |
| `text`        | Plain text (with marks)          | P1       |
| `hardBreak`   | `<br>` or `\n`                   | P1       |
| `emoji`       | Unicode character from shortName | P2       |
| `inlineCard`  | `[title](url)` link              | P1       |
| `mention`     | `@Display Name` plain text       | P2       |
| `status`      | Bold colored text                | P3       |
| `date`        | Formatted date string            | P3       |
| `mediaInline` | Inline image                     | P3       |

#### Marks (Text Formatting)

| Mark        | Markdown Output                  | Priority |
| ----------- | -------------------------------- | -------- |
| `strong`    | `**text**`                       | P1       |
| `em`        | `*text*`                         | P1       |
| `code`      | `` `text` ``                     | P1       |
| `link`      | `[text](url)`                    | P1       |
| `strike`    | `~~text~~`                       | P1       |
| `underline` | `<u>text</u>` (HTML in MD)       | P3       |
| `textColor` | Drop silently (no MD equivalent) | P3       |
| `subsup`    | `<sub>`/`<sup>` (HTML in MD)     | P3       |

### Conversion Architecture

```text
ADF JSON
  ↓ JSON.parse()
doc node → iterate content[]
  ↓ dispatch by node.type
  ├── paragraph → ParagraphHandler.convert(node, context)
  ├── heading → HeadingHandler.convert(node, context)
  ├── codeBlock → CodeBlockHandler.convert(node, context)
  ├── table → TableHandler.convert(node, context)
  ├── ... etc
  ↓ each handler
  │   ├── process attrs
  │   ├── recurse into content[] (call converter for children)
  │   └── apply marks to text nodes
  ↓
Markdown string
```

**Context object** passed through recursion carries:
- `pageId` — for media resolution
- `attachmentMap` — Map<fileId, localPath> for image references
- `pageSlugMap` — Map<pageId, relativePath> for cross-page links
- `depth` — for nested list indentation tracking
- `listType` — 'bullet' | 'ordered' for list context

---

## R5: Panel → MkDocs Admonition Mapping

### Decision

Map Confluence panel types to MkDocs Material admonition types using `!!!` syntax.

### Rationale

- MkDocs Material has built-in support for admonitions via the `admonition` and `details` extensions.
- Confluence panels have a `panelType` attribute that maps cleanly to admonition types.
- This provides the highest-fidelity conversion for structured callouts.

### Mapping Table

| Confluence `panelType` | MkDocs Admonition | Keyword       |
| ---------------------- | ----------------- | ------------- |
| `info`                 | Info              | `!!! info`    |
| `note`                 | Note              | `!!! note`    |
| `warning`              | Warning           | `!!! warning` |
| `error`                | Danger            | `!!! danger`  |
| `success`              | Success           | `!!! success` |
| `tip` (custom)         | Tip               | `!!! tip`     |
| (unknown)              | Note (default)    | `!!! note`    |

### Expand → Collapsible Admonition

```markdown
??? note "Expandable Section Title"
    Content inside the expandable section.
    Indented with 4 spaces.
```

---

## R6: Cross-Page Link Resolution Strategy

### Decision

Build a `pageSlugMap` (Map<confluencePageId, relativeMarkdownPath>) during tree walking, then use it during ADF conversion to resolve `inlineCard` and `link` mark references.

### Rationale

- Confluence stores cross-page links as `inlineCard` nodes with `attrs.url` containing the page URL, or as `link` marks with `attrs.href` containing a Confluence URL.
- Both formats contain the page ID (extractable via URL pattern: `/wiki/spaces/{key}/pages/{id}/{title}` or `/wiki/x/{shortlink}`).
- The tree walker knows every page ID and its output path → build the map up-front.
- During conversion, match page IDs in URLs to map entries → output relative Markdown links.

### URL Patterns to Match

```
1. /wiki/spaces/{spaceKey}/pages/{pageId}/{pageTitle}
2. /wiki/spaces/{spaceKey}/pages/{pageId}
3. /wiki/x/{shortlink}  → resolve via redirect or skip
4. https://{domain}/wiki/spaces/...  → strip domain prefix
```

### Fallback

If a page ID is not in the `pageSlugMap` (external Confluence page or different space), keep the original URL as an absolute Confluence link.

---

## R7: Page Title → Filename Slug Strategy

### Decision

Convert page titles to kebab-case filenames using a simple slug function: lowercase, replace spaces/special chars with hyphens, collapse multiple hyphens, trim leading/trailing hyphens.

### Rationale

- MkDocs expects lowercase filenames with hyphens for clean URLs.
- Must handle Confluence titles with special characters, parentheses, colons, etc.
- Simple regex-based approach — no slug library needed (Constitution V).

### Rules

```
1. Convert to lowercase
2. Replace spaces with hyphens
3. Remove non-alphanumeric characters (except hyphens)
4. Collapse consecutive hyphens
5. Trim leading/trailing hyphens
6. Append .md extension
7. Handle duplicates: append -2, -3, etc. if collision detected
```

### Examples

| Page Title                    | Filename                      |
| ----------------------------- | ----------------------------- |
| `Getting Started`             | `getting-started.md`          |
| `Teleport Overview & Setup`   | `teleport-overview-setup.md`  |
| `FAQ (Frequently Asked)`      | `faq-frequently-asked.md`     |
| `Version 2.0 — Release Notes` | `version-20-release-notes.md` |

---

## R8: CLI Configuration Strategy

### Decision

Use Node.js built-in `util.parseArgs()` (available since Node 16.17, stable in Node 20) for CLI argument parsing. Support both CLI flags and environment variables with CLI flags taking precedence.

### Rationale

- No new dependency needed — `parseArgs` is built-in.
- The existing `config.js` is tightly coupled to `@actions/core` (GitHub Actions) — cannot reuse.
- For a one-time CLI tool, 4 required parameters suffice; a full CLI framework (commander, yargs) would be overengineering (Constitution V).

### Configuration Parameters

| Parameter        | CLI Flag             | Env Variable         | Required | Default    |
| ---------------- | -------------------- | -------------------- | -------- | ---------- |
| Confluence URL   | `--confluence-url`   | `CONFLUENCE_URL`     | Yes      | —          |
| Confluence Email | `--confluence-user`  | `CONFLUENCE_USER`    | Yes      | —          |
| API Token        | `--confluence-token` | `CONFLUENCE_TOKEN`   | Yes      | —          |
| Root Page ID     | `--root-page-id`     | `CONFLUENCE_ROOT_ID` | Yes      | —          |
| Output Directory | `--output-dir`       | `OUTPUT_DIR`         | No       | `./output` |

### Alternatives Considered

| Alternative    | Reason Rejected                                             |
| -------------- | ----------------------------------------------------------- |
| `commander`    | New dependency for 4 args is overengineering                |
| `yargs`        | Same — too heavy for this use case                          |
| `process.argv` | Manual parsing is error-prone; `parseArgs` is cleaner       |
| `.env` file    | Adds dotenv dependency; env vars + CLI flags are sufficient |
| `config.js`    | Coupled to `@actions/core`; can't reuse without refactoring |

---

## R9: Codebase Reuse Assessment

### Decision

Reuse ~40% of existing codebase patterns: SDK auth/retry layer, pagination pattern, binary download pattern. Do NOT reuse: config.js, context.js, models, plugins, or renderers (all are push-direction specific).

### Reuse Inventory

| Component                   | Reuse?  | How                                                                                                 |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `confluence-sdk.js`         | Extend  | Add 4 new methods: `getPageBody()`, `getPageChildren()`, `getAttachments()`, `downloadAttachment()` |
| Auth pattern                | Reuse   | Same `Buffer.from(user:token).toString('base64')` Basic auth                                        |
| `retry-policy.js`           | Reuse   | Import as-is for new axios instances                                                                |
| `_links.next` pagination    | Reuse   | Same pattern for v2 children and attachments                                                        |
| `createWriteStream` pattern | Reuse   | From `base-sdk.js` `toPng()` for attachment download                                                |
| `logger.js`                 | Reuse   | Import as-is for console output                                                                     |
| `config.js`                 | No      | Coupled to `@actions/core` — build new `pull-config.js`                                             |
| `context.js`                | No      | Parses mkdocs.yml (push direction) — push-specific logic                                            |
| `models/`                   | No      | LocalPage, RemotePage, Meta are push-direction data structures                                      |
| `plugins/`                  | No      | MD→Confluence direction — opposite of what we need                                                  |
| `renderers/`                | No      | MD→HTML→Confluence direction — opposite                                                             |
| `confluence-syncer.js`      | Pattern | Reuse `processLevel()` recursive traversal pattern (not the code)                                   |

### New SDK Methods

```javascript
// In confluence-sdk.js — 4 new methods

async getPageBody(pageId) {
    // GET /wiki/api/v2/pages/{pageId}?body-format=atlas_doc_format
    // Returns: { id, title, body: { atlas_doc_format: { value: '...' } }, ... }
}

async getPageChildren(pageId) {
    // GET /wiki/api/v2/pages/{pageId}/direct-children
    // Paginates via _links.next, filters type === 'page'
    // Returns: [{ id, title, childPosition }, ...]
}

async getAttachments(pageId) {
    // GET /wiki/api/v2/pages/{pageId}/attachments
    // Paginates via _links.next
    // Returns: [{ id, title, mediaType, fileSize, downloadLink }, ...]
}

async downloadAttachment(downloadUrl, destPath) {
    // GET {base}{downloadLink} with responseType: 'stream'
    // Pipe to createWriteStream(destPath)
}
```

---

## R10: MkDocs Material Configuration & Output Structure

### Decision

Generate a minimal `mkdocs.yml` with Material theme configuration and a `nav` section derived from the page tree hierarchy. Output `docs/` directory with Markdown files organized in flat structure (with subdirectories for each section).

### Rationale

- MkDocs Material is the target output format per the spec.
- A flat `docs/` structure with subdirectories per nav section matches standard MkDocs conventions.
- Minimal `mkdocs.yml` provides: theme, nav order, and essential extensions (admonitions for panel conversion fidelity).

### Output Structure Example

```text
output/
├── mkdocs.yml
└── docs/
    ├── index.md                          # Root page → index.md
    ├── images/                           # All downloaded images
    │   ├── screenshot-1.png
    │   └── diagram-2.png
    ├── getting-started.md
    ├── architecture/
    │   ├── index.md                      # Section parent page
    │   ├── system-design.md
    │   └── data-flow.md
    └── operations/
        ├── index.md
        ├── monitoring.md
        └── troubleshooting.md
```

### Generated `mkdocs.yml` Template

```yaml
site_name: Teleport Documentation
theme:
  name: material
  features:
    - navigation.sections
    - navigation.expand
    - content.code.copy

markdown_extensions:
  - admonition
  - pymdownx.details
  - pymdownx.superfences
  - pymdownx.tabbed:
      alternate_style: true
  - tables

nav:
  - Home: index.md
  - Getting Started: getting-started.md
  - Architecture:
    - Overview: architecture/index.md
    - System Design: architecture/system-design.md
    - Data Flow: architecture/data-flow.md
  - Operations:
    - Overview: operations/index.md
    - Monitoring: operations/monitoring.md
    - Troubleshooting: operations/troubleshooting.md
```

### Directory Strategy

- Root page → `docs/index.md`
- Pages with children → subdirectory with `index.md` (parent page content)
- Leaf pages → `.md` files in parent's directory
- Images → shared `docs/images/` directory (flat, with unique filenames via page-id prefixing if collisions)

---

## R11: Error Handling & Resilience Strategy

### Decision

Fail fast on auth/config errors. For individual page or attachment failures, log warnings and continue processing remaining pages. Generate a summary report at the end listing any failures.

### Rationale

- A one-time pull tool should maximize output even if individual pages fail (e.g., permission denied on one page out of 20).
- Auth failures or invalid root page ID should fail fast — no point continuing.
- Matches the existing retry policy (3 retries with exponential backoff) for transient errors.

### Error Categories

| Error Type                    | Behavior                                             |
| ----------------------------- | ---------------------------------------------------- |
| Invalid config (missing args) | Exit 1 with usage message                            |
| Auth failure (401/403)        | Exit 1 with clear error message                      |
| Root page not found (404)     | Exit 1 — invalid root page ID                        |
| Child page fetch failure      | Log warning, skip subtree, continue siblings         |
| Page body fetch failure       | Log warning, skip page, continue tree                |
| Attachment list failure       | Log warning, skip attachments for page, continue     |
| Attachment download failure   | Log warning, use placeholder `![image](missing.png)` |
| ADF conversion failure        | Log warning, output raw JSON as code block           |
| File write failure            | Exit 1 — disk issue, cannot continue                 |
| Rate limiting (429)           | Handled by retry policy (exponential backoff)        |

---

## Summary of Open Questions — All Resolved

All NEEDS CLARIFICATION items from the Technical Context have been resolved:

| Original Unknown                | Resolution                                                        |
| ------------------------------- | ----------------------------------------------------------------- |
| v2 API endpoint for ADF body    | R1: `GET /wiki/api/v2/pages/{id}?body-format=atlas_doc_format`    |
| v2 API for child page discovery | R2: `GET /wiki/api/v2/pages/{id}/direct-children`                 |
| v2 API for attachments          | R3: `GET /wiki/api/v2/pages/{id}/attachments`                     |
| ADF node types to handle        | R4: 14 block + 8 inline + 11 marks — prioritized                  |
| Panel → admonition mapping      | R5: Direct mapping table, expand → collapsible                    |
| Cross-page link resolution      | R6: Build pageSlugMap during tree walk, resolve during conversion |
| Filename generation strategy    | R7: Kebab-case slug with collision handling                       |
| CLI configuration approach      | R8: Node.js `parseArgs` + env vars, no new dependencies           |
| Codebase reuse assessment       | R9: ~40% reuse (SDK, retry, auth, pagination, stream)             |
| Output directory structure      | R10: Standard MkDocs layout with subdirectories                   |
| Error handling strategy         | R11: Fail fast on auth, continue on individual failures           |
