import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  default: {
    getSlidingSync: vi.fn(() => null)
  }
}))

const { default: matrixClientService } = await import('../../MatrixClientService')
const { default: matrixSlidingSyncService } = await import('../MatrixSlidingSyncService')

describe('MatrixSlidingSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matrixSlidingSyncService.destroy()
  })

  it('rebinds listeners when sliding sync instance changes', async () => {
    const oldSync = {
      on: vi.fn(),
      off: vi.fn()
    }
    const newSync = {
      on: vi.fn(),
      off: vi.fn()
    }

    vi.mocked(matrixClientService.getSlidingSync).mockReturnValue(oldSync as any)
    await matrixSlidingSyncService.initialize()

    vi.mocked(matrixClientService.getSlidingSync).mockReturnValue(newSync as any)
    await matrixSlidingSyncService.initialize()

    expect(oldSync.on).toHaveBeenCalledTimes(3)
    expect(oldSync.off).toHaveBeenCalledTimes(3)
    expect(newSync.on).toHaveBeenCalledTimes(3)
  })

  it('invokes onUnreadCountsUpdate callback on sync complete', async () => {
    const onUnreadCountsUpdate = vi.fn()
    matrixSlidingSyncService.registerCallbacks({ onUnreadCountsUpdate })

    const syncInstance = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (event === 'sync') {
          setTimeout(() => cb('COMPLETE', { rooms: { '!room:1': { notification_count: 5, highlight_count: 2 } } }), 0)
        }
      }),
      off: vi.fn()
    }

    vi.mocked(matrixClientService.getSlidingSync).mockReturnValue(syncInstance as any)
    await matrixSlidingSyncService.initialize()

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(onUnreadCountsUpdate).toHaveBeenCalledWith([
      { roomId: '!room:1', unreadCount: 5, highlightCount: 2, notificationCount: 5 }
    ])
  })

  it('invokes onRoomListRefresh callback on list update', async () => {
    const onRoomListRefresh = vi.fn()
    matrixSlidingSyncService.registerCallbacks({ onRoomListRefresh })

    let listCallback: (...args: unknown[]) => void = () => {}
    const syncInstance = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (event === 'Lists.default') {
          listCallback = cb
        }
      }),
      off: vi.fn()
    }

    vi.mocked(matrixClientService.getSlidingSync).mockReturnValue(syncInstance as any)
    await matrixSlidingSyncService.initialize()

    listCallback(['!room:1'], { initial: false })

    expect(onRoomListRefresh).toHaveBeenCalled()
  })

  it('does not invoke onRoomListRefresh on initial list update', async () => {
    const onRoomListRefresh = vi.fn()
    matrixSlidingSyncService.registerCallbacks({ onRoomListRefresh })

    let listCallback2: (...args: unknown[]) => void = () => {}
    const syncInstance = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (event === 'Lists.default') {
          listCallback2 = cb
        }
      }),
      off: vi.fn()
    }

    vi.mocked(matrixClientService.getSlidingSync).mockReturnValue(syncInstance as any)
    await matrixSlidingSyncService.initialize()

    listCallback2(['!room:1'], { initial: true })

    expect(onRoomListRefresh).not.toHaveBeenCalled()
  })
})
