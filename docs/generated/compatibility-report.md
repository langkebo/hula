# HuLa Compatibility Report

Generated: 2026-05-03T11:36:33.851Z
Plan: docs/HULA_SDK_REINTEGRATION_OPTIMIZATION_PLAN_2026-05-03.md §20.11

## Summary

| Step | Status | Duration | Detail |
| --- | --- | --- | --- |
| toolchain | [PASS] | 289 ms | node=22.22.2, pnpm=10.33.0 |
| sdk-pin | [PASS] | 74 ms | verify-sdk-pin: dev branch 'master', pin is empty, mode=link; ok. |
| env | [PASS] | 58 ms | validateEnv: all checks passed for VITE_HULA_ENV=dev-local (env=dev-local) |
| ledger-diff | [PASS] | 1 ms | ledger_schema=1, modules=49 |
| transport-audit | [WARN] | 240 ms | 155 call site(s) outside approved boundary; see docs/generated/transport-inventory.json |
| capability-probe | [WARN] | 9 ms | probe http://localhost:8008/_matrix/client/versions: HTTP undefined |

## Details

### toolchain — [PASS]

```text
node=22.22.2, pnpm=10.33.0
```

### sdk-pin — [PASS]

```text
verify-sdk-pin: dev branch 'master', pin is empty, mode=link; ok.
```

### env — [PASS]

```text
validateEnv: all checks passed for VITE_HULA_ENV=dev-local (env=dev-local)
```

### ledger-diff — [PASS]

```text
ledger_schema=1, modules=49
```

### transport-audit — [WARN]

```text
155 call site(s) outside approved boundary; see docs/generated/transport-inventory.json
```

### capability-probe — [WARN]

```text
probe http://localhost:8008/_matrix/client/versions: HTTP undefined
```

