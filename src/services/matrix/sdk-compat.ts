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

export type { Space, SpaceChild, SpaceManager, SpaceMember } from 'matrix-js-sdk/space'

let compatInitialized = false

function _ensureMatrixSdkCompat(): void {
  // Import side effects above install custom manager extensions exactly once
  // per module graph. This function gives callers an explicit boundary hook.
  compatInitialized = true
}

function _isMatrixSdkCompatReady(): boolean {
  return compatInitialized
}
