import { describe, expect, it, vi } from 'vitest'

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

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  })
}))

describe('Manager event subscription', () => {
  it('subscribeManagerEvents is exported and callable', async () => {
    const mod = await import('../useWsEventHandler')
    expect(typeof mod.subscribeManagerEvents).toBe('function')
  })

  it('subscribeManagerEvents returns unsubscribe function', async () => {
    const mod = await import('../useWsEventHandler')
    const unsub = await mod.subscribeManagerEvents()
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('subscribeManagerEvents subscribes to WidgetManager', async () => {
    const { matrixClientService } = await import('@/services/matrix/MatrixClientService')
    const client = matrixClientService.getClient() as unknown as {
      getWidgetManager: () => { on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> }
    }
    const widgetMgr = client.getWidgetManager()
    widgetMgr.on.mockClear()
    widgetMgr.off.mockClear()

    const mod = await import('../useWsEventHandler')
    const unsub = await mod.subscribeManagerEvents()
    expect(widgetMgr.on).toHaveBeenCalled()
    unsub()
    expect(widgetMgr.off).toHaveBeenCalled()
  })
})
