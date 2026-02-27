# Dependency Remediation Plan

> **Created:** 2026-02-26  
> **Context:** After integrating PR #37 (nested navigation) and updating all semver-compatible dependencies, 4 moderate vulnerabilities and 14 major-version-behind packages remain.

---

## Current State

| Metric                | Before | After  |
| --------------------- | ------ | ------ |
| Audit vulnerabilities | 21     | 4      |
| Critical              | 1      | 0      |
| High                  | 10     | 0      |
| Moderate              | 8      | 4      |
| Low                   | 2      | 0      |
| Tests passing         | 148    | 148    |
| Code coverage         | 98.47% | 98.47% |

---

## Phase 1: Fix Remaining Vulnerabilities (High Priority)

These 4 moderate vulnerabilities have known fixes but require major version bumps with migration effort.

### 1.1 — `lint-staged` 13 → 16

| Detail  | Value                                               |
| ------- | --------------------------------------------------- |
| Vuln    | ReDoS in `micromatch` < 4.0.8 (GHSA-952p-6rrq-rcjv) |
| Current | 13.3.0                                              |
| Target  | 16.2.7                                              |
| Impact  | devDependency only — no production/runtime risk     |
| Effort  | Medium                                              |

**Migration steps:**

1. `npm install lint-staged@16 --save-dev --registry=https://registry.npmjs.org`
2. Review breaking changes:
   - v14: Dropped Node 14 support (already handled by our Node >=20 requirement)
   - v15: Changed config format — may need to update `.lintstagedrc` or `package.json` config
   - v16: Requires ESLint flat config (`eslint.config.js`) if ESLint is invoked via lint-staged
3. Update lint-staged configuration in `package.json` if needed
4. Run `npx lint-staged` manually to verify
5. Run full test suite

### 1.2 — `@actions/core` 1 → 3 (fixes `undici` vulnerability)

| Detail  | Value                                                              |
| ------- | ------------------------------------------------------------------ |
| Vuln    | Unbounded decompression in `undici` < 6.23.0 (GHSA-g9mf-h72j-4rw9) |
| Current | 1.11.1                                                             |
| Target  | 3.0.0                                                              |
| Impact  | **Production dependency** — affects the GitHub Action runtime      |
| Effort  | High                                                               |

**Migration steps:**

1. Review `@actions/core` v2 and v3 changelogs for breaking changes
2. Check all `import { ... } from '@actions/core'` usages in `lib/` for removed or renamed APIs
3. `npm install @actions/core@3 --save --registry=https://registry.npmjs.org`
4. Update any changed API calls (e.g., `getInput`, `setOutput`, `setFailed`, `debug`, `isDebug`)
5. Rebuild dist: `npm run build`
6. Test the Action end-to-end in a GitHub Actions workflow (unit tests may not cover all runtime behavior)
7. Run full test suite

**Risk:** This is the highest-risk change since `@actions/core` is a runtime dependency that interfaces directly with the GitHub Actions runner. Thorough E2E testing in an actual workflow is recommended.

---

## Phase 2: Major DevDependency Upgrades (Medium Priority)

These are all **devDependencies** — they don't affect production but keeping them current improves DX, security posture, and CI reliability.

### 2.1 — Test Framework Modernization

| Package          | Current | Target  | Breaking Changes                                   |
| ---------------- | ------- | ------- | -------------------------------------------------- |
| mocha            | 10.8.2  | 11.7.5  | Dropped Node 16/18, new default reporter           |
| chai             | 4.5.0   | 6.2.2   | ESM-only, new assertion API                        |
| chai-as-promised | 7.1.2   | 8.0.2   | ESM-only, requires chai 5+                         |
| sinon            | 14.0.2  | 21.0.1  | Dropped Node 14, API changes across several majors |
| c8               | 7.14.0  | 11.0.0  | Dropped Node 14, new defaults                      |
| nock             | 13.5.6  | 14.0.11 | ESM-only, API simplification                       |

**Recommended approach:**

1. **Batch chai + chai-as-promised together** — chai 5+/6 is ESM-only; update both simultaneously
2. **Batch mocha + c8** — lower risk, mostly config changes
3. **Sinon independently** — many major versions to cross; review changelog carefully
4. **Nock independently** — API changes may require test rewrites

**Effort estimate:** 2-4 hours total. The biggest risk is chai 4→6 which changes the assertion import pattern.

### 2.2 — Build & DX Tool Upgrades

| Package            | Current | Target | Notes                                       |
| ------------------ | ------- | ------ | ------------------------------------------- |
| @vercel/ncc        | 0.36.1  | 0.38.4 | Build tool — test dist output after upgrade |
| eslint             | 8.57.1  | 10.0.2 | Requires flat config migration              |
| husky              | 8.0.3   | 9.1.7  | New init workflow                           |
| dotenv             | 16.6.1  | 17.3.1 | Used in tests only                          |
| axios-mock-adapter | 1.22.0  | 2.1.0  | Test utility — review API changes           |

**Recommended approach:**

1. **@vercel/ncc 0.38** — Low risk. Just `npm install @vercel/ncc@latest --save-dev`, rebuild, verify dist
2. **husky 9** — Moderate. New setup: `npx husky init` replaces `.husky/` scripts. Follow [migration guide](https://typicode.github.io/husky/migrate-from-v8.html)
3. **eslint 10** — High effort. Requires migrating `.eslintrc.*` → `eslint.config.js` (flat config). Should be done **after** lint-staged 16 (Phase 1.1)
4. **dotenv 17** + **axios-mock-adapter 2** — Low risk, test-only deps

---

## Phase 3: Runtime Dependency Upgrades (Low Priority)

| Package     | Current | Target | Notes                                               |
| ----------- | ------- | ------ | --------------------------------------------------- |
| axios-retry | 3.9.1   | 4.5.0  | Used in production — review interceptor API changes |

**Migration steps:**

1. Review `axios-retry` v4 changelog
2. Check `lib/retry-policy.js` and `lib/base-sdk.js` for usage patterns
3. Update and test retry behavior

---

## Recommended Execution Order

```
Phase 1.1  lint-staged 16          ← Fixes 2 moderate vulns (micromatch ReDoS)
Phase 1.2  @actions/core 3         ← Fixes 2 moderate vulns (undici decompression)
Phase 2.1  Test framework updates  ← chai/mocha/sinon/c8/nock batch
Phase 2.2  Build/DX tools          ← ncc/eslint/husky
Phase 3    axios-retry 4           ← Runtime dep, lower urgency
```

**Dependency between phases:**
- Phase 1.1 (lint-staged 16) should precede Phase 2.2 (eslint 10) since both affect the lint pipeline
- Phase 2.1 items can be done in parallel with Phase 1 items
- Phase 3 is independent

---

## Additional Recommendations

### Fix npm registry auth

The `~/.npmrc` contains an expired AWS CodeArtifact token forcing `--registry=https://registry.npmjs.org` on every command. Either:
- Refresh the CodeArtifact token: `aws codeartifact login --tool npm --domain ... --repository ...`
- Or remove/comment the CodeArtifact lines from `~/.npmrc` if not needed for this project

### Add Dependabot or Renovate

Since the upstream maintainer isn't actively maintaining dependencies, consider adding automated dependency update PRs to your fork:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    groups:
      dev-dependencies:
        dependency-type: "development"
      production-dependencies:
        dependency-type: "production"
```

### Update GitHub Action tags

After pushing these changes, update the GitHub Action version tags:

```bash
git tag -fa v1.7 -m "v1.7.0"
git tag -fa v1 -m "v1.7.0"
git tag -fa latest -m "v1.7.0"
git push origin v1.7 v1 latest --force
```

---

## Tracking

- [X] Phase 1.1 — lint-staged 16
- [X] Phase 1.2 — @actions/core 3
- [X] Phase 2.1 — Test framework modernization
- [X] Phase 2.2 — Build/DX tool upgrades
- [X] Phase 3 — axios-retry 4
- [ ] Add Dependabot configuration
- [X] Update GitHub Action version tags
