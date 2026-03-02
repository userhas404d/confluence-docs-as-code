# Confluence Docs as Code Action

This Action publishes your [MkDocs](https://www.mkdocs.org) documentation to your
Atlassian Confluence Cloud wiki.

## Features

* Publishes only new or changed pages
  * Optionally [force update](#confluence_force_update) all pages
  * Force update all pages on new major/minor release
* Converts internal links to Confluence links
* Uploads images as Confluence page attachments
* Converts fenced code blocks to Confluence code macros
* Renders graphs:
  * *Mermaid* see [`mermaid_renderer`](#mermaid_renderer) for available options
  * *PlantUML* see [`plantuml_renderer`](#plantuml_renderer) for available options
* Add a common [prefix](#confluence_title_prefix) to all page titles
* Restricts page update to [confluence_user](#confluence_user)
* Supports nested navigation in the `nav` section of the [MkDocs Configuration](#mkdocs-configuration)

## Limitations

* Does not publish pages not described in the `nav` section.

## Pull Mode (Confluence → MkDocs)

In addition to the push-to-Confluence GitHub Action, this tool includes a **pull mode** that
exports a Confluence page tree into a local MkDocs Material site.

### Quick Start

```bash
export CONFLUENCE_URL="https://your-tenant.atlassian.net"
export CONFLUENCE_USER="you@example.com"
export CONFLUENCE_TOKEN="your-api-token"
export CONFLUENCE_ROOT_ID="123456789"    # Any Confluence page ID

node lib/pull/index.js --output-dir ./output

cd output
pip install mkdocs-material
mkdocs serve
```

### CLI Options

| Flag                  | Env Var                | Required | Description                                                    |
|-----------------------|------------------------|----------|----------------------------------------------------------------|
| `--confluence-url`    | `CONFLUENCE_URL`       | Yes      | Base URL (e.g., `https://tenant.atlassian.net`)                |
| `--confluence-user`   | `CONFLUENCE_USER`      | Yes      | Confluence user email for Basic auth                           |
| `--confluence-token`  | `CONFLUENCE_TOKEN`     | Yes      | Confluence API token                                           |
| `--root-page-id`      | `CONFLUENCE_ROOT_ID`   | Yes      | Confluence page ID to start tree walk from                     |
| `--output-dir`        | `OUTPUT_DIR`           | No       | Output directory (default: `./output`)                         |
| `--force`             | `CONFLUENCE_FORCE_PULL` | No      | Bypass incremental cache and re-pull all pages (default: off)  |

### Incremental Sync (Caching)

By default the pull tool uses **incremental sync** to avoid re-downloading unchanged content.

On each pull, the tool writes a `.pull-manifest.json` file to the output directory. This manifest
records every page's Confluence **version number**, title, output path, and attachment list.
On subsequent runs the tool compares each page's current version against the cached version and
**skips pages whose version has not changed**, saving API calls, bandwidth, and conversion time.

**How it works:**

1. The full page tree is always walked (cheap — no body content fetched).
2. For each page, the version number from the API is compared to the manifest entry.
3. Pages with an increased version number (or a changed title) are re-fetched and re-converted.
4. New pages (not in the manifest) are fetched normally.
5. Pages that were in the old manifest but are no longer in the tree are deleted from the output.
6. Attachment downloads are also cached — existing image files on disk are skipped.

**Forcing a full pull:**

To bypass the cache entirely and re-pull all pages, use the `--force` flag:

```bash
node lib/pull/index.js --output-dir ./output --force
```

Or set the environment variable:

```bash
export CONFLUENCE_FORCE_PULL=true
node lib/pull/index.js --output-dir ./output
```

**When to use `--force`:**

- After upgrading the pull tool (conversion logic may have changed)
- If you suspect the manifest is stale or corrupted
- When you want a clean, guaranteed-fresh output
- In CI environments where the output directory is always empty anyway

**Manifest location:** `<output-dir>/.pull-manifest.json`

The manifest is a plain JSON file and can be safely committed to version control or added to
`.gitignore` depending on your workflow. Deleting it is equivalent to running with `--force` on
the next pull.

## Requirements

In order to use this action to your repository you need to meet the following requirements.

### MkDocs Configuration

Your repository is expected to include an `mkdocs.yml` configuration file
(in the root dir) with the following settings:

* `site_name`
* `repo_url`
* `nav`

```yml
site_name: Fixture Site Name
repo_url: https://github.com/fixture-account/fixture-repo

nav:
  - Page title: page.md
  - Some other page title: other-page.md
  - Yet an other page title: more/page.md
```

For more MkDocs configuration options check out the official [documentation](https://www.mkdocs.org/user-guide/configuration).

### Atlassian Confluence

In order for the action to be able to publish your documents to a Confluence space
you need to create an API token for a user with read/write access to that space.

It is highly recommended that you create a dedicated (robot) user just for this purpose.

Refer to Atlassian documentation on [managing API tokens](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/).

## Inputs

### `confluence_tenant`

**Required**. Typically this is your is your organization name that is used as a subdomain to
your Atlassian cloud url, for example if your Atlassian url is
`https://my-organization.atlassian.net` use `my-organization` as
`confluence_tenant`

### `confluence_space`

**Required**. The key of the space that will host your documentation.
If your space has an auto-generated key, navigate to your space an you can find
it in the URL on your browser's location.

For example if your space URL is:
`https://my-organization.atlassian.net/wiki/spaces/~55700475998cb3f40a`

Use `~55700475998cb3f40a` as your `confluence_space`.

### `confluence_user`

**Required**. The username of the user that will be used to publish to Confluence
(see also [Atlassian Confluence](#atlassian-confluence) section)

### `confluence_token`

**Required**. The API token of the user that will be used to publish to Confluence
(see also [Atlassian Confluence](#atlassian-confluence) section)

### `confluence_parent_page`

*Optional*. The title of an existing page in the same Confluence space to be used as
a parent for your documentation.

For example if your space has a page with title **"My Documentation"** and you
want to use it as the parent for your published documents, then set
`confluence_parent_page` to `'My Documentation'`

### `confluence_title_prefix`

*Optional*. When set, this prefix will be prepended to all confluence page titles
except your root page which is titled according to the `site_name` in your
[MkDocs configuration](#mkdocs-configuration).

For example, if you have a page with title `'My Page'` and the `confluence_title_prefix`
is set to `'FOO:'` then the page will be created to confluence with the title
`'FOO: My Page'`.

This could be useful in cases that you want to publish multiple repos to the same
confluence space, which requires each page title to be unique.

### `confluence_force_update`

*Optional*. When set to `yes` all pages will be published to confluence including
those that have not changed. Can be handy when used with the `workflow_dispatch`
event as shown in the [example usage](#example-usage) below.

### `confluence_cleanup`

*Optional*. When set to `yes` all pages will be deleted from confluence.
Can be handy when used with the `workflow_dispatch` event as shown in the
[example usage](#example-usage) below.

### `kroki_enabled` (*Deprecated*)

*Optional*. When set to `yes` enables rendering of [Mermaid](https://mermaid.js.org/)
and [PlantUML](https://plantuml.com/) graphs into images (`.png`)
via [Kroki.io](https://kroki.io/) service.

Defaults to `yes`.

> ⚠️ Will be removed in future releases in favour of the more fine-grained
> [`mermaid_renderer`](#mermaid_renderer) and [`plantuml_renderer`](#plantuml_renderer)
> options below.

### `kroki_host` 

*Optional*. When set this host is used as a kroki server instead of the default one.
See [kroki docs](https://docs.kroki.io/kroki/setup/use-docker-or-podman/) on how to setup a local kroki instance.

Defaults to https://kroki.io

### `mermaid_renderer`

*Optional*. Can be one of:

* `'none'`: will not render
* `'kroki'`: will use [Kroki.io](https://kroki.io) to render as `png`
* `'mermaid-plugin'`: will upload the diagram source and render using
  [Mermaid Diagrams for Confluence](https://marketplace.atlassian.com/apps/1226567/mermaid-diagrams-for-confluence?tab=overview&hosting=cloud) add-on

> ⚠️ If not explicitly defined, falls back to [`kroki_enabled`](#kroki_enabled-deprecated)
> option in order to provide backwards compatibility

### `plantuml_renderer`

*Optional*. Can be one of:

* `'none'`: will not render
* `'kroki'`: will use [Kroki.io](https://kroki.io) to render as `png`
* `'plantuml'`: will use [plantuml.com](https://plantuml.com/) to render as `png`

> ⚠️ If not explicitly defined, falls back to [`kroki_enabled`](#kroki_enabled-deprecated)
> option in order to provide backwards compatibility

## Example usage

```yml
# File: .github/workflows/publish_to_confluence.yml

name: Publish MkDocs to Confluence

on:
  push:
    branches:
      - master
    paths:
      - "docs/**"
      - mkdocs.yml
  workflow_dispatch:
    inputs:
      confluence_force_update:
        description: 'Force update all pages (yes/no)?'
        required: false
        default: 'no'
      confluence_cleanup:
        description: 'Delete all pages (yes/no)?'
        required: false
        default: 'no'

jobs:
  publish-to-confluence:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source
        uses: actions/checkout@v3
      - name: Publish to Confluence
        uses: Workable/confluence-docs-as-code@v1.5.0
        with:
          confluence_tenant: 'Your Confluence Account Name'
          confluence_space: 'The Confluence Space Key'
          confluence_user: ${{ secrets.CONFLUENCE_USER }}
          confluence_token: ${{ secrets.CONFLUENCE_TOKEN }}
          confluence_parent_page: 'The title of the page to use as parent' # Optional
          confluence_title_prefix: 'My Prefix:' # Optional
          confluence_force_update: ${{ github.event.inputs.confluence_force_update }} # Optional
          confluence_cleanup: ${{ github.event.inputs.confluence_cleanup }} # Optional
          kroki_enabled: 'no' # Optional
          kroki_host: 'https://kroki.io' # Optional
          mermaid_renderer: 'none' # Optional
          plantuml_renderer: 'none' # Optional
```
