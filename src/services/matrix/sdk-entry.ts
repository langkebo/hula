/**
 * Canonical SDK entrypoint for HuLa.
 *
 * Services that need SDK symbols should import from this module instead of
 * importing `matrix-js-sdk` directly. This keeps the approved public surface
 * explicit and gives us one place to tighten governance later.
 */

export type {
  AdminManager,
  Friend,
  FriendRequest,
  IContent,
  ICreateClientOpts,
  ICreateRoomOpts,
  ILoginRequest,
  IPusher,
  IPusherRequest,
  IPushRule,
  IPushRules,
  IRegisterRequest,
  IRequestTokenResponse,
  ISendEventResponse,
  ISyncStateData,
  LoginResponse,
  MatrixClient,
  MatrixEvent,
  MSC3575RoomData,
  MSC3575SlidingSyncResponse,
  PresenceManager,
  PushManager,
  PushRuleAction,
  ReadReceiptsManager,
  Room,
  RoomMember,
  RoomState,
  SearchResponse,
  TypingManager,
  User
} from './sdk'
export {
  ClientEvent,
  CryptoEvent,
  createClient,
  Direction,
  EventType,
  FriendEvent,
  FriendManager,
  IndexedDBStore,
  MemoryStore,
  Method,
  NotificationCountType,
  PendingEventOrdering,
  Preset,
  PushRuleKind,
  ReceiptType,
  RoomEvent,
  RoomStateEvent,
  RoomType,
  SlidingSync,
  SlidingSyncEvent,
  SlidingSyncState,
  SyncState,
  TweakName,
  VerificationPhase,
  VerificationRequestEvent,
  Visibility
} from './sdk'

// Subpath-only types routed through the compat shim — consumers should never
// import `matrix-js-sdk/dm` or `matrix-js-sdk/@types/*` directly.
export type {
  CreateDmOptions,
  DirectMessageManager,
  DmPartnerResponse,
  DmRoomInfo,
  IDirectRoomsMap,
  JoinRule
} from './sdk-compat'
