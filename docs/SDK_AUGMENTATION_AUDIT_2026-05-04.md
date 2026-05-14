# matrix-js-sdk Augmentation Audit (2026-05-04)

Total declarations in `src/types/matrix-js-sdk-augmentations.d.ts`: **119**.

## Summary

| Bucket | Count | Recommended action |
|---|---:|---|
| EXPORTED by SDK + 0 consumers | 31 | **Delete now** — already in SDK, nothing references the augmentation |
| EXPORTED by SDK + has consumers | 42 | **Remove after consumers route via sdk-entry** — augmentation shadows the real SDK export |
| Not in SDK + 0 consumers | 39 | **Delete now** — pure deadwood, no SDK source, nobody uses it |
| Not in SDK + has consumers | 7 | **Keep for now** — still load-bearing; assess whether to upstream into SDK or move to local wrapper types |

Methodology: parsed all 119 `export` declarations under the `declare module` block, cross-referenced names against `../matrix-js-sdk/src/**/*.ts` exports (2,428 unique symbols), then scanned `src/**/*.{ts,vue,tsx}` (excluding the augmentation file itself) for word-boundary references.

Caveat: name-based matching is a heuristic. A name collision (e.g. an interface called `Filter` defined locally in a component) would inflate consumer counts; conversely, augmentations consumed only via type inference or via re-exports may be undercounted. Cross-check with `vue-tsc` after every batch deletion.

## safe-delete (EXPORTED + 0 consumers) (31)

| Line | Kind | Name | Consumers |
|---:|---|---|---:|
| 13 | enum | `Method` | 0 |
| 21 | enum | `ClientPrefix` | 0 |
| 55 | enum | `RoomType` | 0 |
| 91 | type | `EmptyObject` | 0 |
| 124 | interface | `IPublicRoomsResponse` | 0 |
| 222 | interface | `RegisterResponse` | 0 |
| 230 | interface | `IRequestTokenResponse` | 0 |
| 236 | interface | `IEventRelation` | 0 |
| 268 | interface | `MatrixCall` | 0 |
| 303 | interface | `OidcClientConfig` | 0 |
| 315 | type | `PushRuleSet` | 0 |
| 319 | interface | `IPushRuleCondition` | 0 |
| 366 | class | `TimelineWindow` | 0 |
| 372 | interface | `EventTimeline` | 0 |
| 380 | interface | `TimelineWindow` | 0 |
| 389 | enum | `VoiceEvent` | 0 |
| 401 | interface | `VoiceConfig` | 0 |
| 411 | interface | `VoiceMessageUploadParams` | 0 |
| 420 | interface | `VoiceMessageUploadResult` | 0 |
| 428 | interface | `VoiceMessage` | 0 |
| 436 | interface | `VoiceMessageInfo` | 0 |
| 444 | interface | `VoiceStats` | 0 |
| 562 | class | `LocalStorageCryptoStore` | 0 |
| 913 | interface | `EventTimelineSet` | 0 |
| 1223 | interface | `Filter` | 0 |
| 1368 | interface | `KeyBackupSession` | 0 |
| 1376 | interface | `KeyBackupRoomSessions` | 0 |
| 1416 | interface | `UserDirectorySearchResponse` | 0 |
| 1451 | interface | `ThirdPartyProtocol` | 0 |
| 1462 | interface | `ThirdPartyUser` | 0 |
| 1469 | interface | `ThirdPartyLocation` | 0 |

## remove-after-consumer-migration (EXPORTED + has consumers) (42)

| Line | Kind | Name | Consumers |
|---:|---|---|---:|
| 29 | const | `Visibility` | 9 |
| 33 | type | `Visibility` | 9 |
| 35 | enum | `Preset` | 9 |
| 41 | const | `PushRuleKind` | 6 |
| 48 | type | `PushRuleKind` | 6 |
| 50 | enum | `NotificationCountType` | 9 |
| 59 | enum | `Direction` | 4 |
| 64 | enum | `EventType` | 10 |
| 85 | enum | `TweakName` | 3 |
| 90 | type | `PushRuleAction` | 4 |
| 96 | interface | `ICreateRoomOpts` | 7 |
| 140 | interface | `MSC3575RoomData` | 1 |
| 154 | class | `SlidingSync` | 8 |
| 189 | interface | `ICreateClientOpts` | 1 |
| 213 | interface | `LoginResponse` | 3 |
| 244 | interface | `ISendEventResponse` | 3 |
| 287 | interface | `IContent` | 4 |
| 328 | interface | `IPushRule` | 7 |
| 337 | interface | `IPushRules` | 6 |
| 342 | interface | `IPusher` | 7 |
| 360 | interface | `IPusherRequest` | 4 |
| 489 | interface | `VoiceMessageManager` | 1 |
| 509 | interface | `TypingManager` | 3 |
| 521 | interface | `ReadReceiptsManager` | 4 |
| 536 | class | `MatrixError` | 1 |
| 541 | enum | `SlidingSyncState` | 1 |
| 545 | enum | `SlidingSyncEvent` | 2 |
| 549 | interface | `MSC3575SlidingSyncResponse` | 1 |
| 555 | class | `IndexedDBStore` | 3 |
| 559 | class | `MemoryStore` | 3 |
| 567 | interface | `MatrixClient` | 106 |
| 888 | class | `MatrixEvent` | 31 |
| 918 | class | `Room` | 69 |
| 995 | interface | `RoomMember` | 13 |
| 1026 | interface | `User` | 26 |
| 1039 | interface | `BurnAfterReadManager` | 1 |
| 1060 | interface | `PresenceManager` | 3 |
| 1071 | class | `RoomState` | 7 |
| 1103 | interface | `SearchResult` | 3 |
| 1199 | interface | `RoomSummary` | 6 |
| 1380 | interface | `KeyBackupInfo` | 1 |
| 1389 | interface | `Device` | 13 |

## deadwood (MISSING + 0 consumers) (39)

| Line | Kind | Name | Consumers |
|---:|---|---|---:|
| 112 | interface | `IPublicRoomsOpts` | 0 |
| 248 | interface | `ILoginRequest` | 0 |
| 258 | interface | `IRegisterRequest` | 0 |
| 283 | interface | `VoIPHandler` | 0 |
| 293 | interface | `IMemberEvent` | 0 |
| 450 | interface | `VoiceConvertParams` | 0 |
| 456 | interface | `VoiceConvertResult` | 0 |
| 463 | interface | `VoiceOptimizeParams` | 0 |
| 469 | interface | `VoiceOptimizeResult` | 0 |
| 1089 | interface | `SearchParams` | 0 |
| 1117 | interface | `SyncParams` | 0 |
| 1125 | interface | `SyncResponse` | 0 |
| 1149 | interface | `TimelineData` | 0 |
| 1155 | interface | `StateData` | 0 |
| 1159 | interface | `EphemeralData` | 0 |
| 1163 | interface | `InvitedRoom` | 0 |
| 1169 | interface | `LeftRoom` | 0 |
| 1174 | interface | `PresenceUpdate` | 0 |
| 1182 | interface | `DeviceMessages` | 0 |
| 1188 | interface | `DeviceLists` | 0 |
| 1193 | interface | `UnreadNotifications` | 0 |
| 1215 | interface | `PaginatedMessages` | 0 |
| 1240 | interface | `FilterPresence` | 0 |
| 1248 | interface | `FilterAccountData` | 0 |
| 1256 | interface | `FilterRoom` | 0 |
| 1271 | interface | `FilterRoomAccountData` | 0 |
| 1279 | interface | `FilterRoomEphemeral` | 0 |
| 1287 | interface | `FilterRoomState` | 0 |
| 1296 | interface | `FilterRoomTimeline` | 0 |
| 1307 | interface | `EventRelation` | 0 |
| 1319 | interface | `MessageEditContent` | 0 |
| 1358 | interface | `ThreadBundle` | 0 |
| 1399 | interface | `DeviceUpdate` | 0 |
| 1405 | interface | `DeviceDeletion` | 0 |
| 1411 | interface | `UserDirectorySearchParams` | 0 |
| 1421 | interface | `UserDirectoryResult` | 0 |
| 1439 | interface | `GroupUser` | 0 |
| 1443 | interface | `GroupProfile` | 0 |
| 1455 | interface | `ThirdPartyProtocolInstance` | 0 |

## still-needed (MISSING + has consumers) (7)

| Line | Kind | Name | Consumers |
|---:|---|---|---:|
| 477 | interface | `VoiceTranscriptionParams` | 1 |
| 483 | interface | `VoiceTranscriptionResult` | 1 |
| 1097 | interface | `SearchResponse` | 1 |
| 1140 | interface | `RoomData` | 1 |
| 1208 | interface | `PaginationParams` | 1 |
| 1340 | interface | `ReplyContent` | 1 |
| 1429 | interface | `Group` | 5 |

## Suggested execution order

1. **Batch 1 — deadwood deletion (no risk):** drop the 70 declarations in the two "0 consumers" buckets. Run `pnpm vue-tsc --noEmit` and the matrix vitest suite after each section to confirm no inferred-type fallout.
2. **Batch 2 — boundary-routed cleanup:** for each of the 42 EXPORTED+used declarations, verify the consumer imports through `@/services/matrix/sdk-entry` (which already re-exports from `matrix-js-sdk/core`). If yes, delete the augmentation; the real SDK export takes over. If consumers still import via the bare `matrix-js-sdk` specifier or rely on augmentation-only fields, fix the consumer first.
3. **Batch 3 — remaining 7 "still-needed":** for each, decide between (a) upstreaming into the linked SDK source, or (b) moving the type into a local wrapper file (e.g. `src/services/matrix/types/`) so the augmentation file can ultimately disappear.

## Final exit criteria for Phase 2 (per plan §5.3)

- Augmentation file shrinks materially: target ≤ 200 lines (from current 1,475) once Batch 1 + 2 land.
- Every retained declaration has an explicit owner comment and removal target.
- `pnpm check:sdk-types` and `vue-tsc --noEmit` remain green throughout.

---

## Postscript — 2026-05-05: shrinkage attempt findings

A first pass at Batch 1 (remove all 70 "0 consumer" entries) was executed and reverted. Outcome recorded so the next attempt avoids repeating the same diagnostic loop.

### Observed regression shape

Pre-shrinkage baseline: `pnpm vue-tsc --noEmit` reports **82 errors** at HEAD (pre-existing, unrelated to this audit).

Post-shrinkage (augmentation reduced to 96 lines, `export * from 'matrix-js-sdk'` replaced with `export {}`): **107 errors**. Net **+25 new errors**, all of the same two shapes:

1. `TS7016: Could not find a declaration file for module 'matrix-js-sdk'` (and `/friend`, `/dm`) — on call sites that import from the bare specifier.
2. `TS18046: 'roomData' is of type 'unknown'` inside `MatrixSlidingSyncService.ts` — the `SlidingSyncEvent.RoomData` callback signature loses its parameter type.

### Root cause

The sibling `matrix-js-sdk` repo does **not** ship built `.d.ts` files at `../matrix-js-sdk/lib/**/*.d.ts` (its own `tsc` pack step fails on TS5097 `allowImportingTsExtensions` errors — same issue blocking `pnpm sdk:pack`). TypeScript therefore has no primary declaration for `matrix-js-sdk` / `matrix-js-sdk/friend` / `matrix-js-sdk/dm`.

Two of this project's ambient files compensate:

- `src/types/matrix.d.ts` — top-level **script** file (no `export`), so `declare module 'matrix-js-sdk'` is parsed as a *full module declaration*. It stands in for the missing `lib/index.d.ts`.
- `src/types/matrix-js-sdk-augmentations.d.ts` — top-level **module** file (has `export * from 'matrix-js-sdk'`), so `declare module` is parsed as an *augmentation* that merges with the declaration from `matrix.d.ts`.

When the shrinkage replaced `export * from 'matrix-js-sdk'` with `export {}`, the augmentation file stopped re-exporting the type surface through the bare specifier. Separately, deleting the `SlidingSync` / `MSC3575RoomData` block removed the overload TypeScript relied on to infer `roomData`. The two fixes combined produced the 25-error cascade.

Adding `export {}` to `matrix.d.ts` reproduces the same cascade (confirmed by a controlled isolation run) — that file's script-form is what supplies the primary type surface.

### What shipped this turn (safe)

- **Deleted** the `declare module 'matrix-js-sdk/src/telemetry'` block in `src/types/matrix.d.ts` (−42 lines). Zero new `vue-tsc` errors (82 → 82). `matrix-js-sdk/src/telemetry` has no importers anywhere under `src/`.
- **Relaxed** `scripts/check-sdk-augmentations.mjs` to no longer hard-fail when the augmented-enum set is empty (supports the eventual end state of Phase 2).

### What is blocked

Batches 1 and 2 of the audit cannot land until one of these prerequisites is true:

1. The SDK's type distribution gets fixed — its `pnpm pack` produces working `lib/*.d.ts` so `matrix-js-sdk`, `matrix-js-sdk/friend`, `matrix-js-sdk/dm`, `matrix-js-sdk/core`, etc. resolve from their real shipping types. This is the same work that unblocks `sdk:pack`.
2. **OR** every consumer under `src/` migrates off bare `matrix-js-sdk` imports to the `@/services/matrix/sdk-entry` boundary (plan §21.2 P1). Once no code-path relies on `matrix-js-sdk` bare-specifier types, the augmentation is free to shrink without regressing `vue-tsc`.

Until then, `matrix-js-sdk-augmentations.d.ts` stays at HEAD. Further attempts should not touch the augmentation file in isolation.

### Verification commands

```
pnpm exec vue-tsc --noEmit 2>&1 | grep -cE "error TS"    # expect 82 (HEAD baseline)
pnpm check:sdk-types                                      # reports 60 warnings vs baseline=0; pre-existing
wc -l src/types/matrix-js-sdk-augmentations.d.ts          # expect 1487 (HEAD)
wc -l src/types/matrix.d.ts                               # expect 214 (-42 vs HEAD's 256)
```

---

## Postscript — 2026-05-05: SDK type distribution fixed (§21.1 tarball work)

The SDK build is no longer broken. Three small fixes in the sibling `matrix-js-sdk` repo:

1. `tsconfig-build.json` — `allowImportingTsExtensions: false` → `true`, plus `rewriteRelativeImportExtensions: true` (TS 5.7+). The SDK's source uses `from "./foo.ts"` everywhere; Babel rewrote those for `.js` output but `tsc --emitDeclarationOnly` was rejecting them with TS5097. The TS-side rewriter resolves it cleanly.
2. `src/base64.ts` — `decodeBase64()` return type narrowed from `Uint8Array` to `Uint8Array<ArrayBuffer>`. `fromBase64` always returns an ArrayBuffer-backed view at runtime, but its lib type widened to `Uint8Array<ArrayBufferLike>` in TS 5.7. The narrow cast at the source clears 7 downstream Web-Crypto-API errors in `EncryptionManager.ts`, `RTCEncryptionManager.ts`, and the `*AESSecretStorageItem.ts` pair without per-call-site casts.
3. `package.json` — `clean` now removes `node_modules/.tsbuildinfo` alongside `lib/`. Without this, the second `pnpm pack` invocation in a session would re-run `prepare` → `pnpm clean && pnpm build`, but `build:types` saw the stale incremental cache and emitted only the diff (often a single file), leaving the tarball with almost no `.d.ts`.

### Verified outcome

| Check | Before | After |
|---|---:|---:|
| `find ../matrix-js-sdk/lib -name '*.d.ts' \| wc -l` after `pnpm build` | 0 | 611 |
| `tar -tzf vendor/matrix-js-sdk.tgz \| grep -c '\.d\.ts$'` after `pnpm sdk:pack` | 6 | 611 |
| Tarball ships `lib/{index,core,friend,dm,admin,push,crypto-api,space,telemetry,manager-extensions}*.d.ts` | partial | all 10 |
| `pnpm exec vue-tsc --noEmit` errors in hula | 82 | 47 |

### What this unblocks for augmentation shrinkage

The augmentation file is no longer the *primary* type source for bare `matrix-js-sdk` — the SDK's real `lib/index.d.ts` is now reachable. The 25-error TS7016 / TS18046 cascade documented above no longer reproduces.

The remaining 47 vue-tsc errors include some new entries that surface precisely because real SDK types are now visible and the augmentation now *conflicts* with them (e.g. `sdk.ts:51` `RoomEvent`/`RoomStateEvent`/`SyncState` "no exported member"; `MatrixClientService.ts:713` two distinct `ICreateRoomOpts` types; `MatrixDirectMessageService.ts` missing `dmManager` on `MatrixClient`). These are exactly the conflict points Batch 2 of the audit predicted — they become removable when the consumer side is migrated to the real SDK shapes (or when the augmentation's competing declarations are deleted).

The other 47-list entries (Storybook stories with `as any` patterns, etc.) are pre-existing and orthogonal to SDK types.

### Verification commands (current)

```
pnpm exec vue-tsc --noEmit 2>&1 | grep -cE "error TS"    # 47
pnpm check:sdk-types                                      # warnings (pre-existing baseline drift)
node scripts/check-sdk-boundary.mjs                       # 0 violations
pnpm verify:sdk-pin                                       # ok
pnpm sdk:pack                                             # produces 3.7MB tarball with 611 .d.ts files
```
