import { describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { subscribeManagerEvents } from '../useWsEventHandler'

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }))
vi.mock('@tauri-apps/api/webviewWindow', () => ({ WebviewWindow: vi.fn() }))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn().mockReturnValue({
      getFriendManager: vi.fn().mockReturnValue({
        on: vi.fn(() => () => {}),
        off: vi.fn()
      }),
      getBurnAfterReadManager: vi.fn().mockReturnValue({
        on: vi.fn(() => () => {}),
        off: vi.fn()
      }),
      getWidgetManager: vi.fn().mockReturnValue({
        on: vi.fn(() => () => {}),
        off: vi.fn()
      })
    }),
    waitForClientReady: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('@/services/matrix/friends/MatrixFriendService', () => ({
  matrixFriendService: {},
  MatrixFriendService: vi.fn()
}))

vi.mock('@/services/matrix/friends/MatrixSpecialFriendService', () => ({
  MatrixSpecialFriendService: vi.fn()
}))

// 避免 matrix-js-sdk 重型转换（~6.7s）导致 5s 默认超时
vi.mock('@/services/matrix/MatrixEventService', () => ({
  default: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), convertEventToMessage: vi.fn() }
}))

// 截断所有 matrix-js-sdk 直接导入路径（user/contacts store 传递依赖）
vi.mock('matrix-js-sdk', () => ({
  Direction: { Forward: 'f', Backward: 'b' },
  EventType: { Message: 'm.room.message' },
  PushRuleKind: {},
  Visibility: {},
  ClientEvent: {},
  RoomEvent: {},
  RoomStateEvent: {}
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  })
}))

describe('Manager event subscription', () => {
  it('subscribeManagerEvents is exported and callable', () => {
    expect(typeof subscribeManagerEvents).toBe('function')
  })

  it('subscribeManagerEvents returns unsubscribe function', async () => {
    const unsub = await subscribeManagerEvents()
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('subscribeManagerEvents subscribes to WidgetManager', async () => {
    const client = matrixClientService.getClient() as unknown as {
      getWidgetManager: () => { on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> }
    }
    const widgetMgr = client.getWidgetManager()
    widgetMgr.on.mockClear()
    widgetMgr.off.mockClear()

    const unsub = await subscribeManagerEvents()
    expect(widgetMgr.on).toHaveBeenCalled()
    unsub()
    expect(widgetMgr.off).toHaveBeenCalled()
  })
})
