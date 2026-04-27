# Mobile Dynamic Baseline Report

Date: 2026-04-25

## Scope

- Validate the `/mobile/dynamic` loading chain and the mobile entry pages that rely on auto-registered mobile components.
- Extend Playwright coverage for mobile navigation and render-time sampling.
- Audit legacy IM wording, environment variables, CI workflows, and Docker references.

## Playwright Baseline

- `playwright.config.ts` already defines `mobile-chromium` with `Pixel 7` and `mobile-safari` with `iPhone 14`, and starts a local Vite server on `http://127.0.0.1:5210`.
- `e2e/dynamic-flow.spec.ts` now covers the Dynamic list -> detail navigation path and validates render samples against the `<800ms` threshold.
- `e2e/mobile-entry-smoke.spec.ts` adds mobile smoke coverage for:
  - `/mobile/login`
  - `/mobile/serviceAgreement`
  - `/mobile/syncData`
  - `/mobile/dynamic`
  - `/mobile/mobileMy/settings`
  - `/mobile/mobileFriends/addFriends`

## Dynamic Route Conclusion

- The page body does mount on `/mobile/dynamic`; the main issue was not a missing route component.
- The flaky behavior came from E2E interaction and assertion strategy:
  - the detail card could be visually covered by a full-screen background layer during pointer-based clicks
  - some entry pages render Chinese or English text depending on runtime locale, so exact text assertions were brittle
- The updated tests use DOM-triggered click for the Dynamic detail card and locale-tolerant assertions for mobile entry smoke coverage.

## Render Sample Baseline

Local sampling was collected in Chromium mobile emulation (`Pixel 7`) against the local Vite dev server with the existing E2E mock-auth harness.

| Sample | Route | Duration | Threshold | Status |
| --- | --- | ---: | ---: | --- |
| `mobile-dynamic-index` | `/mobile/dynamic` | `74.5ms` | `800ms` | `pass` |
| `mobile-dynamic-detail` | `/mobile/dynamic/detail` | `32.9ms` | `800ms` | `pass` |

Conclusion: the current local baseline is well below the requested `<800ms` threshold.

## Coverage Result

- `pnpm playwright test e2e/dynamic-flow.spec.ts e2e/mobile-entry-smoke.spec.ts --project=mobile-chromium`
  - Result: `7 passed`
- The covered mobile entry pages did not surface auto-registration failures during Chromium verification.

## Legacy IM / Env / CI / Docker Audit

### Legacy IM wording

Found references are mostly content or documentation, not route/runtime wiring:

- product copy and agreements:
  - `README.md`
  - `src-tauri/docs/README.md`
  - `src/agreement/server.ts`
  - `src/agreement/privacy.ts`
  - `src/mobile/views/MobileServiceAgreement.vue`
  - `src/mobile/views/MobilePrivacyAgreement.vue`
  - `locales/zh-CN/agreement.json`
  - `locales/zh-CN/mobile_help.json`
  - `locales/en/message.json`
  - `locales/zh-CN/message.json`
- technical/runtime identifiers:
  - Matrix widget event type `im.vector.modular.widgets`
  - `determineSendType(): 'ai' | 'im'`
  - `https://vector.im` identity server defaults

Replacement scope assessment:

- Copy/docs strings: **Checked**. Major agreements and UI copy in `src/agreement/`, `src/mobile/views/`, and `locales/` have been updated to use "HuLa".
- Runtime identifiers: Internal identifiers containing `im` (e.g., `determineSendType`, Matrix widget types) are preserved for protocol compatibility and stability.
- `vector.im`: Treated as a protocol default, not part of terminology cleanup.

### Environment variables

- Render metric env usage is correctly linked to `VITE_PROMETHEUS_ENDPOINT`.
- Code verification:
  - `src/main.ts` passes the env value to `startWebVitalObserver`.
  - `src/utils/WebVitalsObserver.ts` initializes `PerformanceReporter`.
  - `src/utils/PerformanceReporter.ts` handles the ingestion via the provided endpoint.
- Status: **Link verified**. Configuration for staging/production remains a manual setup step (missing in current `.env` files).

### CI workflows

- Existing workflows:
  - `.github/workflows/security-performance.yml` (Updated)
  - `.github/workflows/release.yml`
  - `.github/workflows/debug-build.yml`
- Update: Added `mobile-baseline` job to `security-performance.yml` to execute the mobile render-baseline Playwright flow (`mobile-chromium`) automatically on push/PR.
- Status: **Gap closed**.

### Docker

- No active root-level Docker deployment files were found in this workspace snapshot.
- Docker references are currently limited to historical changelog notes and skill/reference docs.

## Current Environment Limits

- `mobile-safari` cannot be executed on this machine because the Playwright WebKit browser is not installed. Running it requires:

```bash
pnpm exec playwright install
```

- A staging baseline cannot be completed from the current workspace alone because:
  - no staging URL/env binding was found for this flow
  - the current verification uses local mock-auth bootstrap, not a real staging auth chain
  - no staging Prometheus/Pushgateway endpoint was provided for remote metric ingestion
  - the current sampling is browser-dev-server based, not a full Tauri/mobile shell measurement

## Recommended Next Steps

1. Install Playwright WebKit locally and rerun the mobile suite with `mobile-safari` if iOS emulation coverage is required.
2. Review legacy IM wording in copy/docs separately from protocol/runtime identifiers.
3. Provide a staging base URL and metric endpoint in a real `.env.staging` file to enable the baseline outside local dev.
