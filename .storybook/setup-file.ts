import { vi } from 'vitest'

vi.mock('debug', () => {
  const debugFn = (..._args: unknown[]) => {}
  return {
    default: Object.assign(debugFn, {
      enabled: false,
      namespace: '',
      log: (..._args: unknown[]) => {}
    })
  }
})

// 截断 matrix-js-sdk 运行时导入：
// stories 通过 services 间接导入 matrix-js-sdk 的 enum/class（SlidingSyncState、createClient 等），
// 这些 CJS 代码在浏览器中执行会访问 process.env 并触发 Vite 运行时依赖发现（reload）。
// Stories 只测 UI，不需要真实 SDK 行为，用空 mock 截断导入链。
vi.mock('matrix-js-sdk', () => ({
  createClient: () => ({}),
  initializeManagerExtensions: () => ({}),
  SlidingSync: class {},
  SlidingSyncEvent: {},
  SlidingSyncState: { Top: 'top', Bottom: 'bottom', Live: 'live' },
  Direction: { Forward: 'f', Backward: 'b' },
  EventType: { Message: 'm.room.message' },
  ClientEvent: {},
  RoomEvent: {},
  RoomStateEvent: {},
  MatrixEvent: class {},
  Room: class {},
  RoomMember: class {},
  User: class {},
  NotificationCountType: { Highlight: 'highlight', Total: 'total', Symbol: 'symbol' },
  PendingEventOrdering: { Detached: 'detached', Aggressive: 'aggressive', Strict: 'strict' },
  ReceiptType: { Read: 'm.read', ReadPrivate: 'm.read.private', FullyRead: 'm.fully_read' },
  PushRuleKind: {},
  TweakName: {},
  Preset: {},
  Visibility: {},
  JoinRule: {},
  HTTPError: class extends Error {}
}))

vi.mock('matrix-js-sdk/crypto', () => ({
  CryptoEvent: {},
  VerificationPhase: {},
  VerificationRequestEvent: {}
}))

vi.mock('matrix-js-sdk/friend', () => ({
  FriendEvent: {},
  Friend: class {},
  FriendRequest: class {},
  FriendManager: class {}
}))
