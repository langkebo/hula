/**
 * Approved compatibility shims for local matrix-js-sdk integration.
 *
 * Any `matrix-js-sdk/<subpath>` import that is not covered by `sdk.ts` / `sdk-entry.ts`
 * must stay in this file so CI can guard the boundary. Consumers should use exported
 * helpers instead of importing subpaths themselves.
 */

import 'matrix-js-sdk/manager-extensions'

// `@types/partials` holds SDK enums like `JoinRule` that never flow through the
// package's main entry. Routing them here keeps consumer services off the
// bare `matrix-js-sdk/@types/*` subpath.
export type { JoinRule } from 'matrix-js-sdk/@types/partials'
export type {
  CreateDmOptions,
  DirectMessageManager,
  DmPartnerResponse,
  DmRoomInfo,
  IDirectRoomsMap
} from 'matrix-js-sdk/dm'
export { extendMatrixClientWithManagers } from 'matrix-js-sdk/manager-extensions'
export type { Space, SpaceManager, SpaceMember, SpaceQueryOptions } from 'matrix-js-sdk/space'
export { IndexedDBStoreWorker } from 'matrix-js-sdk/store/worker'
export type { TelemetryManager } from 'matrix-js-sdk/telemetry'

let compatInitialized = false

export function ensureMatrixSdkCompat(): void {
  // Import side effects above install custom manager extensions exactly once
  // per module graph. This function gives callers an explicit boundary hook.
  compatInitialized = true
}

export function isMatrixSdkCompatReady(): boolean {
  return compatInitialized
}
