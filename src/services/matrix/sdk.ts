/**
 * Matrix SDK re-exports
 *
 * This file provides a single entry point for matrix-js-sdk symbols
 * while avoiding the main services barrel file.
 */

export type {
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
  LoginResponse,
  MatrixClient,
  MatrixEvent,
  MSC3575RoomData,
  MSC3575SlidingSyncResponse,
  PresenceManager,
  PushRuleAction,
  ReadReceiptsManager,
  Room,
  RoomMember,
  RoomState,
  SearchResponse,
  TypingManager,
  User
} from 'matrix-js-sdk'
export {
  createClient,
  Direction,
  EventType,
  IndexedDBStore,
  MemoryStore,
  Method,
  NotificationCountType,
  PendingEventOrdering,
  Preset,
  PushRuleKind,
  ReceiptType,
  RoomType,
  SlidingSync,
  SlidingSyncEvent,
  SlidingSyncState,
  TweakName,
  Visibility
} from 'matrix-js-sdk'
export type { AdminManager } from 'matrix-js-sdk/admin'
export { ClientEvent } from 'matrix-js-sdk/client'
export { CryptoEvent, VerificationPhase, VerificationRequestEvent } from 'matrix-js-sdk/crypto'
export type {
  CreateReportBody,
  DismissReportBody,
  EscalateReportBody,
  EventReportCountResponse,
  EventReportManager,
  QueryParams,
  ReportResponse,
  ResolveReportBody,
  StatsResponse,
  StatusCountResponse,
  UpdateReportBody
} from 'matrix-js-sdk/event-report'
export type { Friend, FriendRequest } from 'matrix-js-sdk/friend'
export { FriendEvent, FriendManager } from 'matrix-js-sdk/friend'
export type {
  GuestManager,
  IAuthDict,
  IGuestInfo,
  IGuestLoginResponse,
  IGuestRegisterResponse,
  IServerGuestInfo,
  IUpgradeGuestRequest,
  IUpgradeGuestResponse
} from 'matrix-js-sdk/guest'
export { RoomEvent } from 'matrix-js-sdk/models/room'
export { RoomStateEvent } from 'matrix-js-sdk/models/room-state'
export type { PushManager } from 'matrix-js-sdk/push'
export type {
  CreateSessionResponse,
  GetMessagesResponse,
  RendezvousMessage,
  RendezvousSession,
  RendezvousSessionIntent,
  RendezvousSessionStatus,
  RendezvousSessionTransport,
  SendMessageResponse,
  UpdateSessionResponse
} from 'matrix-js-sdk/rendezvous'
export { RendezvousManager } from 'matrix-js-sdk/rendezvous'
export type { ISyncStateData } from 'matrix-js-sdk/sync'
export { SyncState } from 'matrix-js-sdk/sync'
