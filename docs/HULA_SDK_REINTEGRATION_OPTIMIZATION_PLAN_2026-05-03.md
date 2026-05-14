# HuLa Frontend Optimization Plan Based on Matrix SDK Contract Governance

## 1. Background And Goal

This document is based on the latest contract-governed optimization results in `/Users/ljf/Desktop/hu_ts/matrix-js-sdk`, especially the governance requirements in `docs/api-contract/governance/SDK_CODEGEN_PROMPT_TEMPLATE.md`, and focuses on the current architecture and code status of `/Users/ljf/Desktop/hu_ts/hula`.

The goal is not only to "upgrade the SDK", but to complete the following engineering convergence in one coordinated plan:

1. Rebuild a clean and reproducible local development and verification environment.
2. Re-integrate the local `matrix-js-sdk` into `hula` in a progressive and backward-compatible way.
3. Standardize all frontend-to-backend interaction paths with an "SDK first, lightweight API fallback second, Tauri command for local capability third" architecture.
4. Turn the current desktop/mobile route set into an executable UI feature matrix with priorities, dependencies, acceptance criteria, and tests.
5. Optimize the main workbench for startup, rendering, interaction flow, and maintainability.
6. Establish measurable baselines, rollout checkpoints, risk controls, and rollback paths.

## 2. Current Architecture And Code Status

## 2.1 Architecture Summary

`hula` is currently a Tauri v2 + Vue 3 + TypeScript multi-platform frontend project with the following core characteristics:

- App shell: Tauri v2 (`src-tauri`) for desktop/mobile runtime, local file access, token persistence, database switching, and native command bridge.
- Frontend framework: Vue 3 + Vite 7 + TypeScript.
- State management: Pinia + `pinia-plugin-persistedstate`.
- UI stack: UnoCSS + Sass + Naive UI + Vant.
- Routing: separate desktop and mobile route maps in `src/router/routes/desktop.ts` and `src/router/routes/mobile.ts`.
- Matrix communication: local `matrix-js-sdk` integrated through `link:../matrix-js-sdk`.
- Local runtime optimization: existing Web Worker-based SDK loading experiment in `src/workers/matrixSdk.worker.ts`.
- Performance instrumentation: `src/main.ts` already records `performance.mark()` and Web Vitals observers.

## 2.2 Key Findings

### A. Local SDK integration is deep, but not yet governance-aligned

- `hula/package.json` uses `"matrix-js-sdk": "link:../matrix-js-sdk"`.
- `hula` allows Node `^20.19.0 || >=22.12.0 <25`, while the optimized `matrix-js-sdk` requires Node `>=22.0.0`.
- `hula` does not only consume public SDK exports; it also imports subpath entries such as:
  - `matrix-js-sdk/src/manager-extensions`
  - `matrix-js-sdk/src/telemetry`
- `hula` still relies on large local type augmentations in `src/types/matrix-js-sdk-augmentations.d.ts`, which indicates incomplete convergence on SDK public surface.

### B. Backend interaction paths are mixed

The project currently uses four different communication styles:

1. SDK native methods such as `createClient`, `client.getProfileInfo()`, `client.setDisplayName()`, `SlidingSync`, `IndexedDBStore`.
2. Raw SDK HTTP calls such as `client.http.authedRequest(...)`.
3. Plain `fetch()` or custom HTTP client access.
4. Tauri `invoke()` for local OS, token, database, and device capabilities.

This leads to inconsistent error handling, retry policy, authorization semantics, caching, and tests.

### C. Cache and local state have multiple landing zones

Current cache or persistent state exists in at least these layers:

- `node_modules`, build outputs, test outputs, and Rust build artifacts.
- Browser `localStorage`:
  - `hula-homeserver-url`
  - `hula-identity-server-url`
  - `hula-session-homeserver-url`
  - `hula-session-identity-server-url`
  - `TOKEN`
  - `REFRESH_TOKEN`
  - `proxySettings`
  - `draft_${roomId}`
  - user-scoped keys such as `chat`, `group`, `contacts`, `cached`, `sessionUnread`
  - legacy preference keys such as `hula-message-confirm`, `hula-link-preview`, `hula-thread-*`, `hula-space-*`
- Pinia persisted stores, including settings, user profile, guide, history, plugin settings, and menu state.
- IndexedDB:
  - `hula-matrix-sync`
  - `hula-rageshake`
- In-memory cache:
  - `MatrixCacheManager`
- Tauri local data:
  - app data directory and SQLite database in `app_data_dir`
  - app cache directory
  - native logs
  - token-related secure material managed through Tauri backend

### D. Performance groundwork exists, but performance governance is incomplete

- `src/main.ts` already measures `hula-total-boot`, `hula-app-creation`, `hula-plugin-install`, and `hula-mount-to-ready`.
- `package.json` includes `metrics:bundle`, `test:e2e`, `test:e2e:mobile`, and `check:sdk-types`.
- However, there is no single release gate that ties together:
  - bundle growth limits
  - boot regression thresholds
  - SDK integration health
  - screen-level acceptance and performance results

### E. Existing docs are useful, but some SDK guidance is outdated

- Historical docs such as `docs/SDK_OPTIMIZATION.md` still contain patterns like `as any`.
- That conflicts with the newer contract-governed SDK direction: typed DTOs, generated route tables, explicit auth semantics, and typed error handling.

## 2.3 Main Risks Identified

| Risk                        | Current status                                             | Impact                                  |
| --------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| Node baseline mismatch      | `hula` still supports Node 20, local SDK requires Node 22+ | install/build failures, hidden CI drift |
| Subpath dependency coupling | imports from `matrix-js-sdk/src/*` exist                   | fragile integration boundary            |
| Transport inconsistency     | SDK methods + `authedRequest` + `fetch` + Tauri invoke     | duplicated auth/error/cache behavior    |
| State reset incompleteness  | browser/Tauri/cache layers are separate                    | false positives during testing          |
| Type augmentation debt      | large local augmentation file remains                      | upgrade friction, hidden API drift      |
| Worker/main duplication     | SDK initialized in both main thread and worker contexts    | duplicated cost and unclear ownership   |

## 3. Optimization Principles

All follow-up work should obey these rules:

1. SDK first: use local `matrix-js-sdk` public or approved subpath exports before writing direct HTTP calls.
2. Route fidelity: any HTTP fallback must preserve backend path, query, auth, and DTO semantics exactly.
3. Progressive migration: no one-shot rewrite; migrate by capability domain with compatibility shims.
4. Single transport abstraction: all non-SDK HTTP calls must go through one unified API transport layer.
5. Cache lifecycle clarity: every persistent layer must have an owner, TTL or invalidation rule, and reset path.
6. Screen acceptance first: route-level functionality and tests drive rollout sequence.
7. Measurable rollout: every phase must produce metrics, test results, and rollback checkpoints.

## 4. Clean Environment And Cache Clearing Strategy

## 4.1 Clearing Objectives

The cleanup strategy must support two modes:

- Safe cleanup: preserve lockfiles and source code, clear runtime/build/cache state.
- Hard reset: additionally clear local app data, IndexedDB, browser-origin state, and Rust target outputs for reproducibility checks.

## 4.2 Cleanup Scope

### A. Workspace-level dependency and build artifacts

For `/Users/ljf/Desktop/hu_ts/hula`:

- `node_modules`
- `dist`
- `coverage`
- `playwright-report`
- `test-results`
- `storybook-static`
- any `.vite` cache directories
- `src-tauri/target`

For `/Users/ljf/Desktop/hu_ts/matrix-js-sdk`:

- `node_modules`
- `lib`
- `coverage`
- temp perf/report outputs

### B. Package manager cache

- run `pnpm store prune`
- if reproducibility still fails, clear the local pnpm store used by the developer machine or CI runner

### C. Browser-side runtime cache

- `localStorage`
- `sessionStorage`
- `IndexedDB` databases:
  - `hula-matrix-sync`
  - `hula-rageshake`
- `Cache Storage` if present
- worker/script caches for the dev browser profile

### D. Tauri-side runtime cache and data

Because `src-tauri/tauri.conf.json` uses:

- `productName`: `HuLa`
- `identifier`: `com.hula.pc`

desktop hard reset must include:

- app data directory for `com.hula.pc`
- app cache directory for `com.hula.pc`
- local SQLite databases created under `app_data_dir`
- plugin log output
- token/session metadata stored through Tauri backend

On macOS, verify at least:

- `~/Library/Application Support/com.hula.pc`
- `~/Library/Caches/com.hula.pc`
- any companion HuLa directories created by Tauri plugins or upload/download features

### E. In-app cache

- `MatrixCacheManager.clear()`
- all persisted Pinia stores
- session recovery state
- local draft cache
- room list/timeline restoration state

## 4.3 Recommended Cleanup Procedure

### Step 1. Stop all dev processes

- close Tauri desktop app
- stop `vite`, `tauri dev`, Playwright, Storybook, and any local backend process

### Step 2. Clear workspace artifacts

```bash
cd /Users/ljf/Desktop/hu_ts/hula
rm -rf node_modules dist coverage playwright-report test-results storybook-static .vite src-tauri/target

cd /Users/ljf/Desktop/hu_ts/matrix-js-sdk
rm -rf node_modules lib coverage .vite

pnpm store prune
```

### Step 3. Clear browser-side app state

Use a dedicated dev browser profile. For a hard reset, run in DevTools console on the HuLa origin:

```js
const keysToDelete = [
  'hula-homeserver-url',
  'hula-identity-server-url',
  'hula-session-homeserver-url',
  'hula-session-identity-server-url',
  'TOKEN',
  'REFRESH_TOKEN',
  'proxySettings',
  'chat',
  'group',
  'contacts',
  'cached',
  'sessionUnread'
]

for (const key of keysToDelete) localStorage.removeItem(key)
for (const key of Object.keys(localStorage)) {
  if (key.startsWith('hula-') || key.startsWith('draft_')) localStorage.removeItem(key)
}
sessionStorage.clear()
indexedDB.deleteDatabase('hula-matrix-sync')
indexedDB.deleteDatabase('hula-rageshake')
if ('caches' in window) {
  caches.keys().then((names) => names.forEach((name) => caches.delete(name)))
}
```

### Step 4. Clear Tauri app data

Remove `com.hula.pc` app data and cache directories only after confirming no user data needs to be retained for debugging.

### Step 5. Reinstall and rebuild

```bash
cd /Users/ljf/Desktop/hu_ts/matrix-js-sdk
pnpm install
pnpm build

cd /Users/ljf/Desktop/hu_ts/hula
pnpm install
pnpm check:sdk-types
pnpm test:run
pnpm metrics:bundle
```

## 4.4 Delivery Recommendation

Implement two scripts in a later change:

- `scripts/clean-runtime-state.mjs`: browser/Tauri/app-state safe cleanup
- `scripts/clean-all.mjs`: hard reset for integration verification

Both scripts must support `--safe` and `--hard` modes and must print exactly what they delete.

## 5. matrix-js-sdk Reintegration Plan

## 5.1 Difference Analysis: Current Integration State vs Optimized SDK Baseline

| Area                 | Current `hula` state                      | Optimized `matrix-js-sdk` baseline                      | Required action                                     |
| -------------------- | ----------------------------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| Node baseline        | Node 20 or 22                             | Node 22+                                                | unify on Node 22.12+                                |
| SDK source           | linked local repo, runtime drift possible | contract-governed local SDK                             | pin integration commit SHA per rollout              |
| Public surface usage | mixed public import + large augmentations | richer exports and generated route/DTO tables           | reduce augmentations, prefer exports                |
| Errors               | mixed generic errors and local formatting | typed `SdkError`, auth/not-found/api/retryable metadata | add app-level error adapter                         |
| Retry                | service-specific or implicit              | `BaseManager`-driven retry semantics                    | align call sites to manager semantics               |
| API contract         | partially manual                          | generated route tables and DTO governance               | map HuLa service calls to generated managers first  |
| Auth/query metadata  | scattered in hand-written calls           | now explicit in governance and schema                   | remove ad hoc query string construction             |
| Internal subpaths    | direct `src/*` imports present            | supported but high-churn subpath exports                | wrap via local adapter layer, then gradually remove |

## 5.2 Reintegration Goals

1. Keep current user-facing flows working during migration.
2. Remove direct feature development on top of raw `client.http.authedRequest` unless the SDK truly has no matching manager or method.
3. Converge all SDK imports behind one local adapter boundary in `hula`.
4. Make integration reproducible in CI and verifiable against a fixed local SDK commit.

## 5.3 Progressive Reintegration Phases

### Phase 0. Baseline alignment

- set team and CI Node version to `>=22.12.0`
- document required pnpm version `>=10`
- record the exact local SDK commit SHA used by `hula`
- rebuild both repos from a clean state
- run `pnpm check:sdk-types`, `pnpm test:run`, `pnpm test:e2e`, `pnpm metrics:bundle`

Exit criteria:

- `hula` and `matrix-js-sdk` install/build consistently under Node 22
- current baseline metrics and failure inventory are captured

### Phase 1. Introduce SDK compatibility boundary

Create a dedicated SDK integration boundary in `hula`, for example:

- `src/services/matrix/sdk-entry.ts`
- `src/services/matrix/sdk-compat.ts`
- `src/services/matrix/sdk-errors.ts`

Responsibilities:

- re-export approved SDK public entrypoints
- isolate subpath imports such as `src/manager-extensions` and `src/telemetry`
- normalize SDK error types into frontend-safe app errors
- expose capability detection helpers

Exit criteria:

- components and stores stop importing `matrix-js-sdk` directly
- all direct SDK imports come from one service boundary

### Phase 2. Reduce type augmentation debt

- audit every declaration in `src/types/matrix-js-sdk-augmentations.d.ts`
- classify each declaration as:
  - already exported by SDK
  - still needed temporarily
  - should be moved to local wrapper types
  - should be removed
- keep a minimal augmentation file only for short-term compatibility

Exit criteria:

- augmentation file shrinks materially
- any retained declaration has an owner and removal target

### Phase 3. Capability-domain migration

Migrate service-by-service in this order:

1. auth/session
2. user/profile/device/presence
3. room/timeline/message/reaction/thread/receipt
4. crypto/key backup/verification
5. notifications/push
6. space/admin/media/synapse extensions

For each domain:

- replace raw `authedRequest` where a manager or public SDK API now exists
- route unsupported calls through one lightweight API layer
- update tests and acceptance matrix

### Phase 4. Build and packaging hardening

Because `link:../matrix-js-sdk` is convenient in local dev but not reproducible enough for release validation, use dual-mode integration:

- local development: keep `link:../matrix-js-sdk`
- release/integration verification: use a packed tarball from a pinned SDK commit

Recommended release flow:

```bash
cd /Users/ljf/Desktop/hu_ts/matrix-js-sdk
pnpm install
pnpm build
pnpm pack

cd /Users/ljf/Desktop/hu_ts/hula
pnpm add file:../matrix-js-sdk/matrix-js-sdk-<version>.tgz
```

Exit criteria:

- local dev remains fast
- release verification uses a reproducible SDK artifact

### Phase 5. Governance gates

Add or extend CI checks so that:

- `check:sdk-types` is mandatory
- direct forbidden imports from `matrix-js-sdk/src/*` outside the adapter boundary fail CI
- newly added direct `authedRequest` calls fail CI unless explicitly allowlisted
- bundle and startup regressions are compared against baseline

## 5.4 Backward Compatibility Strategy

To keep rollout safe:

1. retain current service method signatures wherever possible
2. add adapter methods that map old return shapes to new typed SDK results
3. use feature flags for high-risk domains:
   - `VITE_MATRIX_SDK_MODE=legacy|hybrid|next`
4. cut migration by capability domain, not by arbitrary file batches
5. keep one release branch pinned to the old SDK integration point until Phase 3 stabilizes

## 6. Backend Interaction Implementation Specification

## 6.1 Interaction Layering Standard

All frontend-backend interaction must follow this order:

### Layer 1. SDK manager or official SDK method

Use when the capability already exists in local `matrix-js-sdk`.

Examples:

- auth/session
- room list and timeline
- profile and account data
- typing, receipt, reaction, thread
- key backup, verification, dehydrated device
- push and notification settings
- space and admin managers if already exported

### Layer 2. Lightweight API layer

Use only when the SDK does not yet cover the capability.

This layer must:

- use `getRuntimeAwareFetch()` or a single transport wrapper based on it
- encode path/query/auth exactly per backend contract
- normalize errors into typed app-level HTTP errors
- be grouped by domain, for example:
  - `src/services/api/core/transport.ts`
  - `src/services/api/matrix-admin.ts`
  - `src/services/api/synapse-extensions.ts`
  - `src/services/api/ai.ts`

### Layer 3. Tauri command bridge

Use only for local-native capabilities:

- token storage
- secure key material
- database switch and local SQLite
- local file system
- OS notifications
- native device integration

No Matrix homeserver API call should go through Tauri unless the purpose is explicitly native-only.

## 6.2 Domain Inventory And Recommended Ownership

| Domain                                     | Current module area                          | Preferred transport after optimization                                                   | Priority |
| ------------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| Auth and session                           | `services/matrix/auth/*`                     | SDK auth methods first, fallback API only for uncovered login variants                   | P0       |
| Client lifecycle and sync                  | `MatrixClientService`, `sync/*`, worker      | SDK client + sliding sync + IndexedDB store                                              | P0       |
| User/profile/device/presence               | `user/*`                                     | SDK methods and user/device managers                                                     | P0       |
| Messaging/timeline/thread/reaction/receipt | `messaging/*`, `room/TimelineService.ts`     | SDK managers first                                                                       | P0       |
| Room/space/account data/tags/pins          | `room/*`                                     | SDK managers first, fallback for custom extension endpoints                              | P0       |
| Crypto and backup                          | `crypto/*`                                   | SDK crypto managers first                                                                | P0       |
| Notifications and push                     | `notifications/*`                            | SDK managers first                                                                       | P1       |
| Media/voice/beacon/location/preview        | `media/*`                                    | SDK media APIs first, fallback API for preview or custom processing                      | P1       |
| Admin and moderation                       | `admin/*`, `SynapseRustExtensionsService.ts` | SDK admin managers where available, unified API layer for remaining Synapse admin routes | P1       |
| AI/OpenClaw/TrendRadar/SiliconFlow         | `services/*` outside matrix core             | dedicated API layer, never mixed into Matrix transport helpers                           | P1       |
| Discovery/config                           | `services/discovery/*`, `services/backend/*` | unified config/discovery transport                                                       | P1       |

## 6.3 Raw Transport Governance

### Forbidden by default

- adding new plain `fetch()` calls directly in views, stores, or arbitrary composables
- adding new `client.http.authedRequest()` outside the SDK adapter or approved service domain file
- constructing Matrix URL strings inline in components

### Required for any fallback API call

Each fallback method must define:

- request DTO
- response DTO
- auth mode: `user`, `admin`, `optional`, `none`
- path parameters
- query parameters
- idempotency/retry policy
- error mapping
- cache policy

## 6.4 Unified Error Handling Standard

Create one app-facing error contract:

- `AppSdkError`
- `AppApiError`
- `AppAuthError`
- `AppValidationError`
- `AppRetryableError`

Mapping rules:

- SDK typed errors -> preserve category and metadata
- HTTP fallback errors -> normalize into the same surface
- Tauri invoke failures -> normalize into local/native error category

UI behavior rules:

- auth errors -> logout or re-auth guidance
- validation errors -> inline form feedback
- retryable errors -> user-facing retry affordance and telemetry logging
- fatal errors -> global message + error tracker + operation id

## 6.5 Unified Loading State Standard

Avoid ad hoc booleans such as `loading`, `isLoading`, `submitting`, `pending` with inconsistent semantics.

Use one request state model per operation:

- `idle`
- `loading`
- `success`
- `error`

For list pages, track:

- `initialLoading`
- `refreshing`
- `loadingMore`
- `empty`
- `error`

For mutation pages, track:

- `submitting`
- `submitSuccess`
- `submitError`

## 6.6 Unified Data Cache Strategy

| Data type                | Recommended cache layer                     | Policy                                  |
| ------------------------ | ------------------------------------------- | --------------------------------------- |
| Matrix sync/timeline     | SDK `IndexedDBStore`                        | long-lived, invalidated on logout/reset |
| volatile request results | `MatrixCacheManager` or domain memory cache | short TTL, 30s to 5m                    |
| user/session preferences | Pinia persisted state                       | explicit schema ownership               |
| heavy media metadata     | IndexedDB or app data store                 | bounded size, LRU or explicit cleanup   |
| admin dashboards         | memory cache only                           | short TTL, no persisted sensitive data  |
| auth tokens              | Tauri secure persistence only               | never browser localStorage              |

Additional rules:

- do not persist business-critical room/timeline state in random localStorage keys
- do not persist secrets in Pinia/localStorage
- every persisted store must define versioned migration behavior

## 7. UI Interface Function Matrix

This matrix is organized by route-facing screens rather than by leaf component file. Priority uses:

- `P0`: release blocking core flow
- `P1`: important but not release blocking
- `P2`: enhancement or secondary workflow

## 7.1 Desktop Screens

| Screen group              | Route or file area                                                                     | Core functions                                                                                                                             | Priority | Dependencies                                                             | Acceptance and tests                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Login and session entry   | `loginWindow/*`, `registerWindow`, `forgetPasswordWindow`, agreements                  | password login, QR login, OIDC callback, third-party login, homeserver config, session resume, logout cleanup                              | P0       | backend config, auth service, runtime session service, Tauri token store | login success, wrong password path, QR confirm path, logout cleanup, session restore after restart        |
| Main message workbench    | `/message`, `homeWindow/message/*`                                                     | room list entry, timeline render, send/edit/reply/recall, thread, typing, read receipt, reconnect handling                                 | P0       | matrix client, sync, room/timeline/message services                      | large room load, offline-reconnect, send failure retry, thread render, unread state correctness           |
| Friends and contacts      | `/friendsList`, `friendWindow/*`                                                       | contact list, search friend, add friend/group, verify flow, direct chat entry                                                              | P0       | user directory, contacts, DM services                                    | search, add request, accept/decline, direct room creation                                                 |
| Room and space navigation | `/roomList`, `/spaceList`, `/space/create`, `/space/:roomId?`                          | room filtering, grouping, space workbench, create/join space, navigation state                                                             | P0       | room list, space service, account data, tags                             | space create/join works, route redirect works, room hierarchy displayed correctly                         |
| Settings center           | `/settings` plus tab redirects                                                         | account, sessions, appearance, preferences, notifications, keyboard, security/privacy, encryption, labs, Mjolnir, voice/video, help        | P0       | user/profile/device/crypto/push/settings stores                          | each tab loads independently, save persists, validation errors visible, mobile parity where applicable    |
| Secret and RTC flows      | `/secretChat`, `/rtcCall`, `/sharedScreen`, `callWindow`, `LockScreen`                 | secret chat gating, call lifecycle, screen share, lock/unlock flow                                                                         | P1       | crypto, voip/media, Tauri, settings                                      | join/leave call, permission denial path, secret lock timeout, screen share failover                       |
| History and announcements | `/chat-history`, `/announList/:roomId/:type`, `Notify.vue`                             | search history, announcement CRUD/view, notification rendering                                                                             | P1       | timeline, announcement, notification services                            | history query, announcement add/edit/delete, unread sync                                                  |
| File and media windows    | `/fileManager`, `/previewFile`, image/video viewer windows, `Capture.vue`              | file list, preview, download/upload, media viewer, capture                                                                                 | P1       | Tauri fs, media services, upload service                                 | open preview, download path success, unsupported file fallback, large file cancel                         |
| Dynamic, AI, robot, mail  | `/dynamic`, `/dynamic/:id`, `/trendradar`, `/openclaw`, `/robot`, `/mail`              | feed, detail, AI assistant, plugin data flow, mail integration                                                                             | P1       | dedicated API layer, auth session, plugin settings                       | list/detail success, auth failure path, rate limit handling, empty state                                  |
| App shell and utilities   | `/about`, `/onlineStatus`, `Tray.vue`, `CheckUpdate.vue`, `Update.vue`, `NotFound.vue` | app status, update prompt, tray interaction, fallback navigation                                                                           | P2       | updater, presence, router, shell bridge                                  | update check prompt, tray show/hide, 404 routing                                                          |
| Admin console             | `/admin/*`                                                                             | dashboard, users, rooms, federation, notices, registration tokens, security, audit, retention, logs, federation monitor, saml, maintenance | P1       | admin services, capability checks, auth guard                            | requires admin guard, list/detail works, unauthorized access blocked, destructive action confirm required |

## 7.2 Desktop Settings Tabs Detailed Checklist

| Tab                           | Required functions                                           | Priority | Acceptance focus                                            |
| ----------------------------- | ------------------------------------------------------------ | -------- | ----------------------------------------------------------- |
| Account                       | profile, avatar, account identifiers, linked account info    | P0       | update profile and re-render immediately                    |
| Sessions                      | device/session list, sign-out others, current device marker  | P0       | list accuracy and destructive action confirmation           |
| Appearance                    | theme, font, blur/shadow, system theme sync                  | P1       | settings persist and reflect without restart where possible |
| Preferences                   | read receipt, typing, thread, space defaults, emoji behavior | P0       | save and restore across relaunch                            |
| Notifications / Push          | sound, badge, push rule preferences                          | P0       | server and local settings align                             |
| Keyboard                      | shortcuts, global shortcut enablement                        | P1       | conflict detection and Tauri registration                   |
| Security / Privacy            | lock screen, privacy, secret chat options                    | P0       | password/timeout validation and lock flow                   |
| Encryption                    | E2EE state, backup status, verification entry                | P0       | bootstrap, recovery, and failure guidance                   |
| Burn After Read               | enable, default duration, countdown visibility               | P1       | new messages follow selected default                        |
| Voice / Video                 | device selection, mic/camera checks                          | P1       | device permission denial handled                            |
| Labs / Integrations / Mjolnir | experimental switches, integrations, moderation tools        | P1       | explicit warnings and isolated failure handling             |
| Help / About                  | diagnostics, version, support links                          | P2       | version and logs export available                           |

## 7.3 Mobile Screens

| Screen group                | Route or file area                                                                                   | Core functions                                                         | Priority                                                                 | Dependencies                                                                     | Acceptance and tests                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Mobile bootstrap and auth   | `/mobile/login`, `/mobile/splashscreen`, `/mobile/syncData`, agreements, QR confirm, forget password | P0                                                                     | platform bootstrap, auth service, session restore, barcode/QR capability | cold start, sync progress, login failure, QR confirm, permission denial          | <br />                                                               |
| Mobile home tabs            | `/mobile/message`, `/mobile/friends`, `/mobile/my`, `/mobile/dynamic`                                | P0                                                                     | router, tab shell, sync state, base stores                               | tab switch, persisted state, background restore                                  | <br />                                                               |
| Mobile chat room            | `/mobile/chatRoom/*`                                                                                 | timeline, send, thread, search, media viewer, members, invite, notices | P0                                                                       | message services, room services, media, typing, receipts                         | send, scroll restoration, pagination, member management, notice CRUD |
| Mobile friend workflows     | `/mobile/mobileFriends/*`, `/mobile/myQRCode`, `/mobile/addGroupQRCode`                              | P0                                                                     | user directory, contacts, QR, group invite                               | add friend/group, QR entry, friend detail                                        | <br />                                                               |
| Mobile profile and settings | `/mobile/mobileMy/*`, `/mobile/encryption`, `/mobile/space`                                          | P0                                                                     | user store, settings store, crypto, device, homeserver settings          | edit profile, open settings, device management, encryption bootstrap, files page | <br />                                                               |
| Mobile admin                | `/mobile/admin/*`                                                                                    | admin dashboard and admin entities on mobile                           | P1                                                                       | admin services, auth/capability checks                                           | unauthorized blocked, list pages responsive                          |
| Mobile RTC and media        | `/mobile/rtcCall`, chat media preview, image/video components                                        | P1                                                                     | Tauri/mobile capabilities, media services                                | join/leave call, preview, permission failure                                     | <br />                                                               |
| Mobile AI and plugins       | `my/AiAssistant.vue`, dynamic detail, widget manager                                                 | P1                                                                     | dedicated API layer, plugin config, auth state                           | request lifecycle, offline/error states, feature flag control                    | <br />                                                               |

## 7.4 Cross-Screen Dependency Order

Implementation should follow this dependency order:

1. session/bootstrap
2. matrix client lifecycle and sync
3. message/room/space/friends core flows
4. user profile/device/settings
5. crypto and backup
6. notifications and media
7. admin and extensions
8. AI/plugin surfaces

## 7.5 Recommended Test Matrix

| Test level  | Scope                                              | Required examples                                                                    |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Unit        | services, stores, utilities                        | auth/session restore, typed error mapping, settings migration, cache cleanup helpers |
| Component   | high-value views and settings tabs                 | login form, settings save, admin list states, message composer states                |
| Integration | service + store + mock SDK                         | room load, send message, restore session, key backup bootstrap                       |
| E2E desktop | main workbench and settings                        | login -> sync -> chat -> logout, update prompt, admin access guard                   |
| E2E mobile  | login, tab navigation, chat room, profile settings | startup sync, chat send, add friend, settings persistence                            |
| Performance | startup, room list, timeline, bundle               | baseline compare against thresholds                                                  |

## 8. Main Workbench Optimization Plan

## 8.1 Performance Optimization

### Objective

Reduce cold-start and main-workbench first-render time while preserving stability.

### Measures

1. Move all high-cost SDK boot decisions behind explicit session/bootstrap stages.
2. Make worker ownership explicit:
   - main thread owns app shell and lightweight session bootstrap
   - worker owns selected high-cost sync/timeline processing if the worker path is kept
3. Delay non-critical modules:
   - TrendRadar
   - OpenClaw
   - Story-like dynamic modules
   - optional admin panels
4. Split settings tabs and plugin-heavy routes into finer lazy chunks.
5. Avoid duplicate initialization of client, sync listeners, and room subscriptions.
6. Reassess `IndexedDBStore` startup and restore timing under Node 22 + new SDK.
7. Introduce room-list and timeline performance budgets:
   - first visible room list render
   - first active room timeline render
   - large room pagination latency

### Concrete implementation tasks

- audit duplicated client creation between main thread and worker
- centralize `startClient()` ownership
- lazy-load admin and AI routes only after auth success
- defer secondary stores and plugin setup until after `router.isReady()`
- reduce synchronous work in `App.vue` and root layout

## 8.2 User Experience Optimization

### Objectives

- reduce uncertainty during startup and sync
- reduce friction in session recovery and reconnection
- improve visibility of loading, retry, and failure states

### Measures

1. Standardize skeleton, empty, error, and retry components across desktop and mobile.
2. Show explicit sync stage status during boot and session restore.
3. Improve network configuration affordance on login and recovery paths.
4. Add clearer action feedback for destructive admin and session actions.
5. Improve consistency of settings copy, validation, and save feedback.
6. For timeline-heavy screens, preserve scroll position and selection more reliably.

## 8.3 Code Structure Optimization

### Objectives

- make service ownership obvious
- make route-level capability boundaries explicit
- reduce cross-layer imports

### Measures

1. Enforce import layering:
   - views -> composables/stores/services
   - stores -> services
   - services -> sdk/api/tauri adapters
2. Split `MatrixClientService` into smaller collaborators if needed:
   - client factory
   - session bootstrap
   - sync lifecycle
   - telemetry hook
3. Introduce a dedicated `api/` directory for non-SDK network calls.
4. Move migration logic out of large store files into versioned migration helpers.
5. Keep route metadata close to capability checks.

## 9. Implementation Roadmap And Timeline

Assuming one frontend engineer plus one reviewer, use a six-week implementation window.

| Week   | Phase                                   | Main output                                                                          |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------------ |
| Week 1 | Baseline and cleanup                    | clean scripts, Node 22 alignment, current metric capture, forbidden import inventory |
| Week 2 | SDK compatibility boundary              | adapter entry, import convergence, initial error mapping                             |
| Week 3 | Core flow migration                     | auth, session, user, room, message, space core domains                               |
| Week 4 | Crypto and settings                     | backup, verification, device/session, settings tab alignment                         |
| Week 5 | Admin/media/extensions                  | admin API layer, media cleanup, AI/plugin transport separation                       |
| Week 6 | Performance hardening and release check | benchmark rerun, E2E rerun, docs refresh, rollback package and sign-off              |

## 10. Risks And Mitigation

| Risk                                            | Likelihood | Impact | Mitigation                                                                  |
| ----------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------- |
| Node 22 rollout breaks existing local tooling   | Medium     | High   | publish upgrade note, `.nvmrc` or Volta config, CI first                    |
| SDK subpath behavior changes                    | Medium     | High   | isolate in adapter layer, freeze SDK commit per sprint                      |
| auth/session migration causes login regressions | Medium     | High   | migrate auth first, keep legacy fallback, add E2E gate                      |
| cache reset removes needed forensic data        | Low        | Medium | separate safe vs hard cleanup, require explicit confirmation for hard reset |
| admin route differences between SDK and backend | Medium     | Medium | use fallback API layer with exact contract mapping                          |
| worker changes introduce sync divergence        | Medium     | Medium | benchmark and compare before enabling worker ownership changes              |

## 11. Rollback Plan

Rollback must be possible at the end of every phase.

### Rollback assets

1. pinned SDK commit SHA
2. packed SDK tarball from the previous known-good version
3. `legacy` feature-flag mode
4. pre-migration branch tag
5. baseline test and metric report

### Rollback rules

- If Phase 1 fails: keep existing import surface and only land Node/build alignment.
- If Phase 2 or 3 fails: switch feature flag back to `legacy` or `hybrid`.
- If release validation fails: replace linked SDK with last-known-good tarball and rerun smoke tests.
- If runtime state corruption is detected: run hard reset, clear app data, and restore the previous release branch.

## 12. Performance Benchmark Sheet

Current document provides the benchmark framework. Actual values must be collected in Week 1 and rerun in Week 6.

| Metric                             | Current baseline | Target                  | After optimization | Collection method                        |
| ---------------------------------- | ---------------- | ----------------------- | ------------------ | ---------------------------------------- |
| `hula-total-boot`                  | TBD              | -20% or better          | TBD                | `performance.measure` from `src/main.ts` |
| `hula-mount-to-ready`              | TBD              | -20% or better          | TBD                | `performance.measure` from `src/main.ts` |
| first login restore usable time    | TBD              | -25% or better          | TBD                | custom timing around session restore     |
| first room list visible            | TBD              | -20% or better          | TBD                | route-level perf mark                    |
| first active room timeline visible | TBD              | -20% or better          | TBD                | route-level perf mark                    |
| desktop JS bundle size             | TBD              | no growth, ideally -10% | TBD                | `pnpm metrics:bundle`                    |
| mobile JS bundle size              | TBD              | no growth, ideally -10% | TBD                | `pnpm metrics:bundle`                    |
| large room scroll frame drops      | TBD              | < baseline              | TBD                | performance profile run                  |

## 13. Test Report Template

Use the following template for each optimization phase and for final acceptance.

```md
# HuLa Optimization Test Report

## 1. Scope

- Phase:
- Branch:
- SDK commit:
- Test date:
- Tester:

## 2. Environment

- OS:
- Node:
- pnpm:
- HuLa commit:
- matrix-js-sdk package mode: link / tarball
- Backend profile:

## 3. Functional Results

| Area      | Case                    | Result    | Notes |
| --------- | ----------------------- | --------- | ----- |
| Auth      | Password login          | PASS/FAIL |       |
| Auth      | QR login                | PASS/FAIL |       |
| Session   | Restore session         | PASS/FAIL |       |
| Messaging | Send text               | PASS/FAIL |       |
| Messaging | Thread/reaction/receipt | PASS/FAIL |       |
| Space     | Space open/create/join  | PASS/FAIL |       |
| Settings  | Save and restore        | PASS/FAIL |       |
| Crypto    | Key backup/verification | PASS/FAIL |       |
| Admin     | Guard + list operations | PASS/FAIL |       |
| Mobile    | Tab/chat/settings flow  | PASS/FAIL |       |

## 4. Performance Results

| Metric                  | Before | After | Delta | Status |
| ----------------------- | ------ | ----- | ----- | ------ |
| hula-total-boot         |        |       |       |        |
| hula-mount-to-ready     |        |       |       |        |
| first room list visible |        |       |       |        |
| first timeline visible  |        |       |       |        |
| desktop bundle          |        |       |       |        |
| mobile bundle           |        |       |       |        |

## 5. Error Inventory

- SDK integration errors:
- API fallback errors:
- Tauri bridge errors:
- Known non-blockers:

## 6. Cache And Reset Validation

- Safe cleanup verified:
- Hard cleanup verified:
- Session restore after cleanup:

## 7. Regression Decision

- Release ready:
- Rollback required:
- Follow-up issues:
```

## 14. Final Deliverables

This optimization program should produce the following deliverables:

1. this master plan document
2. cleanup scripts and reset instructions
3. SDK integration compatibility boundary
4. backend interaction inventory and fallback API layer
5. UI acceptance matrix and route ownership mapping
6. baseline and post-optimization metric reports
7. test reports for desktop and mobile
8. rollback package with pinned SDK artifact

## 15. Recommended Immediate Next Actions

1. unify all environments to Node 22.12+ [DONE]
2. add the SDK compatibility boundary and forbid new direct `matrix-js-sdk/src/*` imports outside it [DONE]
3. create a transport inventory for all existing `authedRequest` and `fetch` sites [IN PROGRESS]
4. implement safe and hard cleanup scripts [DONE]
5. run baseline metrics and fill Section 12 with actual numbers [PENDING]

***

# Part B. Authoritative Integration Specification

The sections below (§16–§20) are normative. They are the contract between the
HuLa frontend, the local `matrix-js-sdk` package, and the `synapse-rust`
homeserver. Anything in §1–§15 above is governance/process context;
anything in §16–§20 is implementation truth and acceptance gating.

Cross-repo references used throughout:

- Backend: `/Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/`
- SDK ledger: `/Users/ljf/Desktop/hu_ts/matrix-js-sdk/docs/api-contract/generated/index.json` (49 modules / 1192 default-profile entries / 50 governed doc pages)
- SDK source: `/Users/ljf/Desktop/hu_ts/matrix-js-sdk/src/` (261 entries; 32 entrypoints in `package.json#exports`)
- Frontend: `/Users/ljf/Desktop/hu_ts/hula/src/`

## 16. Frontend ↔ SDK Integration: End-to-End Technical Plan

### 16.1 Installation and Pinning [DONE]

#### 16.1.1 Toolchain baseline (mandatory) [DONE]

| Tool   | Required                           | Detection                                                              | Failure mode                            |
| ------ | ---------------------------------- | ---------------------------------------------------------------------- | --------------------------------------- |
| Node   | `>=22.12.0 <25`                    | `engines.node` in `hula/package.json` and `matrix-js-sdk/package.json` | `pnpm install` aborts with `EBADENGINE` |
| pnpm   | `>=10.0.0`                         | `engines.pnpm` + `packageManager` field                                | `corepack` rejects mismatched binary    |
| Rust   | latest stable, edition 2024        | `rust-toolchain.toml`                                                  | `cargo build` fails fast                |
| Python | 3.11+ (only for backend dev hooks) | optional                                                               | <br />                                  |

`hula` MUST publish `.nvmrc` (`22.12.0`) and `package.json#packageManager` (`pnpm@10.x.y`); CI MUST `corepack enable` before any pnpm command. The backend DEV image MUST be built from the same Node major to keep contract-sync reproducible.

#### 16.1.2 Two-mode SDK consumption [DONE]

| Mode                                    | When                               | `package.json` form                                                           | Reproducibility   | Lockfile entry           |
| --------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- | ----------------- | ------------------------ |
| **Linked** (dev)                        | local development, fast inner loop | `"matrix-js-sdk": "link:../matrix-js-sdk"`                                    | low (live edits)  | `link:../matrix-js-sdk`  |
| **Tarball-pinned** (release verify, CI) | release branch, perf gate, E2E     | `"matrix-js-sdk": "file:../matrix-js-sdk/matrix-js-sdk-<ver>+sha.<sha7>.tgz"` | high (byte-exact) | tarball + integrity hash |
| **Registry** (future)                   | once SDK is published              | `"matrix-js-sdk": "<exact-version>"`                                          | high              | resolved + integrity     |

CI MUST refuse to merge a release branch where SDK mode is `link:`. The forbidden import scanner (§16.7) MUST emit a non-zero exit if mode is `link:` while branch matches `release/*`.

#### 16.1.3 Frozen-commit policy [DONE]

Every release branch MUST embed `meta/sdk-pin.json`:

```json
{
  "sdk_commit": "<full-sha>",
  "sdk_version": "<semver>",
  "ledger_schema": "1",
  "synapse_rust_commit": "<full-sha>",
  "pinned_at": "2026-05-03T18:00:00Z",
  "pinned_by": "<release-engineer>",
  "tarball_sha256": "sha256-<hex>"
}
```

`pnpm verify:sdk-pin` (added in §16.7) compares this file against the actually installed SDK and fails if either commit or tarball hash differs.

### 16.2 Initialization Parameters

#### 16.2.1 `MatrixClientService.create()` — canonical signature

```ts
interface MatrixClientCreateOptions {
  baseUrl: string // VITE_HOMESERVER_URL or runtime override
  accessToken?: string // restored from Tauri secure store
  refreshToken?: string
  userId?: string
  deviceId?: string
  store: IndexedDBStore // hula-matrix-sync DB, see §16.6
  cryptoStore: IndexedDBCryptoStore // separate DB
  timelineSupport: true
  useAuthorizationHeader: true
  fetchFn: typeof getRuntimeAwareFetch // §16.3.4
  logger: HulaLogger // wraps @tauri-apps/plugin-log
  retryOptions: BaseManagerRetryOptions // §16.5.4
  throwOnError: true // mandated by HuLa
  sdkMode: 'legacy' | 'hybrid' | 'next' // VITE_MATRIX_SDK_MODE feature flag
}
```

Hard rules:

- `baseUrl` MUST be normalized to `https://` in production builds; `http://localhost:*` is permitted only when `import.meta.env.DEV` is true.
- `accessToken` MUST never be read from `localStorage`. The bootstrap path is **Tauri secure store → in-memory → SDK options**. Browser-only fallback during web preview MUST set a session-scoped flag and refuse encryption operations.
- `fetchFn` MUST be the unified transport (§16.3.4). Passing `globalThis.fetch` directly is a CI-blocked anti-pattern.
- `throwOnError: true` is required; `MatrixCacheManager` and `MatrixRequestDeduper` rely on rejected promises for invalidation.

#### 16.2.2 Initialization sequence

```text
1. App boot                              src/main.ts
   ├─ register Pinia + persisted plugin
   ├─ register router (no SDK yet)
   └─ mount <App> with route guard "auth-pending"

2. Auth probe                            services/matrix/auth/MatrixSessionService
   ├─ read Tauri secure store           (invoke('app_state_get_session'))
   ├─ if missing → redirect /login       (no SDK)
   └─ if present → continue

3. SDK bootstrap                         services/matrix/MatrixClientService
   ├─ open IndexedDBStore('hula-matrix-sync')
   ├─ open IndexedDBCryptoStore('hula-matrix-crypto')
   ├─ createClient({ ...options })
   ├─ initRustCrypto()                   (E2EE)
   ├─ install manager extensions         (matrix-js-sdk/manager-extensions)
   └─ emit perf mark "hula-sdk-ready"

4. Sliding-sync start                    services/matrix/sync/MatrixSlidingSyncService
   ├─ subscribe lists: invites, rooms, dms
   ├─ startClient({ initialSyncLimit: 20, lazyLoadMembers: true })
   └─ emit perf mark "hula-first-sync"

5. Route guards lifted                   router/guards.ts
   └─ user lands on /message
```

Every step MUST emit `performance.mark()`. Steps 3 + 4 MUST be wrapped in `requestIdleCallback` for the lazy-load case (cold launch from system tray) but execute eagerly on direct `/login → /message` flow.

### 16.3 Environment Stratification

#### 16.3.1 Environment matrix

| Env          | Backend URL                    | SDK mode                | Crypto      | Logging             | Source maps | Telemetry endpoint |
| ------------ | ------------------------------ | ----------------------- | ----------- | ------------------- | ----------- | ------------------ |
| `dev-local`  | `http://localhost:8008`        | `link:`                 | rust-crypto | console + tauri-log | inline      | disabled           |
| `dev-shared` | `https://staging.hula.local`   | `tarball`               | rust-crypto | tauri-log           | external    | staging            |
| `qa`         | `https://qa.hula.example`      | `tarball`               | rust-crypto | tauri-log + remote  | external    | qa                 |
| `preprod`    | `https://preprod.hula.example` | `tarball` (release-pin) | rust-crypto | remote only         | external    | preprod            |
| `prod`       | `https://api.hula.example`     | `tarball` (release-pin) | rust-crypto | remote only         | external    | prod               |

Selection is driven by `VITE_HULA_ENV` (build-time) merged with `app_state_get_runtime_config` (Tauri runtime override). The runtime override wins so QA can repoint a release build at preprod without rebuilding.

#### 16.3.2 `.env` schema (validated at build time by `build/validateEnv.ts`)

```ini
# Required
VITE_HULA_ENV=dev-local|dev-shared|qa|preprod|prod
VITE_HOMESERVER_URL=https://...
VITE_APP_NAME=HuLa

# SDK governance
VITE_MATRIX_SDK_MODE=legacy|hybrid|next
VITE_MATRIX_SDK_COMMIT=<sha>           # injected by CI

# Feature flags
VITE_FF_VOIP=on|off
VITE_FF_E2EE_BACKUP=on|off
VITE_FF_ADMIN_CONSOLE=on|off
VITE_FF_AI_OPENCLAW=on|off

# Telemetry / observability
VITE_TELEMETRY_DSN=https://...
VITE_TELEMETRY_SAMPLE_RATE=0.1
VITE_PERF_BUDGET_PROFILE=desktop|mobile

# Optional
VITE_PC_URL=
VITE_SERVICE_URL=
```

Build MUST fail if a value is missing in `qa`/`preprod`/`prod` and MUST refuse to ship if `VITE_TELEMETRY_DSN` is unset on `prod`.

#### 16.3.3 Tauri-side runtime config (precedence over build-time)

```rust
// src-tauri/src/command/app_state_command.rs
#[tauri::command]
pub async fn app_state_get_runtime_config() -> RuntimeConfig {
    RuntimeConfig {
        homeserver_url: stored_or_default(),  // re-pointable in QA
        sdk_mode: stored_sdk_mode(),
        feature_flags: stored_flags(),
        telemetry_endpoint: stored_telemetry_endpoint(),
    }
}
```

Frontend MUST read this **before** SDK bootstrap. Cached values MUST be invalidated on logout.

#### 16.3.4 Unified transport — `getRuntimeAwareFetch` [DONE]

`src/services/matrix/network/getRuntimeAwareFetch.ts` (implemented in `runtimeFetch.ts`) is the **only** non-SDK HTTP entrypoint allowed in the codebase. It:

1. Selects between `tauri-plugin-http` (desktop/mobile) and `globalThis.fetch` (web preview).
2. Injects `Authorization: Bearer <token>` from in-memory token store (never localStorage).
3. Adds `X-Hula-Client-Version`, `X-Hula-Trace-Id`, `X-Hula-Env` headers.
4. Applies the same retry/backoff policy as `BaseManager` (§16.5.4).
5. Surfaces typed errors via `normalizeTransportError()`.
6. Emits a perf entry per request to `PerformanceReporter`.

ESLint rule `no-restricted-imports` blocks `node-fetch`, `axios`, and `cross-fetch`. The custom rule `hula/no-bare-fetch` flags any `fetch(` call outside this file.

### 16.4 Build-time Optimization

#### 16.4.1 Bundle splitting (Vite + Rollup `manualChunks`)

| Chunk               | Contents                                                        | Loading strategy         | Hard size budget |
| ------------------- | --------------------------------------------------------------- | ------------------------ | ---------------- |
| `vendor-vue`        | `vue`, `vue-router`, `pinia`, `pinia-plugin-persistedstate`     | sync                     | ≤ 110 KB gzip    |
| `vendor-ui-desktop` | `naive-ui` (used routes only via tree-shake)                    | sync (desktop)           | ≤ 220 KB gzip    |
| `vendor-ui-mobile`  | `vant` (used components)                                        | sync (mobile)            | ≤ 180 KB gzip    |
| `vendor-sdk-core`   | `matrix-js-sdk` (client + http-api + models + sync-accumulator) | sync                     | ≤ 280 KB gzip    |
| `vendor-sdk-crypto` | `@matrix-org/matrix-sdk-crypto-wasm` + `matrix-js-sdk/crypto`   | async, post-login        | ≤ 480 KB gzip    |
| `vendor-sdk-admin`  | `matrix-js-sdk/admin`                                           | async (admin route only) | ≤ 90 KB gzip     |
| `vendor-sdk-voip`   | `matrix-js-sdk/webrtc`                                          | async (call route only)  | ≤ 70 KB gzip     |
| `feature-ai`        | OpenClaw / SiliconFlow / TrendRadar                             | async (route-triggered)  | ≤ 60 KB gzip     |
| `feature-admin`     | `views/admin/**`                                                | async + auth-gated       | ≤ 140 KB gzip    |
| `feature-mobile`    | `mobile/**`, `views/mobile*`                                    | async (mobile platform)  | ≤ 90 KB gzip     |
| `worker-matrix`     | `workers/matrixSdk.worker.ts` (separate bundle)                 | async on demand          | ≤ 180 KB gzip    |

Chunk definitions live in `build/chunks.ts`. `pnpm metrics:bundle` MUST emit a `bundle-budget.json` and fail CI when any chunk exceeds its budget by > 5%.

#### 16.4.2 Tree-shaking conditions

- `package.json#sideEffects` in SDK is `false` for non-style modules — the SDK is already shake-friendly. Frontend MUST import managers from their dedicated entrypoints (`matrix-js-sdk/admin`, not the barrel) so unused managers are eliminated.
- ESLint rule `import/no-named-as-default-member` is enforced.
- `vite-plugin-dts-bundle` is forbidden — type tree-shaking is irrelevant at build time.

#### 16.4.3 Dead-code budget

- Unused exports in `src/services/**` are detected by `knip --production` weekly; PRs that increase dead-code count > 10 lines fail CI.
- `import.meta.env.DEV` branches MUST be wrapped to allow Vite to dead-strip them in production.

#### 16.4.4 Compression and caching

- Output `.gz` (level 9) and `.br` (quality 11) per asset.
- HTML uses content-hashed asset URLs; service worker (when later introduced) versioned by `sdk_commit + frontend_commit`.
- Sourcemap policy: external `.map`, uploaded to telemetry vendor, NOT served to clients in `prod`.

### 16.5 Runtime Fallback / Degradation Strategy

#### 16.5.1 Degradation tiers

```
Tier A — Full SDK + Sliding-Sync + E2EE + Voice/Video
  ↓ if WASM crypto fails to load (CDN block, unsupported CPU)
Tier B — SDK + Sliding-Sync + plain text + voice fallback to text
  ↓ if Sliding-Sync endpoint returns 404 (upstream off)
Tier C — SDK + classic /sync + text only
  ↓ if classic /sync fails 5×
Tier D — read-only (cached IndexedDB) + offline queue
  ↓ if IndexedDB unavailable (private mode, quota)
Tier E — pure offline; allow drafts; block sends until reconnect
```

Each tier transition MUST:

1. Emit `hula.degradation.changed` telemetry event with `{ from, to, reason, retryable }`.
2. Update a Pinia store `useNetworkHealthStore` consumed by the global banner.
3. Schedule a healing probe at `[15s, 30s, 60s, 5m, 15m]` (capped exponential).

#### 16.5.2 SDK mode feature flag

```
VITE_MATRIX_SDK_MODE=
  legacy → forbid new managers, route through old service shim
  hybrid → use new managers where wired, fall back to shim
  next   → strict; any unwired call fails fast at dev time
```

Production releases ship in `next` mode. Hotfix branches MAY ship in `hybrid` for at most one minor.

#### 16.5.3 Capability detection (replace silent failures)

`MatrixCapabilityService` (already exists in repo) MUST be the gate before any optional-feature call. It owns:

- `/_matrix/client/versions` cache
- `/_matrix/client/v3/capabilities` cache (TTL 5 min, stale-while-revalidate)
- Synapse-rust extension probe endpoints
- Per-feature boolean getters: `canUseSlidingSync()`, `canUseE2EE()`, `canUseVoip()`, `canUseFriendList()`, `canUseAdminApi()`

Code that calls a capability without the gate fails the `hula/require-capability-gate` lint rule.

#### 16.5.4 Retry / backoff defaults (aligned with SDK `BaseManager`)

| Class                   | Method                  | Max attempts                 | Initial                 | Multiplier | Jitter | Total cap |
| ----------------------- | ----------------------- | ---------------------------- | ----------------------- | ---------- | ------ | --------- |
| Read (idempotent)       | GET                     | 4                            | 200 ms                  | 2.0        | ±30%   | 8 s       |
| Mutating-idempotent     | PUT with txn-id, DELETE | 3                            | 400 ms                  | 2.0        | ±30%   | 6 s       |
| Mutating-non-idempotent | POST without txn-id     | 1 (no retry)                 | —                       | —          | —      | —         |
| Auth                    | login/refresh           | 2                            | 500 ms                  | 1.5        | none   | 2 s       |
| Long-poll               | `/sync`, sliding-sync   | infinite (server-controlled) | per `wait_until` header | —          | —      | —         |

Honored response signals:

- `Retry-After` (seconds or HTTP-date) — overrides backoff, capped at 60 s.
- `M_LIMIT_EXCEEDED` errcode — treat as `RetryableError` even on 4xx.
- `Server-Timing` — recorded by `PerformanceReporter`.

#### 16.5.5 Offline queue

`OfflineQueueService` (already in `services/offline/`) wraps every send-message / send-event call:

- queue persisted to IndexedDB DB `hula-offline-queue`, store `pending`, key by `txn_id`
- max payload 4 MB per item; oversize spills to Tauri filesystem with metadata pointer
- replay strategy: drain on `online` event AND after each successful sync token tick
- duplicate suppression via SDK `transactionId` (server-side dedup)

## 17. SDK ↔ Backend Mapping (Authoritative)

This section is the **single source of truth** for how every frontend
operation reaches the backend. Discrepancies between this section and code
are bugs.

### 17.1 Module-to-prefix matrix

\| Synapse-rust module (`src/web/routes/`)                                           | URL prefix                                                                                         | SDK manager (`matrix-js-sdk/src/`)               | Generated module key                                               |
\| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------ | ---------------------------------- |
\| `auth_compat.rs`, `account_compat.rs`, `directory.rs`                             | `/_matrix/client/v3`                                                                               | `client-auth`, `auth/`, `account/`               | `assembly` (umbrella)                                              |
\| `account_data.rs`                                                                 | `/_matrix/client/v3/user/{userId}/account_data`                                                    | `account-data/`                                  | `account_data`                                                     |
\| `admin/`                                                                          | `/_synapse/admin/v1`/`v2`                                                                          | `admin/`                                         | `admin`                                                            |
\| `dm.rs`                                                                           | `/_matrix/client/v3/dm`                                                                            | `dm/`                                            | `dm`                                                               |
\| `friend_room.rs`                                                                  | `/_synapse/client/v1/friend`                                                                       | `friend/` (manager extension)                    | `friend_room`                                                      |
\| `room.rs`, `room_summary.rs`                                                      | `/_matrix/client/v3/rooms/{roomId}` + `/_matrix/client/v1/room_summary`                            | `models/room`, `room-summary/`                   | `room`, `room_summary`                                             |
\| `sync.rs` + `sliding_sync.rs`                                                     | `/_matrix/client/v3/sync` + `/_matrix/client/unstable/org.matrix.msc3575/sync`                     | `sliding-sync/`, `sync.ts`                       | `sync`, `sliding_sync`                                             |
\| `space.rs`                                                                        | `/_matrix/client/v1/rooms/{roomId}/hierarchy`                                                      | `space/`                                         | `space`                                                            |
\| `e2ee_routes.rs`, `key_backup.rs`, `key_rotation.rs`, `verification_routes.rs`    | `/_matrix/client/v3/keys/*`, `/room_keys/*`                                                        | `crypto/`, `key-backup/`, `secure-backup/`       | `e2ee_routes`, `key_backup`, `key_rotation`, `verification_routes` |
\| `media.rs`                                                                        | `/_matrix/media/v3`, `/_matrix/client/v1/media`                                                    | `http-api/` (media subset)                       | `media`                                                            |
\| `push.rs`, `push_notification.rs`, `push_rules.rs`                                | `/_matrix/client/v3/pushrules`, `/_matrix/client/v3/notifications`                                 | `push/`, `notifications/`                        | `push`, `push_notification`                                        |
\| `presence.rs`                                                                     | `/_matrix/client/v3/presence/{userId}/status`                                                      | `user-presence/`                                 | `presence`                                                         |
\| `typing.rs` (in assembly)                                                         | `/_matrix/client/v3/rooms/{roomId}/typing/{userId}`                                                | `typing/`                                        | `typing`                                                           |
\| `ephemeral.rs`                                                                    | `/_matrix/client/v3/sendToDevice/{eventType}/{txnId}`                                              | `ephemeral/`                                     | `ephemeral`                                                        |
\| `event_report.rs`                                                                 | `/_matrix/client/v3/rooms/{roomId}/report/{eventId}`                                               | `event-report/`                                  | `event_report`                                                     |
\| `reactions.rs`, `relations.rs`, `thread.rs`                                       | `/\_matrix/client/v1/rooms/{roomId}/{relations                                                     | aggregations                                     | threads}/...`                                                      | `aggregations/`, `relations-manager/`, `thread/` | `reactions`, `relations`, `thread` |
\| `oidc.rs`, `cas.rs`, `saml.rs`                                                    | `/_matrix/client/v3/login/sso/*`, `/.well-known/openid-configuration`, `/_matrix/client/v3/oidc/*` | `oidc/`, `client-auth-sso`                       | `oidc`, `cas`, `saml`                                              |
\| `captcha.rs`                                                                      | `/_matrix/client/v3/register/m.login.recaptcha`                                                    | `captcha/`                                       | `captcha`                                                          |
\| `burn_after_read.rs`                                                              | `/_synapse/client/v1/burn_after_read/*`                                                            | `burn-after-read/` (manager extension)           | `burn_after_read`                                                  |
\| `voice.rs`                                                                        | `/_synapse/client/v1/voice/*` + `/_matrix/client/v3/voip/turnServer`                               | `voip-calls/`, `voice/`                          | `voice`                                                            |
\| `widget.rs`                                                                       | `/_synapse/client/v1/widgets/*`                                                                    | `widget/`                                        | `widget`                                                           |
\| `moderation.rs`                                                                   | `/_synapse/admin/v1/users/{userId}/shadow_ban` etc.                                                | `moderation/`                                    | `moderation`                                                       |
\| `external_service.rs`, `ai_connection.rs`, `openclaw.rs`                          | `/_synapse/client/v1/...`                                                                          | `ai/`, `ai-connection/`, `openclaw/`             | `external_service`, `ai_connection`, `openclaw`                    |
\| `feature_flags.rs`                                                                | `/_synapse/client/v1/feature_flags`                                                                | `feature-flags/`                                 | `feature_flags`                                                    |
\| `rendezvous.rs`                                                                   | `/_matrix/client/v1/rendezvous`                                                                    | `rendezvous/`                                    | `rendezvous`                                                       |
\| `telemetry.rs`                                                                    | `/_synapse/client/v1/telemetry`                                                                    | `telemetry/`                                     | `telemetry`                                                        |
\| `module.rs`, `assembly.rs`, `background_update.rs`, `worker.rs`, `worker_body.rs` | various admin/internal                                                                             | `module/`, `background-update/`, `worker-admin/` | as named                                                           |
\| `app_service.rs`                                                                  | `/_matrix/app/v1/*`                                                                                | `appservice/`                                    | `app_service`                                                      |
\| `federation.rs`                                                                   | `/_matrix/federation/v1/*`                                                                         | `federation/`                                    | `federation`                                                       |
\| `guest.rs`                                                                        | `/_matrix/client/v3/register?kind=guest`                                                           | `auth/guest`                                     | `guest`                                                            |
\| `tags.rs` (in assembly)                                                           | `/_matrix/client/v3/user/{userId}/rooms/{roomId}/tags`                                             | `tags/`                                          | `tags`                                                             |

Total: **49 modules / 1192 default-profile routes / 1258 all-profile routes** (verified against `docs/api-contract/generated/index.json`).

### 17.2 Endpoint envelope (binding rules)

Every entry in the table above MUST conform to this envelope:

#### 17.2.1 Path

- v3 client routes: prefix MUST be `ClientPrefix.V3` (`/_matrix/client/v3`); v1 unstable: `ClientPrefix.V1`; admin: empty prefix + explicit `/_synapse/admin/vN/...`.
- Path parameters MUST go through `encodeUri('/foo/$id', { $id: value })`. Inline string concat is a banned pattern (lint rule `hula/no-inline-matrix-uri`).
- Trailing slash sensitivity: synapse-rust accepts both, but SDK MUST emit canonical (no trailing slash) form.

#### 17.2.2 Methods and idempotency

| Method                     | When                                                  | Idempotency                       | Retry policy                          |
| -------------------------- | ----------------------------------------------------- | --------------------------------- | ------------------------------------- |
| `GET`                      | reads                                                 | yes                               | retryable, 4 attempts                 |
| `PUT /.../{txnId}`         | typed event sends, account-data writes                | idempotent (server dedups by txn) | 3 attempts                            |
| `POST`                     | mutating-non-idempotent (login, register, 3PID flows) | NO                                | no retry without explicit user action |
| `POST /.../redact/{txnId}` | redaction                                             | idempotent (txn)                  | 3 attempts                            |
| `DELETE`                   | session/device removal                                | idempotent                        | 3 attempts                            |

#### 17.2.3 Request body

- All bodies MUST be JSON unless a multipart form is the protocol (media upload).
- Boolean false and zero MUST be sent (no auto-stripping).
- `null` is reserved for "explicit clear" semantics in account-data; UI code MUST distinguish from "unset".

#### 17.2.4 Response shape

- Successful 2xx MUST return DTOs governed by `docs/api-contract/generated/modules/<module>.json`. The SDK ships generated DTO type aliases in `src/<module>/__generated__/route-table.ts`.
- 204 No Content is permitted only for the routes the ledger marks as `void_response: true`.
- Synapse-extensions return additional fields wrapped under `synapse_*` keys; SDK DTOs already model these.

#### 17.2.5 Error shape

Backend error envelope (per `synapse-rust/src/web/errors.rs`):

```json
{ "errcode": "M_*", "error": "human-readable", "retry_after_ms": 1500, "soft_logout": false }
```

SDK normalizer maps:

| HTTP    | errcode                                                          | SDK class                                  |
| ------- | ---------------------------------------------------------------- | ------------------------------------------ |
| 400     | `M_INVALID_PARAM`, `M_BAD_JSON`, `M_NOT_JSON`, `M_MISSING_PARAM` | `ValidationError`                          |
| 401     | `M_UNKNOWN_TOKEN`, `M_MISSING_TOKEN`                             | `AuthError` (soft\_logout-aware)           |
| 403     | `M_FORBIDDEN`, `M_GUEST_ACCESS_FORBIDDEN`                        | `AuthError`                                |
| 404     | `M_NOT_FOUND`                                                    | `NotFoundError`                            |
| 409     | `M_USER_IN_USE`, `M_ROOM_IN_USE`                                 | `ApiError`                                 |
| 413     | `M_TOO_LARGE`                                                    | `ApiError`                                 |
| 429     | `M_LIMIT_EXCEEDED`                                               | `RetryableError` (honors `retry_after_ms`) |
| 5xx     | any                                                              | `RetryableError`                           |
| network | —                                                                | `RetryableError`                           |

Frontend MUST consume only the SDK-normalized class set, never inspect raw `error.httpStatus` outside `services/matrix/network/`.

### 17.3 Request envelope reference (representative routes)

| Op                        | URL (v3)                                               | Method | Auth          | Idempotency         | Cache                          | Retry            | Pagination                                 | Sort/Filter                                       |
| ------------------------- | ------------------------------------------------------ | ------ | ------------- | ------------------- | ------------------------------ | ---------------- | ------------------------------------------ | ------------------------------------------------- |
| Login (password)          | `/login`                                               | POST   | none          | no                  | no                             | no               | —                                          | —                                                 |
| Refresh token             | `/refresh`                                             | POST   | refresh       | no                  | no                             | 1                | —                                          | —                                                 |
| Logout                    | `/logout`                                              | POST   | user          | no                  | no                             | no               | —                                          | —                                                 |
| Get profile               | `/profile/{userId}`                                    | GET    | user/optional | yes                 | TTL 5 min, SWR                 | 4                | —                                          | —                                                 |
| Set displayname           | `/profile/{userId}/displayname`                        | PUT    | user          | yes                 | invalidate profile             | 3                | —                                          | —                                                 |
| Create room               | `/createRoom`                                          | POST   | user          | NO                  | invalidate room list           | no               | —                                          | —                                                 |
| Join room                 | `/rooms/{roomId}/join`                                 | POST   | user          | yes (server dedups) | invalidate room list + summary | 3                | —                                          | —                                                 |
| Send message              | `/rooms/{roomId}/send/{type}/{txnId}`                  | PUT    | user          | yes (txnId)         | append timeline                | 3                | —                                          | —                                                 |
| Get state                 | `/rooms/{roomId}/state`                                | GET    | user          | yes                 | TTL ∞, invalidated by sync     | 4                | —                                          | —                                                 |
| Get messages              | `/rooms/{roomId}/messages`                             | GET    | user          | yes                 | per `from` token               | 4                | `from`+`to`+`limit` (max 1000, default 10) | `dir=b\|f`                                        |
| Search                    | `/search`                                              | POST   | user          | NO                  | no                             | no               | inside response `next_batch`               | full-text + filter object                         |
| Sliding sync              | `/org.matrix.msc3575/sync`                             | POST   | user          | yes                 | per `pos`                      | infinite         | window-based (`ranges`)                    | bitmap filters                                    |
| Push rules                | `/pushrules/`                                          | GET    | user          | yes                 | TTL 1 min                      | 4                | —                                          | —                                                 |
| Set push rule             | `/pushrules/{scope}/{kind}/{ruleId}`                   | PUT    | user          | yes                 | invalidate rules               | 3                | —                                          | —                                                 |
| Upload media              | `/_matrix/media/v3/upload`                             | POST   | user          | NO                  | no                             | no (use chunked) | —                                          | —                                                 |
| Download media            | `/_matrix/client/v1/media/download/{server}/{mediaId}` | GET    | user          | yes                 | LRU 200 MB                     | 4                | —                                          | —                                                 |
| Verify device             | `/keys/device_signing/upload`                          | POST   | UIA           | no                  | invalidate device cache        | 1 (UIA)          | —                                          | —                                                 |
| Admin list users          | `/_synapse/admin/v2/users`                             | GET    | admin         | yes                 | TTL 30s                        | 4                | `from`+`limit` (default 100, max 500)      | `name`,`guests`,`deactivated`,`order_by`,`dir`    |
| Admin retention run       | `/_synapse/admin/v1/retention/run`                     | POST   | admin         | NO                  | no                             | no               | —                                          | —                                                 |
| Capabilities              | `/capabilities`                                        | GET    | user          | yes                 | TTL 5 min, SWR                 | 4                | —                                          | —                                                 |
| Versions                  | `/_matrix/client/versions`                             | GET    | none          | yes                 | TTL 30 min                     | 4                | —                                          | —                                                 |
| OIDC discovery            | `/.well-known/openid-configuration`                    | GET    | none          | yes                 | TTL 1 h                        | 2                | —                                          | —                                                 |
| Federation status (admin) | `/_synapse/admin/v1/federation/destinations`           | GET    | admin         | yes                 | TTL 30 s                       | 4                | `from`+`limit` (default 100, max 500)      | `order_by=destination\|retry_last_ts\|...`, `dir` |
| Voice TURN                | `/voip/turnServer`                                     | GET    | user          | yes                 | TTL = response `ttl` − 60 s    | 4                | —                                          | —                                                 |

Full enumeration of all 1192 routes lives in
`/Users/ljf/Desktop/hu_ts/matrix-js-sdk/docs/api-contract/generated/route-manifest.default.json` —
treat that file as the spec; this table is a curated digest.

### 17.4 Status code semantics (uniform across all 49 modules)

| Code                                        | Meaning                            | UI behavior                                      | Telemetry               |
| ------------------------------------------- | ---------------------------------- | ------------------------------------------------ | ----------------------- |
| 200                                         | OK                                 | render                                           | success rate +1         |
| 201                                         | Created                            | render + optimistic state confirm                | success rate +1         |
| 202                                         | Accepted (admin run, key recovery) | show "queued" toast, poll status                 | success rate +1         |
| 204                                         | No content                         | silent success                                   | success rate +1         |
| 301/302/307/308                             | follow once (SDK does this)        | invisible                                        | redirect counter        |
| 400                                         | Validation                         | inline form error from `error` field             | error rate (validation) |
| 401 (`M_UNKNOWN_TOKEN`, `soft_logout=true`) | re-auth                            | silent token refresh; on second failure → /login | auth-recovery counter   |
| 401 (`soft_logout=false`)                   | hard logout                        | clear session, navigate /login                   | auth-failure counter    |
| 403                                         | forbidden                          | toast + capability re-probe                      | forbidden counter       |
| 404                                         | not found                          | route-specific empty state                       | not-found counter       |
| 409                                         | conflict                           | inline conflict resolution UI                    | conflict counter        |
| 413                                         | payload too large                  | suggest chunk upload                             | upload-413 counter      |
| 415                                         | unsupported media                  | reject with content-type hint                    | media-415 counter       |
| 429                                         | rate limited                       | obey `Retry-After`; banner if > 5 s              | throttle counter        |
| 500                                         | server error                       | toast + retry tier B                             | 5xx counter             |
| 502/503/504                                 | transient                          | tier B/C transition                              | 5xx counter             |
| `network`                                   | offline                            | tier D/E transition                              | offline counter         |

### 17.5 Cache strategy by endpoint class

| Class                                                              | Layer                                                  | Eviction                               | Invalidation trigger                | Notes                   |
| ------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------- | ----------------------------------- | ----------------------- |
| Long-lived static (`/versions`, `/capabilities`, `/.well-known/*`) | `MatrixCacheManager` (memory) + `localStorage` (TTL'd) | TTL                                    | login, manual reload                | SWR allowed             |
| Profile / device list                                              | `MatrixCacheManager`                                   | TTL 5 min                              | own write, `m.presence` event       | Per-user keying         |
| Account data                                                       | SDK `IndexedDBStore`                                   | sync token                             | server `account_data` event         | Authoritative cache     |
| Room state                                                         | SDK store                                              | sync token                             | sync delta                          | Never bypass            |
| Timeline                                                           | SDK store + room-scoped LRU (in-memory)                | sync token + LRU 50 rooms × 500 events | sync delta                          | UI prefers SDK timeline |
| Push rules                                                         | `MatrixCacheManager`                                   | TTL 1 min                              | own write, `m.push_rules` ephemeral | —                       |
| Search                                                             | none                                                   | always live                            | —                                   | Search is non-cacheable |
| Media (download)                                                   | LRU disk cache via Tauri (`app_cache_dir/media/`)      | 200 MB                                 | media revoke event                  | `mxc://` keying         |
| Admin lists                                                        | memory only                                            | TTL 30 s                               | own write, manual refresh           | Never persist           |
| OIDC discovery                                                     | memory + `localStorage`                                | TTL 1 h                                | issuer change                       | One per issuer          |
| TURN servers                                                       | memory                                                 | TTL = response `ttl` − 60 s            | logout                              | —                       |

`MatrixCacheManager.invalidate(<key-glob>)` MUST be called by every mutating service method. Unit tests assert this contract.

### 17.6 Pagination contract

Three pagination shapes appear across the 1192 routes; SDK already abstracts them but UI consumers MUST use the SDK helpers:

#### 17.6.1 Token-based (`/messages`, `/relations`, `/threads`, room-keys export)

```ts
{ from: string, to?: string, dir: 'b' | 'f', limit: number /* ≤ 1000 */ }
→ { chunk: T[], start: string, end: string }
```

UI helper: `useTokenPagination<T>(fetcher)` in `composables/usePagination.ts`. Auto-stops at `end === undefined`.

#### 17.6.2 Offset-based (admin lists)

```ts
{ from: number, limit: number /* default 100, max 500 */, order_by?: string, dir?: 'f' | 'b' }
→ { users: T[], next_token?: string, total: number }
```

UI helper: `useOffsetPagination<T>(fetcher, { pageSize: 100 })`.

#### 17.6.3 Window-based (sliding-sync)

```ts
{ ranges: [[start, end], ...], required_state, timeline_limit, filters }
→ { ops: SyncOp[], pos: string, lists: ListSnapshot[] }
```

This is **not** a UI-driven paginator; the SDK manages it internally. UI subscribes to `Room` updates emitted by the SDK and never poses raw window queries.

#### 17.6.4 Page size policy

| Surface                         | Default | Max  | Justification            |
| ------------------------------- | ------- | ---- | ------------------------ |
| Room list (sliding-sync window) | 20      | 100  | mobile data discipline   |
| Timeline initial                | 30      | 1000 | first paint < 200 ms     |
| Timeline backfill page          | 50      | 200  | smooth scroll            |
| Members list                    | 100     | 500  | one screen + buffer      |
| Admin lists                     | 50      | 500  | UI tables paginate at 50 |
| Search results                  | 25      | 100  | server-imposed hard cap  |
| Room directory                  | 30      | 100  | —                        |

### 17.7 Sort and filter rules

#### 17.7.1 Server-side sort (admin / directory)

Every admin list endpoint accepts `order_by` + `dir`. Allowed values are enumerated in
`docs/api-contract/generated/modules/admin.json` per route (e.g. users: `name|displayname|guest|admin|deactivated|user_type|shows_user|creation_ts|last_seen_ts|locked`). UI MUST:

- offer only the values listed in the ledger
- default `order_by=name`, `dir=f` for users
- default `order_by=creation_ts`, `dir=b` for rooms

#### 17.7.2 Client-side sort

Permitted only on result sets ≤ 500 items (one server page) and MUST be stable. The shared comparator lives in `utils/sort.ts`.

#### 17.7.3 Filter contracts

- Sliding-sync filters: see `docs/api-contract/generated/modules/sliding_sync.json`.
- Search filter object: governed by `docs/api-contract/generated/modules/search.json` — UI MUST never invent fields.
- Admin search predicates: `name`, `guests`, `deactivated`, `user_type` only.

## 18. Frontend Module → SDK Interaction Flows

Each subsection covers: actors, sequence, data flow, state ownership,
error boundary, fallback. Sequence diagrams are ASCII-rendered for
readability inside Markdown. UI screen names trace back to §7.

### 18.1 User Authentication

**Surface**: `/login`, `/register`, `/forgetPassword`, OIDC callback, QR login.
**Backend**: `auth_compat.rs`, `oidc.rs`, `cas.rs`, `saml.rs`, `rendezvous.rs`, `captcha.rs`.
**SDK**: `MatrixAuthService`, `MatrixOidcService`, `MatrixQrLoginService`.

#### 18.1.1 Sequence (password login)

```text
User           LoginView          MatrixAuthService     SDK MatrixClient    synapse-rust       Tauri secure store
 │  type creds  │                       │                      │                  │                   │
 │ ──submit───▶ │                       │                      │                  │                   │
 │              │ login(u,p,server) ───▶│                      │                  │                   │
 │              │                       │ http GET /versions ─▶│ ───────────────▶ │                   │
 │              │                       │  (capability cache)  │ ◀──── 200 ──────│                   │
 │              │                       │ http POST /login ───▶│ ───────────────▶ │                   │
 │              │                       │                      │ ◀── 200 + tokens │                   │
 │              │                       │ store tokens ─────────────────────────────────────────────▶ │
 │              │                       │ initRustCrypto() ───▶│                  │                   │
 │              │                       │ startSlidingSync() ─▶│ ──── /sync ────▶ │                   │
 │              │ session.ready ──┐     │                      │ ◀──── delta ─────│                   │
 │ ◀── route /message ───────────┘                                                                    │
```

#### 18.1.2 State

| State                                     | Owner                               | Persistence               |
| ----------------------------------------- | ----------------------------------- | ------------------------- |
| `accessToken`, `refreshToken`, `deviceId` | Tauri secure store (Rust)           | encrypted at rest         |
| `userId`, `homeserverUrl`                 | Pinia `useUserStore` (persisted)    | localStorage (non-secret) |
| MFA challenge                             | in-memory only                      | none                      |
| OIDC PKCE verifier                        | sessionStorage (cleared on success) | sessionStorage            |

#### 18.1.3 Error boundary

| Cause                     | UX                                            | Recovery                          |
| ------------------------- | --------------------------------------------- | --------------------------------- |
| `M_FORBIDDEN` (bad creds) | inline form error                             | retry                             |
| `M_USER_DEACTIVATED`      | full-screen explainer                         | contact admin link                |
| `M_LIMIT_EXCEEDED`        | banner with countdown                         | auto-retry after `retry_after_ms` |
| network                   | tier D banner                                 | auto-retry on online              |
| Captcha required          | render `<CaptchaChallenge>` (uses `captcha/`) | resubmit with token               |
| `soft_logout` on resume   | silent token refresh                          | if refresh fails → /login         |

#### 18.1.4 Fallback chain

`OIDC → CAS → SAML → password → guest`.
Frontend reads `/_matrix/client/v3/login` flows array and renders only flows the SDK supports.

### 18.2 Data Display (Timeline / Room List / Profile)

**Surface**: `/message`, `/roomList`, profile cards.
**Backend**: `sync.rs`, `sliding_sync.rs`, `room.rs`, `room_summary.rs`, `relations.rs`, `thread.rs`.
**SDK**: `MatrixSlidingSyncService`, `MatrixRoomService`, `MatrixMessageService`, `MatrixThreadService`.

#### 18.2.1 Sequence (room list paint)

```text
HomeWindow → useRoomListStore (Pinia)
              │ subscribe via storeToRefs
              ▼
        MatrixSlidingSyncService
              │ register list "rooms" with filter/sort spec
              │ window [0, 19]
              ▼
       SDK SlidingSync
              │ POST /org.matrix.msc3575/sync (long-poll)
              ▼
        synapse-rust
              │ pushes ops: SYNC, INSERT, INVALIDATE
              ▼
        SDK emits Room events
              │
              ▼
   useRoomListStore.mergeOps() → reactive list
              │
              ▼
        <RoomListItem v-for> (virtual scroll, 56px row, IntersectionObserver)
```

#### 18.2.2 Data flow rules

- Room timeline events flow **only** via SDK `Room.timeline` and `RoomEvent.Timeline` listener — never via raw HTTP.
- Profile snippets use `MatrixProfileService.getProfile(userId)` which reads `MatrixCacheManager` first.
- Avatars resolve through `MatrixMediaService.resolveAvatarUrl(mxc, size)` → `mxc://` to authenticated download.

#### 18.2.3 Virtualization budget

- Room list: visible rows ≤ 18 on desktop, ≤ 12 on mobile; rest are spacer divs.
- Timeline: `vue-virtual-scroller` keyed by `event_id`; estimated row 64 px.
- Re-render on token tick must be ≤ 4 ms / 60 events (measured by `PerformanceReporter.measureInteraction`).

#### 18.2.4 Empty / error / skeleton

Every list has the four states (`loading`, `empty`, `error`, `success`) emitted by `useRequestState<T>()`. Skeleton is mandatory; empty must include CTA.

### 18.3 Real-time Communication (Sliding Sync, Typing, Receipts, VoIP)

**Surface**: chat rooms, RTC call window.
**Backend**: `sliding_sync.rs`, `ephemeral.rs`, `voice.rs`, `typing.rs`.
**SDK**: `MatrixSlidingSyncService`, `MatrixTypingService`, `MatrixReceiptService`, `MatrixVoIPService`.

#### 18.3.1 Sequence (typing indicator with suppression)

```text
ComposerView (keystroke)
   │ debounce 250 ms (lodash.debounce)
   ▼
useTypingComposable
   │ if state.isTyping → noop
   │ else state.isTyping = true
   ▼
MatrixTypingService.start(roomId, true)    ── PUT /rooms/{rid}/typing/{uid} (timeout=20000)
   │ schedule auto-stop in 18000 ms
   │
   ▼ on user blur or composer empty:
MatrixTypingService.stop(roomId)           ── PUT /rooms/{rid}/typing/{uid} (typing=false)
```

Rules:

- Send at most one `typing=true` per 18 s window per room.
- Server timeout MUST be longer than client schedule by 2 s buffer.
- VoIP signaling (`m.call.*` to-device events) flows via `ephemeral` channel; UI MUST never speak ICE candidates over HTTP.

#### 18.3.2 Reconnect strategy

`SlidingSyncReconnectManager`:

- on `pos` reset (404 from server) → resync from sliding-sync token saved in IndexedDB; if missing → cold initialSync (limit 20).
- on `M_UNKNOWN_TOKEN` mid-stream → escalate to AuthService.
- exponential `[2s, 4s, 8s, 16s, 30s, 60s]` capped, jitter ±20%.
- a single reconnect must not block UI — show banner only after 5 s.

### 18.4 File Upload

**Surface**: chat composer attachment, avatar upload, file manager.
**Backend**: `media.rs` + `external_service.rs` (extensions for chunk).
**SDK**: `MatrixMediaService`, `ChunkUploadService` (frontend, wraps SDK for files > 4 MB).

#### 18.4.1 Sequence (chunked upload)

```text
ComposerAttach
  │ select File
  ▼
ChunkUploadService.upload(file)
  │ if file.size ≤ 4 MB → MatrixMediaService.upload(file)  (single POST /_matrix/media/v3/upload)
  │ else                  ↓
  │ POST /_synapse/client/v1/media/upload/init             → { upload_id, chunk_size }
  │ for each chunk i:
  │   PUT  /_synapse/client/v1/media/upload/{upload_id}/{i}  (Idempotency-Key header)
  │ POST /_synapse/client/v1/media/upload/{upload_id}/complete → { content_uri, sha256 }
  ▼
MatrixMessageService.sendMessage(roomId, { msgtype: 'm.file', url: content_uri, info })
```

#### 18.4.2 Constraints

- Max single chunk 4 MB; max file 1 GB; concurrency 3 chunks.
- Hard-cancel via `AbortController`; partial uploads MUST be resumable for 24 h server-side.
- Progress reported per chunk to `useUploadProgressStore` keyed by transaction id.
- Mime-type validation client-side AND server-side; preview generation uses `tauri-plugin-fs` thumbnailer for images > 1 MB.
- EXIF stripping is mandatory for `image/*` before upload.

#### 18.4.3 Failure handling

| Cause               | Behavior                                                             |
| ------------------- | -------------------------------------------------------------------- |
| `M_TOO_LARGE`       | abort, show "use chunk uploader" hint (only if not already chunking) |
| `M_FORBIDDEN` quota | inline error, link to settings                                       |
| chunk 5xx           | retry chunk only (3 attempts), preserve other chunks                 |
| connection drop     | resume from last acked chunk                                         |
| user cancel         | call `DELETE /upload/{upload_id}`, free server slot                  |

### 18.5 Permission Control

**Surface**: route guards, admin console, feature toggles.
**Backend**: capability map, room power levels, admin token check.
**SDK**: `MatrixCapabilityService`, `MatrixAdminService`, `Room.currentState`.

#### 18.5.1 Three-layer permission gate

```
Layer 1: Route guard (vue-router beforeEach)
  - reads useUserStore + useCapabilityStore
  - blocks /admin/* if !isServerAdmin()
  - blocks /settings/encryption if !canUseE2EE()

Layer 2: Component gate (<PermissionGuard :require="...">)
  - hides UI affordances when permission missing
  - emits `denied` for telemetry

Layer 3: Service gate (MatrixCapabilityService.requireOrThrow)
  - wraps each manager call
  - throws AppAuthError before any HTTP is sent
```

All three layers MUST be present; any single layer is insufficient. UI MUST gray-out (not hide) read-only restrictions to keep affordances discoverable.

#### 18.5.2 Power-level semantics

`Room.getJoinedMembers()` + `Room.currentState.getPowerLevels()` give the matrix; UI helpers in `composables/useRoomPower.ts`:
`canSend(eventType)`, `canKick(member)`, `canBan`, `canRedact(eventId)`, `canChangePowerOf(member)`.

### 18.6 Logging / Tracing

**Owner**: `utils/Logger.ts` (frontend) → `@tauri-apps/plugin-log` → file rotation in `app_data_dir`.

#### 18.6.1 Layers

| Layer              | Purpose                    | Sink                                                          | Sampling                         |
| ------------------ | -------------------------- | ------------------------------------------------------------- | -------------------------------- |
| Console (DEV only) | local debug                | console                                                       | unsampled                        |
| Tauri rolling file | post-mortem                | `~/Library/Logs/com.hula.pc/*.log` (mac), platform-equivalent | unsampled, 7-day rotation        |
| Remote (telemetry) | aggregated metrics + crash | telemetry vendor                                              | per `VITE_TELEMETRY_SAMPLE_RATE` |
| User-export        | rageshake bundle           | IndexedDB `hula-rageshake` then upload                        | on-demand                        |

#### 18.6.2 Trace ID propagation

`X-Hula-Trace-Id` (UUIDv7) is generated at app start, attached to every request via `getRuntimeAwareFetch`. Backend echoes it in response and logs; rageshake bundles include the last 200 trace IDs.

#### 18.6.3 Redaction

Every log frame MUST pass through `redactPII()`:

- access tokens → `***`
- e-mail → `local***@domain`
- phone → last 4 digits only
- room IDs and event IDs are kept as-is (already opaque)
- message content is NEVER logged at any level above `trace`, and `trace` is dev-only

### 18.7 Performance Monitoring

**Owner**: `utils/PerformanceReporter.ts`, `utils/WebVitalsObserver.ts`.

#### 18.7.1 Marks (mandatory)

`hula-app-creation`, `hula-plugin-install`, `hula-mount-to-ready`, `hula-sdk-ready`, `hula-first-sync`, `hula-room-list-paint`, `hula-timeline-paint`, `hula-message-send-roundtrip`, `hula-call-setup`.

#### 18.7.2 Web Vitals

LCP, INP, CLS, FCP, TTFB collected at p50/p75/p95; reported every 30 s and at unload via `sendBeacon`.

#### 18.7.3 Budgets (HuLa-specific)

| Metric                        | Desktop p75    | Mobile p75     | Source              |
| ----------------------------- | -------------- | -------------- | ------------------- |
| First Contentful Paint        | < 800 ms       | < 1.2 s        | LCP-adjusted        |
| Largest Contentful Paint      | < 1.5 s        | < 2.5 s        | Web Vitals          |
| Interaction Next Paint        | < 200 ms       | < 250 ms       | Web Vitals          |
| `hula-mount-to-ready`         | < 1.0 s        | < 1.5 s        | perf mark           |
| `hula-first-sync`             | < 1.5 s        | < 2.5 s        | perf mark           |
| `hula-message-send-roundtrip` | < 600 ms       | < 900 ms       | perf mark           |
| Long task budget per minute   | < 200 ms total | < 300 ms total | PerformanceObserver |

Regression > 10% on a metric blocks release; `lighthouse-budget.json` already gates desktop.

### 18.8 Error Reporting

**Owner**: `services/matrix/network/normalizeTransportError.ts` + `common/errors.ts`.

#### 18.8.1 Pipeline

```
SDK throws ─▶ AppError factory ─▶ logger.error (file)  ┐
                                                       ├▶ telemetry.captureException (sampled)
Components catch ─▶ <ErrorBoundary> ──────────────────▶ ┘
                                                       └▶ user toast / inline / fullscreen
```

Telemetry MUST de-dup by `(error.code, error.fingerprint, route, sdk_commit)`; high-volume bursts are aggregated server-side.

#### 18.8.2 Error contract presented to UI

```ts
type AppError =
  | { kind: 'auth'; code: string; recoverable: boolean; message: string }
  | { kind: 'validation'; field?: string; code: string; message: string }
  | { kind: 'not_found'; resource: string; message: string }
  | { kind: 'retryable'; retryAfterMs?: number; message: string }
  | { kind: 'fatal'; code: string; message: string; correlationId: string }
```

UI ONLY consumes this discriminated union.

### 18.9 Internationalization

**Owner**: `i18n/`, `vue-i18n` v9 (composition API).

#### 18.9.1 Inventory

- Locales in `locales/`: `zh-CN`, `zh-TW`, `en-US`, `ja-JP`, `ko-KR` (extensible).
- Backend-driven strings (server notice, push fallback) flow through SDK without translation; UI MUST surface them with a "translate" affordance only.
- Datetime: `dayjs` with locale ICU; numeric: `Intl.NumberFormat`; lists: `Intl.ListFormat`.

#### 18.9.2 Lifecycle

- locale resolution order: explicit user setting → OS locale (`navigator.language`) → fallback `zh-CN`.
- bundle splitting per locale (lazy-load via `import('./locales/${locale}.json')`); only the active locale is loaded initially.
- missing-key handler logs to telemetry at `warn`; never to console in production.
- pluralization MUST use ICU MessageFormat, not concatenation.

#### 18.9.3 RTL

Reserved future work; current scope is LTR only. No RTL-breaking layout primitives (`margin-left`/`right` literals) are allowed in new components — use logical properties (`margin-inline-start/end`).

### 18.10 Accessibility (a11y)

**Standard**: WCAG 2.1 AA.

| Area                   | Requirement                                                              | Verification                      |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------- |
| Color contrast         | 4.5:1 text, 3:1 UI                                                       | Storybook a11y addon + Lighthouse |
| Keyboard               | every interactive control reachable, visible focus ring                  | Playwright a11y test              |
| Screen reader          | live region for new messages (`aria-live=polite`), labels on every input | manual + axe-core                 |
| Reduced motion         | `@media (prefers-reduced-motion)` disables animations                    | Playwright matrix                 |
| Captions / transcripts | required for any audio (voice messages)                                  | manual review                     |
| Hit target             | ≥ 44×44 px on mobile                                                     | UnoCSS preset enforced            |
| ARIA                   | no fake links/buttons; roles match semantics                             | axe-core CI step                  |

CI MUST run `pnpm test:a11y` (axe-playwright) and fail on any violation classified `serious` or `critical`.

## 19. High-Concurrency Strategy (Frontend)

### 19.1 Throttle / debounce / coalesce table

| Operation                        | Strategy           | Window               | Library                | Owner                   |
| -------------------------------- | ------------------ | -------------------- | ---------------------- | ----------------------- |
| Composer typing → typing event   | debounce           | 250 ms               | `lodash-es/debounce`   | `useTypingComposable`   |
| Composer keystroke → draft save  | debounce           | 800 ms               | same                   | `useDraft`              |
| Search input → query             | debounce           | 300 ms (min 2 chars) | same                   | `useSearch`             |
| Window resize                    | throttle           | 100 ms               | `lodash-es/throttle`   | layout root             |
| Scroll → backfill trigger        | throttle           | 50 ms                | same                   | timeline composable     |
| Receipt send                     | throttle           | 1 s per room         | same                   | `MatrixReceiptService`  |
| Presence update                  | throttle           | 30 s                 | same                   | `MatrixPresenceService` |
| In-flight identical request      | dedupe             | 100 ms window        | `MatrixRequestDeduper` | service layer           |
| Ledger-tracked mutation (txn-id) | request-key dedupe | per txn              | SDK                    | manager                 |

Custom dedupe keys MUST be deterministic — typically `${method}:${path}:${stringify(query)}:${stringify(body)}` with stable ordering.

### 19.2 Caching layers (consolidated view)

```
┌──────────────────────────┐
│ UI (component memo)      │  Vue computed / shallowRef
├──────────────────────────┤
│ Pinia store (memory)     │  reactive, optional persisted
├──────────────────────────┤
│ MatrixCacheManager       │  TTL+SWR, by domain
├──────────────────────────┤
│ MatrixRequestDeduper     │  in-flight coalescing
├──────────────────────────┤
│ SDK IndexedDBStore       │  sync token authoritative
├──────────────────────────┤
│ Tauri secure store / FS  │  tokens, media LRU, logs
└──────────────────────────┘
```

A read MUST traverse top→bottom; a write MUST invalidate top↑bottom for affected keys.

### 19.3 Degradation circuits

`useCircuitBreaker(serviceName, options)` lives in `composables/useCircuitBreaker.ts`:

- closed → open after 5 errors in 10 s window
- open for 30 s (calls fail fast with `AppApiError` "circuit open")
- half-open → 1 probe call; success → closed; failure → open 60 s
- per service name (auth, media, admin, ai, voip)

Telemetry events: `circuit.opened`, `circuit.half_open`, `circuit.closed`.

### 19.4 Retry / replay

- Retry policy: §16.5.4. No retry without user action for non-idempotent POSTs.
- Replay queue (offline): §16.5.5.
- Mutation idempotency: SDK manages `transactionId`; manual `Idempotency-Key` header used only by chunk uploader.

### 19.5 Offline / sync

| Scenario                                               | Behavior                                                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Tier E (no network)                                    | Composer accepts text; "send" enqueues; UI shows clock icon.                                                                    |
| Reconnect                                              | Queue drains in submission order; on each success, replace clock icon with check; on failure (4xx) → mark error + manual retry. |
| Token refresh during drain                             | Queue paused, refresh runs, queue resumes.                                                                                      |
| Conflict on resume (e.g. message redacted server-side) | Drop pending, surface notification.                                                                                             |
| App crash during drain                                 | On next boot, queue is read from IndexedDB and resumes (after SDK ready).                                                       |

### 19.6 Concurrency limits

| Domain                  | Concurrency cap                  | Reason                    |
| ----------------------- | -------------------------------- | ------------------------- |
| Media uploads           | 3 chunks × 1 file simultaneously | mobile bandwidth          |
| Media downloads         | 6                                | browser/Tauri socket pool |
| Avatar resolves         | 8 (queue)                        | UI thrash                 |
| Sliding-sync            | 1 (singleton)                    | server constraint         |
| Long-poll `/sync`       | 1 (singleton)                    | —                         |
| Admin batch operations  | 4 (per page)                     | server throttle           |
| AI streaming (OpenClaw) | 2                                | UX clarity                |

A semaphore primitive lives in `utils/Semaphore.ts`. Every domain above MUST acquire from a named semaphore.

### 19.7 Backpressure

Server signals (429, `Retry-After`) drive client backpressure. Additionally:

- Sliding-sync bursts: cap reactive update rate to 60 Hz; queue extra ops in a microtask flush.
- Notification flood: collapse > 20 notifications/minute into a single "N messages in M rooms" entry.
- Toast throttler: max 3 visible at once; rest queued, FIFO.

## 20. Acceptance and Delivery Standard

### 20.1 Mandatory delivery KPIs

| #  | KPI                                     | Target                                                                                                                                           | Measurement                                                                             | Gate             |
| -- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ---------------- |
| 1  | Backend interface integration pass-rate | **100%** of routes the frontend exercises (per ledger)                                                                                           | `pnpm test:e2e:contract` runs the contract-coverage harness against synapse-rust QA env | release-blocking |
| 2  | Core-flow E2E test cases                | **≥ 30** scenarios covering login, sync, send, receive, thread, reaction, edit, redact, upload, download, voice, presence, push, settings, admin | Playwright `e2e/**/*.spec.ts` count                                                     | release-blocking |
| 3  | Unit-test line coverage                 | **≥ 80%** overall, **≥ 90%** for `src/services/**`                                                                                               | `vitest --coverage` (v8 provider)                                                       | release-blocking |
| 4  | First-paint (FCP)                       | **< 800 ms** desktop p75                                                                                                                         | Lighthouse CI / Web Vitals                                                              | release-blocking |
| 5  | Interaction response (INP)              | **< 200 ms** desktop p75                                                                                                                         | Web Vitals                                                                              | release-blocking |
| 6  | Browser compatibility                   | Chrome ≥ 96, Edge ≥ 96, Firefox ≥ 94, Safari ≥ 14, iOS Safari ≥ 14, Android Chrome ≥ 96                                                          | Playwright cross-browser matrix + manual smoke                                          | release-blocking |
| 7  | Security scan                           | **0 high / 0 critical**                                                                                                                          | `pnpm audit --prod` (zero allowed) + `osv-scanner` + `trivy fs .`                       | release-blocking |
| 8  | Doc ↔ code sync                         | **100%** (every public service method has up-to-date JSDoc + ledger pointer)                                                                     | `pnpm quality:public-jsdoc-examples` (SDK) + `pnpm check:doc-coverage` (HuLa)           | release-blocking |
| 9  | Maintainability                         | **SonarQube ≥ 90 (A grade)**, max cognitive complexity 15                                                                                        | SonarQube CI                                                                            | release-blocking |
| 10 | Rollback time                           | **≤ 5 min** from "rollback decided" to "previous build live" for desktop auto-update channel                                                     | rehearsed each release; recorded in release report                                      | release-blocking |

### 20.2 KPI #1 — How "100% interface pass-rate" is computed

Definition: every route in `docs/api-contract/generated/route-manifest.default.json` that is reachable from the frontend (i.e. has at least one inbound call from `src/services/**`) MUST return a successful response in the contract harness.

Process:

1. `pnpm contract:coverage:scan` walks `src/services/**`, collects every method that calls SDK or transport, maps it to the ledger entry via the route-table generated module.
2. Output `coverage-map.json` lists `{ ledger_route, frontend_caller_count }`.
3. Contract harness drives each entry against synapse-rust QA env using fixture users.
4. Fail-fast on any non-2xx; aggregate report becomes release artifact.
5. Coverage MUST be ≥ 100% of the reachable subset; uncovered routes MUST be either removed from the codebase or covered with a new test.

### 20.3 KPI #2 — E2E scenario inventory (initial 30, grow with features)

| #  | Scenario                                         | Surface        |
| -- | ------------------------------------------------ | -------------- |
| 1  | Cold start → login (password) → /message visible | desktop        |
| 2  | Cold start → restore session → /message visible  | desktop        |
| 3  | OIDC redirect login                              | desktop        |
| 4  | QR login mobile→desktop                          | desktop+mobile |
| 5  | Logout cleans tokens + caches                    | desktop        |
| 6  | Send text in DM                                  | desktop        |
| 7  | Receive text in DM (via second client)           | desktop        |
| 8  | Send + edit + redact                             | desktop        |
| 9  | Reply within thread                              | desktop        |
| 10 | React + unreact                                  | desktop        |
| 11 | Mark read receipt                                | desktop        |
| 12 | Typing indicator visible to peer                 | desktop        |
| 13 | Upload image (single shot)                       | desktop        |
| 14 | Upload large file (chunked)                      | desktop        |
| 15 | Download + open file                             | desktop        |
| 16 | Voice message record + send + play               | desktop        |
| 17 | VoIP 1:1 call connect/hangup                     | desktop        |
| 18 | Create room + invite + accept                    | desktop        |
| 19 | Create space + add subroom                       | desktop        |
| 20 | Push rule edit + verify trigger                  | desktop        |
| 21 | E2EE bootstrap + cross-sign                      | desktop        |
| 22 | Key backup recover after device wipe             | desktop        |
| 23 | Settings save + persist across relaunch          | desktop        |
| 24 | Admin list users / disable user                  | desktop        |
| 25 | Admin retention run                              | desktop        |
| 26 | Mobile cold start → login → /mobile/message      | mobile         |
| 27 | Mobile send + receive                            | mobile         |
| 28 | Offline send → online drain                      | desktop        |
| 29 | Soft-logout → silent refresh                     | desktop        |
| 30 | Capability missing → fallback UI                 | desktop        |

Tests live in `e2e/`. Each MUST be deterministic and run in < 30 s p95.

### 20.4 KPI #3 — Unit-test coverage map

| Path                               | Threshold                            | Today |
| ---------------------------------- | ------------------------------------ | ----- |
| `src/services/matrix/auth/**`      | 95%                                  | TBD   |
| `src/services/matrix/messaging/**` | 90%                                  | TBD   |
| `src/services/matrix/room/**`      | 90%                                  | TBD   |
| `src/services/matrix/crypto/**`    | 85%                                  | TBD   |
| `src/services/matrix/admin/**`     | 85%                                  | TBD   |
| `src/services/matrix/sync/**`      | 85%                                  | TBD   |
| `src/services/offline/**`          | 90%                                  | TBD   |
| `src/composables/**`               | 80%                                  | TBD   |
| `src/stores/**`                    | 80%                                  | TBD   |
| `src/utils/**`                     | 80%                                  | TBD   |
| `src/components/**`                | 60% (component testing is selective) | TBD   |
| **Project total**                  | **≥ 80%**                            | TBD   |

Coverage drift > 1% downward fails CI.

### 20.5 KPI #4–#5 — Performance

Already detailed in §18.7.3. Lighthouse CI on every PR with `lighthouse-budget.json`. INP measured by `web-vitals` reported to telemetry; p75 over rolling 7-day window must stay green.

### 20.6 KPI #6 — Compatibility matrix

| Engine             | Min | Test mode                                        |
| ------------------ | --- | ------------------------------------------------ |
| Chromium (desktop) | 96  | Playwright + Tauri webview matches host Chromium |
| Edge               | 96  | Playwright Chromium-based                        |
| Firefox            | 94  | Playwright                                       |
| Safari             | 14  | Playwright WebKit                                |
| iOS Safari         | 14  | manual + BrowserStack                            |
| Android Chrome     | 96  | manual + BrowserStack                            |

Tauri host webview is automatically Chromium ≥ 96 on supported OS minimums (Windows 10 1809, macOS 11, Ubuntu 20.04). Mobile uses platform webview (iOS WKWebView ≥ 14, Android System WebView ≥ 96). The compat matrix is verified by `e2e/cross-browser/*` plus a quarterly manual pass on real devices.

### 20.7 KPI #7 — Security

| Scanner                                    | Scope        | Severity gate                                                  |
| ------------------------------------------ | ------------ | -------------------------------------------------------------- |
| `pnpm audit --prod --audit-level=moderate` | runtime deps | 0 high, 0 critical                                             |
| `osv-scanner --recursive .`                | full tree    | 0 high, 0 critical                                             |
| `trivy fs --severity HIGH,CRITICAL .`      | filesystem   | 0 findings                                                     |
| `cargo audit`                              | Rust crates  | 0 high, 0 critical                                             |
| Semgrep ruleset `p/owasp-top-ten`          | static       | 0 high                                                         |
| ESLint security plugin                     | static       | 0 errors                                                       |
| Lockfile-lint                              | integrity    | 0 hijack patterns                                              |
| CSP audit                                  | runtime      | strict CSP, no `unsafe-inline` outside `style-src` (with hash) |

Every scanner runs on every PR and on a nightly cron against `main`.

### 20.8 KPI #8 — Doc ↔ code sync

| Artifact                            | Sync mechanism                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| SDK ledger ↔ contract docs          | enforced by `pnpm run quality:contracts` (7 gates, ledger-pinned hashes)                          |
| SDK manager ↔ generated route table | `pnpm contract:codegen:check`                                                                     |
| Hula service ↔ ledger               | `coverage-map.json` (§20.2)                                                                       |
| Hula service ↔ JSDoc                | `pnpm check:doc-coverage` (each public method must have summary + `@throws`)                      |
| Architectural docs ↔ code           | this file + `CLAUDE.md` reviewed each release; `last_reviewed` frontmatter MUST match release tag |
| Release notes ↔ commits             | `pnpm release:notes` generates from conventional commits                                          |

A release ships only when all sync checks are green.

### 20.9 KPI #9 — Maintainability

SonarQube quality profile `Hula-Vue3-TS` enforces:

- Cyclomatic complexity ≤ 10 (function), 12 (Vue component setup)
- Cognitive complexity ≤ 15
- File length ≤ 600 lines (max), warn at 400
- Method length ≤ 50 lines
- No duplication > 3% per module
- Test coverage ≥ 80%
- Bugs/Vulnerabilities/Smells: A grade

Failed quality gate blocks merge.

### 20.10 KPI #10 — Rollback ≤ 5 min

Rollback assets enumerated in §11. Channel-level switch:

| Channel                             | Switch mechanism                                          | Time    |
| ----------------------------------- | --------------------------------------------------------- | ------- |
| Desktop auto-update                 | flip `latest.json` to previous version on update server   | < 60 s  |
| Mobile (TestFlight / Play internal) | promote previous build                                    | < 5 min |
| Web preview                         | re-deploy previous artifact                               | < 2 min |
| Backend pin                         | revert `meta/sdk-pin.json` and `pnpm i --frozen-lockfile` | < 3 min |

A rollback rehearsal MUST be performed at the end of every release; the recorded time goes into the release report. If rehearsed time > 5 min, release is blocked.

### 20.11 Single-shot adaptation guarantee

"前端项目通过集成 SDK 即可一次性完成与后端项目的全量适配" is operationalized as:

1. **Bootstrap script** — `pnpm hula:adapt` runs (a) Node toolchain check, (b) SDK pin verify (§16.1.3), (c) ledger version diff vs synapse-rust target, (d) generates a `compatibility-report.md` listing any non-green item.
2. **Compatibility report** — if all sections are green, the frontend is provably aligned to the backend; CI promotes the build to release-candidate.
3. **No manual mapping** — every frontend → backend route goes through the SDK or the §16.3.4 unified transport, which themselves are ledger-bound; a ledger drift triggers `quality:contracts` failure, blocking merge.
4. **One artifact per release** — desktop installer + mobile bundles + web preview share one `meta/sdk-pin.json`; rollback is a single switch.
5. **Acceptance run** — on every release branch, the 30+ E2E scenarios (§20.3) execute against a synapse-rust instance at the pinned commit; pass-rate must equal 100%.

Meeting all of §20 closes the contract: HuLa is fully and reproducibly adapted to the backend through the SDK alone, with no out-of-band integration needed.

## 21. Outstanding Tasks Checklist

The following items remain open based on the current repo state and the delivery criteria defined in §5, §12, and §20. Completion of this section is required before the optimization program can be considered fully closed.

### 21.1 P0 — Release-Blocking Tasks

- Complete release-grade SDK pinning
  - Populate `meta/sdk-pin.json` with:
    - `sdk_version`
    - `sdk_commit`
    - `synapse_rust_commit`
    - `tarball_sha256`
    - `pinned_at`
    - `pinned_by`
  - Ensure release verification runs against a packed SDK tarball instead of `link:../matrix-js-sdk`.
- Switch release/integration validation to tarball mode
  - Keep `link:../matrix-js-sdk` for local development only.
  - Add a reproducible release validation flow using `pnpm pack` output from the pinned SDK commit.
  - Verify `verify:sdk-pin` against the actual installed tarball artifact.
- Turn SDK checks into hard CI gates
  - Remove all non-blocking behavior such as `|| true` around `check:sdk-types`.
  - Make `check:sdk-types` mandatory on PRs and release branches.
- Turn transport governance into a hard CI gate
  - Add `pnpm audit:transport:strict` to required CI jobs.
  - Fail CI when new raw transport violations appear outside the approved boundary.
- Complete the contract-governed CI command set
  - Add and wire the following commands:
    - `pnpm test:e2e:contract`
    - `pnpm contract:coverage:scan`
    - `pnpm check:doc-coverage`
    - `pnpm contract:codegen:check`
  - Make all of them release-blocking.
- Make Lighthouse/performance validation real instead of placeholder-only
  - Replace placeholder performance workflow steps with actual Lighthouse CI execution.
  - Enforce `lighthouse-budget.json` in CI.
- Complete the required security scan matrix
  - Add and enforce:
    - `osv-scanner --recursive .`
    - `trivy fs --severity HIGH,CRITICAL .`
    - Semgrep security rules
    - lockfile integrity checks
  - Remove non-essential `continue-on-error` for release-blocking security jobs.

### 21.2 P1 — Architecture Closure Tasks

- Create a real SDK compatibility boundary
  - Add:
    - `src/services/matrix/sdk-entry.ts`
    - `src/services/matrix/sdk-compat.ts`
    - `src/services/matrix/sdk-errors.ts`
  - Centralize all approved SDK exports, subpath handling, and SDK error normalization there.
- Eliminate service-layer direct SDK imports outside the boundary
  - Migrate existing direct imports from `matrix-js-sdk` to the compatibility boundary.
  - Enforce the rule across `src/services/matrix/**`.
- Isolate all `matrix-js-sdk/src/*` imports
  - Move all subpath imports such as `manager-extensions` into the compatibility boundary only.
  - Fail CI if new subpath imports are added outside that boundary.
- Normalize SDK errors into frontend-safe application errors
  - Implement a unified SDK error mapping layer.
  - Standardize capability-missing, transport, auth, and runtime-degradation errors.
- Reduce type augmentation debt
  - Audit every declaration in `src/types/matrix-js-sdk-augmentations.d.ts`.
  - Classify each item as:
    - already exported by SDK
    - still needed temporarily
    - should move to local wrapper types
    - should be removed
  - Add an owner and removal target for every retained augmentation.
  - Shrink the augmentation file materially.
- Resolve main-thread vs worker client ownership
  - Decide whether the main thread or worker is the single owner of:
    - `createClient()`
    - `startClient()`
    - Sliding Sync lifecycle
  - Remove duplicate initialization and duplicate startup logic.
- Complete capability-domain migration evidence
  - For each domain, provide explicit migration status and test evidence:
    1. auth/session
    2. user/profile/device/presence
    3. room/timeline/message/reaction/thread/receipt
    4. crypto/key backup/verification
    5. notifications/push
    6. space/admin/media/synapse extensions

### 21.3 P2 — Testing, Metrics, and Documentation Closure

- Expand E2E coverage to the required scenario count
  - Reach at least 30 deterministic core-flow scenarios as defined in §20.3.
  - Cover login, restore, send/receive, edit, redact, thread, reaction, upload, download, voice, VoIP, crypto, admin, offline, and fallback UI.
- Complete browser/platform compatibility coverage
  - Add missing automated or managed validation for:
    - Firefox
    - desktop WebKit/Safari-equivalent coverage
    - Edge-equivalent coverage
  - Keep mobile Chromium and mobile Safari coverage green.
- Enforce unit-test coverage thresholds
  - Add hard thresholds for:
    - overall project coverage `>= 80%`
    - `src/services/** >= 90%`
  - Block CI on downward drift beyond the allowed threshold.
- Generate and commit a bundle baseline
  - Produce the baseline artifact required by the bundle regression gate.
  - Compare future builds against the baseline in strict mode.
- Fill the benchmark table with real measurements
  - Replace all `TBD` values in §12 with actual baseline and post-change numbers.
  - Include:
    - `hula-total-boot`
    - `hula-mount-to-ready`
    - first login restore usable time
    - first room list visible
    - first active room timeline visible
    - desktop/mobile bundle metrics
    - large-room performance indicators
- Produce phase test reports and final acceptance reports
  - Generate reports using the template in §13 for each major phase.
  - Include desktop and mobile results.
- Produce rollback rehearsal evidence
  - Validate rollback using the pinned SDK artifact and previous known-good package.
  - Record measured rollback time and include it in the release report.
- Fix generated report synchronization
  - Regenerate all derived governance artifacts from the latest repo state.
  - Ensure `compatibility-report.md`, transport inventory, metrics, and acceptance data are mutually consistent.
- Add documentation review metadata
  - Add `last_reviewed` frontmatter to this plan and keep it aligned with the release tag.
  - Ensure architecture docs and code state are reviewed together at release time.

### 21.4 Current Exit Criteria Not Yet Met

The optimization program must NOT be considered complete until all of the following are true:

- Release validation uses a pinned SDK tarball artifact instead of local `link:` mode
- `sdk-pin.json` is fully populated and verified
- `check:sdk-types` is mandatory and blocking
- Transport governance is mandatory and blocking
- Contract coverage tooling is implemented and green
- E2E scenario inventory reaches the required minimum
- Coverage thresholds are enforced in CI
- Performance gates use real measured baselines
- Security gates meet the documented zero-high/zero-critical requirement
- SDK compatibility boundary is fully established
- Type augmentation debt is materially reduced
- Main-thread and worker ownership is unambiguous
- Final reports, rollback artifacts, and documentation sync are complete

### 21.5 Recommended Execution Order

1. Lock CI gates first.
2. Complete SDK pinning and tarball-based release validation.
3. Establish the SDK compatibility boundary and remove uncontrolled imports.
4. Resolve worker/main ownership and finish capability-domain migration.
5. Complete contract coverage, E2E expansion, and coverage thresholds.
6. Fill performance baselines, generate reports, and finish rollback rehearsal.

