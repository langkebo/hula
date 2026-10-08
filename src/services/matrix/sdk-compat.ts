/**
 * Approved compatibility shims for local matrix-js-sdk integration.
 *
 * Any `matrix-js-sdk/<subpath>` import that is not covered by `sdk.ts` / `sdk-entry.ts`
 * must stay in this file so CI can guard the boundary. Consumers should use exported
 * helpers instead of importing subpaths themselves.
 *
 * NOTE: Manager extensions are now initialized via `initializeManagerExtensions`
 * from the main `matrix-js-sdk` entry, ensuring they modify the pre-bundled
 * version's MatrixClient.prototype. Do not import manager-extensions here.
 */

// `@types/partials` holds SDK enums like `JoinRule` that never flow through the
// package's main entry. Routing them here keeps consumer services off the
// bare `matrix-js-sdk/@types/*` subpath.

import type { MatrixClient } from 'matrix-js-sdk'

export type { Space, SpaceChild, SpaceManager, SpaceMember } from 'matrix-js-sdk/space'

// WidgetManager (and its response types) are NOT exposed as a public subpath
// export by the SDK fork — there is no `matrix-js-sdk/widget` entry — so the type is
// derived from the augmented `MatrixClient.getWidgetManager()` getter. Deriving here
// keeps consumers off the internal `lib/widget` path and gives CI one boundary to guard.
// 旧层 `WidgetsManager`（`src/widgets/`）已按反冗余原则整层删除（SDK C1）。
export type WidgetManager = ReturnType<MatrixClient['getWidgetManager']>

let compatInitialized = false

function _ensureMatrixSdkCompat(): void {
  // Import side effects above install custom manager extensions exactly once
  // per module graph. This function gives callers an explicit boundary hook.
  compatInitialized = true
}

function _isMatrixSdkCompatReady(): boolean {
  return compatInitialized
}
