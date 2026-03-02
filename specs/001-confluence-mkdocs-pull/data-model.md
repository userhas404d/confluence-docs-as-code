# Data Model: Confluence → MkDocs Material One-Time Pull

**Date**: 2025-02-27 | **Phase**: 1 — Design & Contracts
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

---

## Entities

### 1. PullConfig

Configuration for a pull operation, sourced from CLI flags and environment variables.

```
PullConfig
├── confluenceUrl: string        # Base URL (e.g., "https://leolabs.atlassian.net")
├── confluenceUser: string       # Email for Basic auth
├── confluenceToken: string      # API token for Basic auth
├── rootPageId: string           # Confluence page ID to start tree walk
└── outputDir: string            # Output directory path (default: "./output")
```

**Validation Rules**:
- `confluenceUrl` — required, must start with `https://`
- `confluenceUser` — required, non-empty string
- `confluenceToken` — required, non-empty string
- `rootPageId` — required, numeric string (Confluence page IDs are numeric)
- `outputDir` — optional, defaults to `./output`, must be a valid filesystem path

**Source**: `lib/pull/pull-config.js`

---

### 2. PageTreeNode

Represents a single page in the Confluence page tree, used during tree walking.

```
PageTreeNode
├── id: string                   # Confluence page ID
├── title: string                # Page title
├── position: number             # Child position (for nav ordering)
├── depth: number                # Tree depth (0 = root)
├── parentId: string | null      # Parent page ID (null for root)
├── children: PageTreeNode[]     # Ordered child nodes
├── slug: string                 # Generated filename slug (e.g., "getting-started")
└── outputPath: string           # Relative path from docs/ (e.g., "architecture/system-design.md")
```

**Relationships**:
- Self-referential tree: each node has `children[]` of the same type
- `parentId` → parent `PageTreeNode.id`
- `slug` derived from `title` via slug function (R7)
- `outputPath` computed during tree walking based on depth and parent structure

**State Transitions**: None — immutable after tree walking phase.

**Source**: Used in `lib/pull/tree-walker.js`, passed to other modules.

---

### 3. ConversionContext

Mutable context passed through ADF conversion recursion, carrying state needed by node handlers.

```
ConversionContext
├── pageId: string               # Current page's Confluence ID
├── pageTitle: string            # Current page's title
├── attachmentMap: Map<string, string>
│   └── fileId → localImagePath  # Maps Confluence fileId to local image path
├── pageSlugMap: Map<string, string>
│   └── confluencePageId → relativeMdPath  # Maps page IDs to relative .md paths
├── depth: number                # Current nesting depth (for list indentation)
├── listType: string | null      # 'bullet' | 'ordered' | null
├── listItemIndex: number        # Current 1-based index in ordered list
├── tableColumnCount: number     # Columns in current table (for alignment)
└── inlineMode: boolean          # Whether currently processing inline content
```

**Validation Rules**:
- `attachmentMap` populated per-page before conversion
- `pageSlugMap` populated once from full tree before any conversion
- `depth` starts at 0, incremented on nested list entry
- `listType` set when entering a list node, cleared on exit

**Source**: `lib/pull/adf-converter.js`

---

### 4. AttachmentInfo

Metadata for a Confluence attachment, used for download decisions and path mapping.

```
AttachmentInfo
├── id: string                   # Confluence attachment ID
├── title: string                # Filename (e.g., "screenshot.png")
├── mediaType: string            # MIME type (e.g., "image/png")
├── fileSize: number             # Size in bytes
├── fileId: string               # Confluence file ID (used in ADF media nodes)
├── downloadLink: string         # Relative download URL
└── localPath: string            # Computed local path (e.g., "images/screenshot.png")
```

**Validation Rules**:
- Only attachments with image media types are downloaded: `image/png`, `image/jpeg`, `image/gif`, `image/svg+xml`, `image/webp`
- `localPath` always computed as `images/{pageSlug}-{title}` — page slug prefix is always applied to avoid cross-page filename collisions

**Source**: `lib/pull/attachment-downloader.js`

---

### 5. OutputDocument

Represents a single Markdown document to be written to disk.

```
OutputDocument
├── title: string                # Page title (used in mkdocs.yml nav)
├── slug: string                 # Filename slug
├── outputPath: string           # Full relative path (e.g., "docs/architecture/system-design.md")
├── markdownContent: string      # Converted Markdown content
├── attachments: AttachmentInfo[] # Attachments downloaded for this page
└── conversionWarnings: string[] # Any warnings generated during ADF conversion
```

**Relationships**:
- 1:1 with `PageTreeNode` — each tree node produces one output document
- `attachments[]` — subset of page's Confluence attachments (images only)

**Source**: Produced by `lib/pull/adf-converter.js`, consumed by filesystem writer in `lib/pull/index.js`

---

### 6. NavTree

Hierarchical structure for generating the `mkdocs.yml` `nav` section.

```
NavTree
├── title: string                # Display title for this nav entry
├── path: string                 # Relative path to .md file (from docs/)
└── children: NavTree[]          # Ordered child entries
```

**Validation Rules**:
- Root node title defaults to "Home"
- Pages with children → title used as section header, page becomes `index.md` in subdirectory
- Leaf pages → direct file reference
- Order determined by `PageTreeNode.position`

**Source**: `lib/pull/mkdocs-generator.js`

---

## Entity Relationship Diagram

```
┌─────────────┐         ┌──────────────────┐
│ PullConfig  │────────▶│   tree-walker    │
└─────────────┘         └──────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  PageTreeNode    │◀──┐
                        │  (tree root)     │   │ children[]
                        └──────────────────┘───┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
              ┌──────────┐ ┌──────────┐ ┌──────────────────┐
              │ adf-     │ │attachment│ │ link-resolver    │
              │converter │ │downloader│ │ (pageSlugMap)    │
              └──────────┘ └──────────┘ └──────────────────┘
                  │            │
                  ▼            ▼
           ┌──────────────────────────┐
           │ ConversionContext        │
           │ (attachmentMap,          │
           │  pageSlugMap, depth...)  │
           └──────────────────────────┘
                  │
                  ▼
           ┌──────────────────────────┐
           │ OutputDocument           │
           │ (per page)               │
           └──────────────────────────┘
                  │
                  ▼
           ┌──────────────────────────┐
           │ NavTree                  │
           │ → mkdocs.yml            │
           └──────────────────────────┘
```

## Data Flow

```
1. PullConfig → tree-walker.walkTree(config.rootPageId)
   → recursive getPageChildren() calls
   → builds PageTreeNode tree with slugs & outputPaths

2. PageTreeNode tree → link-resolver.buildPageSlugMap(tree)
   → Map<pageId, relativePath>

3. For each PageTreeNode (DFS):
   a. confluence-sdk.getPageBody(node.id)
      → ADF JSON string
   b. confluence-sdk.getAttachments(node.id)
      → AttachmentInfo[]
   c. attachment-downloader.downloadAll(attachments, outputDir)
      → attachmentMap (Map<fileId, localPath>)
   d. adf-converter.convert(adfJson, context)
      → markdownContent
   e. Write OutputDocument to disk

4. PageTreeNode tree → mkdocs-generator.generate(tree)
   → NavTree → mkdocs.yml YAML string → write to disk
```
