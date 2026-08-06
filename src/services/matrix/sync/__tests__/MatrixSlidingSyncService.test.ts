import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SlidingSync } from '@/types/matrix-js-sdk'
import { SlidingSyncEvent } from '@/types/matrix-js-sdk'
import matrixClientService from '../../MatrixClientService'
import matrixSlidingSyncService from '../MatrixSlidingSyncService'

const { loggerSpy } = vi.hoisted(() => ({
  loggerSpy: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => loggerSpy
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../../MatrixClientService', () => {
  const mockService = {
    getSlidingSync: vi.fn(() => null as SlidingSync | null),
    getClient: vi.fn(() => null as MatrixClient | null),
    updateConnectionState: vi.fn()
  }
  return {
    default: mockService,
    matrixClientService: mockService
  }
})

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

    vi.mocked(matrixClientService.getSlidingSync).mockReturnValue(oldSync as unknown as SlidingSync)
    await matrixSlidingSyncService.initialize()

    vi.mocked(matrixClientService.getSlidingSync).mockReturnValue(newSync as unknown as SlidingSync)
    await matrixSlidingSyncService.initialize()

    expect(oldSync.on).toHaveBeenCalledTimes(2)
    expect(oldSync.off).toHaveBeenCalledTimes(2)
    expect(newSync.on).toHaveBeenCalledTimes(2)
  })

  it('invokes onUnreadCountsUpdate callback on sync complete', async () => {
    const onUnreadCountsUpdate = vi.fn()
    matrixSlidingSyncService.registerCallbacks({ onUnreadCountsUpdate })

    const syncInstance = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (event === SlidingSyncEvent.Lifecycle) {
          setTimeout(() => cb('COMPLETE', { rooms: { '!room:1': { notification_count: 5, highlight_count: 2 } } }), 0)
        }
      }),
      off: vi.fn()
    }

    vi.mocked(matrixClientService.getSlidingSync).mockReturnValue(syncInstance as unknown as SlidingSync)
    await matrixSlidingSyncService.initialize()

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(onUnreadCountsUpdate).toHaveBeenCalledWith([
      { roomId: '!room:1', unreadCount: 5, highlightCount: 2, notificationCount: 5 }
    ])
  })

  it('invokes onRoomListRefresh callback on list update', async () => {
    const onRoomListRefresh = vi.fn()
    matrixSlidingSyncService.registerCallbacks({ onRoomListRefresh })

    let lifecycleCallback: (...args: unknown[]) => void = () => {}
    const syncInstance = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (event === SlidingSyncEvent.Lifecycle) {
          lifecycleCallback = cb
        }
      }),
      off: vi.fn()
    }

    vi.mocked(matrixClientService.getSlidingSync).mockReturnValue(syncInstance as unknown as SlidingSync)
    await matrixSlidingSyncService.initialize()

    lifecycleCallback('COMPLETE', { rooms: { '!room:1': { timeline: [{}] } } })
    lifecycleCallback('COMPLETE', { rooms: { '!room:1': { timeline: [{}] } } })

    expect(onRoomListRefresh).toHaveBeenCalled()
  })

  it('does not invoke onRoomListRefresh on initial list update', async () => {
    const onRoomListRefresh = vi.fn()
    matrixSlidingSyncService.registerCallbacks({ onRoomListRefresh })

    let lifecycleCallback: (...args: unknown[]) => void = () => {}
    const syncInstance = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (event === SlidingSyncEvent.Lifecycle) {
          lifecycleCallback = cb
        }
      }),
      off: vi.fn()
    }

    vi.mocked(matrixClientService.getSlidingSync).mockReturnValue(syncInstance as unknown as SlidingSync)
    await matrixSlidingSyncService.initialize()

    lifecycleCallback('COMPLETE', { rooms: { '!room:1': { timeline: [{}] } } })

    expect(onRoomListRefresh).not.toHaveBeenCalled()
  })
})

describe('R-13: error logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matrixSlidingSyncService.destroy()
  })

  it('logs a warning when getListRoomCount throws and returns 0', async () => {
    const syncInstance = {
      on: vi.fn(),
      off: vi.fn(),
      getList: vi.fn(() => {
        throw new Error('list access failed')
      })
    }

    vi.mocked(matrixClientService.getSlidingSync).mockReturnValue(syncInstance as unknown as SlidingSync)
    await matrixSlidingSyncService.initialize()

    const result = matrixSlidingSyncService.getListRoomCount()

    expect(result).toBe(0)
    expect(loggerSpy.warn).toHaveBeenCalledTimes(1)
    expect(loggerSpy.warn).toHaveBeenCalledWith('getListRoomCount failed:', expect.any(Error))
  })
})
