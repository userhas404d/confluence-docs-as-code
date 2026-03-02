# Quickstart: Confluence → MkDocs Material Pull Tool

**Date**: 2025-02-27

---

## Prerequisites

- **Node.js** >= 20 (check: `node --version`)
- **npm** (comes with Node.js)
- **Confluence Cloud** API token ([create one here](https://id.atlassian.com/manage-profile/security/api-tokens))
- **Root Page ID**: The Confluence page ID to pull from (visible in the page URL)

## Setup

```bash
# Clone the repository and switch to the feature branch
git clone <repo-url> confluence-docs-as-code
cd confluence-docs-as-code
git checkout 001-confluence-mkdocs-pull

# Install dependencies
npm install
```

## Configuration

The tool requires 4 parameters, provided via CLI flags or environment variables:

### Option A: Environment Variables

```bash
export CONFLUENCE_URL="https://leolabs.atlassian.net"
export CONFLUENCE_USER="your-email@leolabs.space"
export CONFLUENCE_TOKEN="your-api-token"
export CONFLUENCE_ROOT_ID="2134835234"
```

### Option B: CLI Flags

```bash
node lib/pull/index.js \
  --confluence-url "https://leolabs.atlassian.net" \
  --confluence-user "your-email@leolabs.space" \
  --confluence-token "your-api-token" \
  --root-page-id "2134835234"
```

### Optional: Output Directory

```bash
# Default: ./output
export OUTPUT_DIR="./my-docs"

# Or via CLI flag:
node lib/pull/index.js --output-dir ./my-docs [... other flags]
```

## Running the Pull

```bash
# Using environment variables (set above):
node lib/pull/index.js

# Or with explicit flags:
node lib/pull/index.js \
  --confluence-url "$CONFLUENCE_URL" \
  --confluence-user "$CONFLUENCE_USER" \
  --confluence-token "$CONFLUENCE_TOKEN" \
  --root-page-id "$CONFLUENCE_ROOT_ID" \
  --output-dir ./output
```

### Expected Output

```
[INFO] Starting Confluence pull from page 2134835234...
[INFO] Walking page tree...
[INFO]   Found 20 pages across 3 levels
[INFO] Processing pages...
[INFO]   [1/20] Teleport Documentation (root)
[INFO]     → output/docs/index.md (3 attachments)
[INFO]   [2/20] Getting Started
[INFO]     → output/docs/getting-started.md (1 attachment)
[INFO]   ...
[INFO] Generating mkdocs.yml...
[INFO] Pull complete!
[INFO]   Pages: 20
[INFO]   Attachments: 28
[INFO]   Warnings: 2
[INFO]   Output: ./output/
```

## Verifying the Output

```bash
# Check the output structure
tree output/

# Preview with MkDocs (requires mkdocs-material installed)
cd output
pip install mkdocs-material
mkdocs serve
# Open http://127.0.0.1:8000 in your browser
```

### Output Structure

```text
output/
├── mkdocs.yml              # Generated MkDocs configuration
└── docs/
    ├── index.md             # Root page content
    ├── images/              # Downloaded image attachments
    │   ├── screenshot.png
    │   └── diagram.png
    ├── getting-started.md
    ├── architecture/
    │   ├── index.md
    │   ├── system-design.md
    │   └── data-flow.md
    └── operations/
        ├── index.md
        └── monitoring.md
```

## Running Tests

```bash
# Run all tests
npm test

# Run only pull-related tests
npx mocha 'test/lib/pull/**/*.test.js'

# Run with coverage
npm run test:coverage
```

## Troubleshooting

| Problem                       | Solution                                                         |
| ----------------------------- | ---------------------------------------------------------------- |
| `401 Unauthorized`            | Check `CONFLUENCE_USER` and `CONFLUENCE_TOKEN` are correct       |
| `404 Not Found`               | Verify `CONFLUENCE_ROOT_ID` is a valid page ID                   |
| `No pages found`              | Ensure the root page has child pages in Confluence               |
| `ENOENT: no such file or dir` | Ensure the output directory's parent exists                      |
| `Missing image references`    | Check if attachments are image types (PNG, JPEG, GIF, SVG, WebP) |

## Finding Your Root Page ID

1. Navigate to your Confluence page in a browser
2. The page ID is in the URL: `https://{domain}/wiki/spaces/{key}/pages/{PAGE_ID}/{title}`
3. For the Teleport docs: `2134835234`
