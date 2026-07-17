# SDK Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute remaining batches (B0/B1/B3/B4+) from the SDK integration design spec, building on already-completed infrastructure (contract tests, stripMatrixPrefix, SDK upgrade to 6ca8c3be, ratchet at 152).

**Architecture:** Progressive ratchet baseline reduction through paths/ constant migration, knip dead-code reporting, JSDoc on auth/guard surface, e2e verification post-SDK-upgrade, and P1 UI tasks from the UI/UX optimization plan.

**Tech Stack:** TypeScript, Vitest, MSW, Playwright, Vue 3, knip

## Global Constraints

- strict: true in tsconfig.json — never relax; escape hatch only via `@ts-expect-error` with ratchet baseline 0
- All Matrix operations through `src/services/matrix/` service layer; components/stores never call SDK directly
- Commit discipline: one concern per commit; bug fixes and UI changes in separate PRs
- Ratchet: `pnpm check:ratchet` must pass; baseline only goes down, never up
- knip: report mode only, not CI gate
- Contract tests use `tests/msw.ts` at HTTP boundary; never mock MatrixClientService wholesale in new tests
- `TAURI_ENV_PLATFORM` checks must not leak into `src/services/`

---

### Task 1: knip Setup — Report Mode

**Files:**
- Create: `knip.config.ts`
- Modify: `package.json` (add `pnpm knip` script)

**Interfaces:**
- Produces: `pnpm knip` — prints unused exports/files/dependencies report, exit 0 always

- [ ] **Step 1: Install knip**

```bash
pnpm add -D knip
```

- [ ] **Step 2: Create knip.config.ts**

```ts
import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: ['src/types/matrix-js-sdk-augmentations.d.ts'],
  ignoreDependencies: ['matrix-js-sdk'],
  entry: ['src/main.ts', 'src/mobile/main.ts'],
  project: ['src/**/*.{ts,tsx,vue}'],
  // unplugin-auto-import + unplugin-vue-components inject globals
  // without explicit imports — ignore their virtual modules
  ignoreBinaries: ['pnpm'],
}

export default config
```

- [ ] **Step 3: Add script to package.json**

Add to `scripts`:
```json
"knip": "knip --no-exit-code"
```

- [ ] **Step 4: Run knip and verify**

```bash
pnpm knip
```

Expected: prints report, exit code 0. Record top-level findings (unused exports count, unused file count) for commit message.

- [ ] **Step 5: Commit**

```bash
git add knip.config.ts package.json pnpm-lock.yaml
git commit -m "chore: add knip dead-code reporting (report mode, no CI gate)"
```

---

### Task 2: Ratchet Baseline Reduction — paths/ Directory Migration

**Files:**
- Modify: `src/services/matrix/paths/*.ts` (ensure all constants are unprefixed)
- Modify: various `src/services/matrix/**/*.ts` (replace hardcoded `/_matrix/...` with paths constants)
- Modify: `meta/ratchet-baseline.json` (run `--update` after cleanup)

**Interfaces:**
- Consumes: `stripMatrixPrefix` from `MatrixHttpClient.ts` (already exists)
- Consumes: `AUTH`, `ROOM`, `USER`, `MEDIA`, `SYNC`, `NOTIFICATIONS` path constants from `src/services/matrix/paths/`

- [ ] **Step 1: Audit current hardcoded prefixes**

```bash
node scripts/check-ratchet.mjs
```

Expected: baseline 152. Note the current count for commit message comparison.

- [ ] **Step 2: Identify low-hanging migration targets**

Run grep to find hardcoded `/_matrix/client/v3/` in service files that already import from `paths/`:

```bash
grep -rn '/_matrix/' src/services/matrix/ --include='*.ts' | grep -v '__tests__' | grep -v 'paths/' | grep -v 'MatrixHttpClient.ts' | head -60
```

- [ ] **Step 3: Migrate service files that use paths/ imports**

For each service file identified in Step 2 that already imports from `paths/`, replace hardcoded `/_matrix/client/v3/...` with the corresponding path constant. Example pattern:

Before:
```ts
await client.http.authedRequest('PUT', '/_matrix/client/v3/rooms/' + roomId + '/state/m.room.name', ...)
```

After (using existing `ROOM.STATE` or adding the missing constant):
```ts
await client.http.authedRequest('PUT', ROOM.STATE(roomId, 'm.room.name'), ...)
```

- [ ] **Step 4: Run ratchet update and verify monotonic decrease**

```bash
node scripts/check-ratchet.mjs --update
pnpm vitest run --reporter=dot
npx vue-tsc --noEmit
```

Expected: baseline decreased, all tests green, type check 0 errors.

- [ ] **Step 5: Commit**

```bash
git add meta/ratchet-baseline.json src/services/matrix/
git commit -m "refactor: migrate hardcoded Matrix paths to paths/ constants (ratchet: X→Y)"
```

Replace X and Y with the actual before/after counts from Step 1 and Step 4.

---

### Task 3: JSDoc — Auth + Guard Surface

**Files:**
- Modify: `src/services/matrix/MatrixHttpClient.ts` (stripMatrixPrefix, request, authedRequest, safeRequest)
- Modify: `src/services/matrix/MatrixTokenManager.ts` (schedule, refresh, clear)
- Modify: `src/services/matrix/auth/MatrixAuthService.ts` (login, refreshToken, logout, whoami, deactivate)
- Modify: `src/services/matrix/auth/MatrixSessionService.ts` (key session lifecycle methods)
- Modify: `src/services/matrix/auth/SessionOrchestrator.ts` (key orchestration methods)
- Modify: `src/services/matrix/MatrixClientService.ts` (loginWithToken, initialize)

**Interfaces:**
- Produces: `@throws` and error code semantics on ~10-15 methods across the auth + guard surface

- [ ] **Step 1: Add JSDoc to MatrixHttpClient guard methods**

For `stripMatrixPrefix`:
```ts
/**
 * Normalize a Matrix API path by stripping any leading `/_matrix/client/*` or `/_synapse/admin/*`
 * prefix. The SDK re-prepends its own prefix, so callers must never include a full `/_matrix` path.
 *
 * @throws Never throws (pure string transform).
 */
export function stripMatrixPrefix(path: string): string {
```

For `request()` and `authedRequest()`:
```ts
/**
 * Issue an HTTP request through the Matrix SDK client.
 *
 * @throws {MatrixError} with errcode M_UNKNOWN_TOKEN if the access token is invalid.
 * @throws {MatrixError} with errcode M_LIMIT_EXCEEDED if rate-limited.
 * @throws {MatrixError} with httpStatus 5xx for server errors (retried internally).
 */
```

- [ ] **Step 2: Add JSDoc to MatrixTokenManager**

For `schedule()`:
```ts
/**
 * Schedule automatic token refresh `expiresInMs - 60s` before expiry.
 * Cancels any existing scheduled refresh.
 *
 * @throws Never throws (errors surface in the refresh cycle's logout path).
 */
```

For `refresh()`:
```ts
/**
 * Execute a token refresh against POST /refresh.
 *
 * On success: persists new tokens and re-schedules the next refresh.
 * On 404: stops auto-refresh (server does not support it).
 * On 429 / network error: retries in 30s.
 * On any other error: logs out the expired session.
 *
 * @throws Never throws to callers (all error paths handled internally).
 */
```

- [ ] **Step 3: Add JSDoc to MatrixAuthService key methods**

For `login()`, `refreshToken()`, `logout()`, `whoami()`, `deactivate()`:
```ts
/**
 * @throws {MatrixError} M_FORBIDDEN — invalid credentials
 * @throws {MatrixError} M_USER_DEACTIVATED — account deactivated
 * @throws {MatrixError} M_LIMIT_EXCEEDED — rate limited, retry after `retry_after_ms`
 */
```

- [ ] **Step 4: Verify type check and tests**

```bash
npx vue-tsc --noEmit
pnpm vitest run src/services/matrix/auth src/services/matrix/__tests__/MatrixTokenManager --reporter=dot
```

Expected: 0 type errors, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/matrix/MatrixHttpClient.ts src/services/matrix/MatrixTokenManager.ts src/services/matrix/auth/MatrixAuthService.ts src/services/matrix/auth/MatrixSessionService.ts src/services/matrix/auth/SessionOrchestrator.ts src/services/matrix/MatrixClientService.ts
git commit -m "docs: add @throws JSDoc to auth and guard service surface"
```

---

### Task 4: E2E Verification Post-SDK-Upgrade

**Files:**
- Review: `e2e/*.spec.ts` (all 5+ spec files)
- Modify: `e2e/playwright.config.ts` (if needed)

**Interfaces:**
- Consumes: `MATRIX_LIVE_HOMESERVER_URL` env var (shared synapse-rust instance)
- Consumes: e2e test credentials from env vars

- [ ] **Step 1: Verify e2e infrastructure starts**

```bash
pnpm dev --host 127.0.0.1 --port 5210 &
sleep 8
curl -s http://127.0.0.1:5210 | head -5
kill %1 2>/dev/null
```

Expected: dev server starts, returns HTML.

- [ ] **Step 2: Audit e2e test files for SDK API breakage**

Review each e2e spec file for any SDK API usage that may have changed with the upgrade. Check:
- `e2e/login-flow.spec.ts` — login flow unchanged
- `e2e/core-flow.spec.ts` — core flow selectors
- `e2e/matrix-live.spec.ts` — uses `sessionOrchestrator` and dynamic imports, verify import paths

- [ ] **Step 3: Confirm e2e config uses shared homeserver pattern**

The existing `playwright.config.ts` already reads `MATRIX_LIVE_HOMESERVER_URL`. Document in commit that shared instance + e2e-dedicated accounts is the confirmed approach (spec Q3 resolution).

- [ ] **Step 4: Commit**

```bash
git add e2e/
git commit -m "chore: verify e2e config post-SDK-upgrade, document shared-instance approach"
```

---

### Task 5: UI P1 — T1 Design Tokens (Dark Theme CSS Variables)

**Files:**
- Modify: `src/styles/css/design-tokens.css`

**Interfaces:**
- Produces: `--hula-surface-darkest`, `--hula-surface-dark`, `--hula-surface-dark-mid` CSS variables under `html[data-theme="dark"]`

- [ ] **Step 1: Add dark theme surface tokens**

Add to `src/styles/css/design-tokens.css` under `html[data-theme="dark"]`:

```css
html[data-theme="dark"] {
  --hula-surface-darkest: #161616;
  --hula-surface-dark: #1a1a1a;
  --hula-surface-dark-mid: #222222;
}
```

- [ ] **Step 2: Verify CSS compiles**

```bash
pnpm dev &
sleep 5
curl -s http://127.0.0.1:5210 | grep -o 'hula-surface-dark' | head -3
kill %1 2>/dev/null
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/css/design-tokens.css
git commit -m "feat: add dark theme surface tokens to design-tokens.css"
```

---

### Task 6: UI P1 — T2 Design System Doc

**Files:**
- Create: `DESIGN.md`

**Interfaces:**
- Produces: design token mapping table, color system, spacing scale, typography scale

- [ ] **Step 1: Create DESIGN.md**

Create `DESIGN.md` with:
- Token mapping table (prototype tokens → `--hula-*` tokens)
- Color system (brand, functional, neutral, surface)
- Spacing scale (4px base)
- Typography scale (text-xs to text-4xl)
- Dark theme decision: default `os` (follow system), resolved by `resolveOsTheme()`

- [ ] **Step 2: Commit**

```bash
git add DESIGN.md
git commit -m "docs: add DESIGN.md with token mapping and design system reference"
```

---

### Task 7: Full Gate

**Files:**
- Modify: `docs/功能实现清单.md` (append implementation record)

- [ ] **Step 1: Run full gate**

```bash
npx vue-tsc --noEmit
pnpm check
pnpm vitest run
pnpm check:ratchet
pnpm knip
```

Expected: vue-tsc 0 errors, biome no new issues, vitest all green, ratchet baseline not increased.

- [ ] **Step 2: Update feature ledger**

Append a section to `docs/功能实现清单.md` dated 2026-07-17: SDK integration implementation record — Tasks 1-6 completed, gate results, knip report summary, ratchet baseline before/after.

- [ ] **Step 3: Commit**

```bash
git add docs/功能实现清单.md
git commit -m "docs: record SDK integration implementation in feature ledger"
```

---
