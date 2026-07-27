import { describe, expect, it, vi } from 'vitest'

// Mock mitt bus to capture emitted events
const { emitMock, onMock, offMock } = vi.hoisted(() => ({
  emitMock: vi.fn(),
  onMock: vi.fn(),
  offMock: vi.fn()
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    emit: emitMock,
    on: onMock,
    off: offMock
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

import { useExtensionEventBridge } from '@/composables/app/useExtensionEventBridge'
import { MittEnum } from '@/enums'

// Helper: create a mock manager with on/off methods that record handlers
function createMockManager() {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>()
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers.has(event)) handlers.set(event, [])
      handlers.get(event)!.push(handler)
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const arr = handlers.get(event)
      if (arr) {
        const idx = arr.indexOf(handler)
        if (idx >= 0) arr.splice(idx, 1)
      }
    }),
    // Test helper: simulate emitting an event
    _emit(event: string, ...args: unknown[]) {
      const arr = handlers.get(event)
      if (arr) arr.forEach((h) => h(...args))
    },
    _hasListeners(event: string): boolean {
      return (handlers.get(event)?.length ?? 0) > 0
    }
  }
}

describe('useExtensionEventBridge', () => {
  it('订阅好友请求收到事件并转发到 mitt', () => {
    const friendManager = createMockManager()
    const client = {
      getFriendManager: () => friendManager,
      getBurnAfterReadManager: () => createMockManager(),
      getWidgetManager: () => createMockManager()
    }

    const { cleanup } = useExtensionEventBridge(client)
    expect(friendManager.on).toHaveBeenCalledWith('RequestReceived', expect.any(Function))

    // Simulate friend request received
    const request = { userId: '@alice:server', reason: 'hi' }
    friendManager._emit('RequestReceived', request)

    expect(emitMock).toHaveBeenCalledWith(MittEnum.FRIEND_REQUEST_RECEIVED, request)
    cleanup()
  })

  it('订阅好友被移除事件并转发到 mitt', () => {
    const friendManager = createMockManager()
    const client = {
      getFriendManager: () => friendManager,
      getBurnAfterReadManager: () => createMockManager(),
      getWidgetManager: () => createMockManager()
    }

    const { cleanup } = useExtensionEventBridge(client)
    friendManager._emit('FriendRemoved', '@bob:server')

    expect(emitMock).toHaveBeenCalledWith(MittEnum.FRIEND_REMOVED, '@bob:server')
    cleanup()
  })

  it('订阅阅后即焚消息已读事件并转发到 mitt', () => {
    const burnManager = createMockManager()
    const client = {
      getFriendManager: () => createMockManager(),
      getBurnAfterReadManager: () => burnManager,
      getWidgetManager: () => createMockManager()
    }

    const { cleanup } = useExtensionEventBridge(client)
    burnManager._emit('MessageRead', '$event123', 1700000000000)

    expect(emitMock).toHaveBeenCalledWith(MittEnum.BURN_MESSAGE_READ, {
      eventId: '$event123',
      readAt: 1700000000000
    })
    cleanup()
  })

  it('订阅阅后即焚消息已焚毁事件并转发到 mitt', () => {
    const burnManager = createMockManager()
    const client = {
      getFriendManager: () => createMockManager(),
      getBurnAfterReadManager: () => burnManager,
      getWidgetManager: () => createMockManager()
    }

    const { cleanup } = useExtensionEventBridge(client)
    burnManager._emit('MessageBurned', '$event456', 1700000001000)

    expect(emitMock).toHaveBeenCalledWith(MittEnum.BURN_MESSAGE_BURNED, {
      eventId: '$event456',
      burnedAt: 1700000001000
    })
    cleanup()
  })

  it('订阅 Widget 创建事件并转发到 mitt', () => {
    const widgetManager = createMockManager()
    const client = {
      getFriendManager: () => createMockManager(),
      getBurnAfterReadManager: () => createMockManager(),
      getWidgetManager: () => widgetManager
    }

    const { cleanup } = useExtensionEventBridge(client)
    const widget = { widgetId: 'w1', type: 'm.custom', name: 'Test Widget' }
    widgetManager._emit('WidgetCreated', widget)

    expect(emitMock).toHaveBeenCalledWith(MittEnum.WIDGET_CREATED, widget)
    cleanup()
  })

  it('订阅 Widget 删除事件并转发到 mitt', () => {
    const widgetManager = createMockManager()
    const client = {
      getFriendManager: () => createMockManager(),
      getBurnAfterReadManager: () => createMockManager(),
      getWidgetManager: () => widgetManager
    }

    const { cleanup } = useExtensionEventBridge(client)
    widgetManager._emit('WidgetDeleted', 'w1')

    expect(emitMock).toHaveBeenCalledWith(MittEnum.WIDGET_DELETED, 'w1')
    cleanup()
  })

  it('cleanup 取消所有事件订阅', () => {
    const friendManager = createMockManager()
    const burnManager = createMockManager()
    const widgetManager = createMockManager()
    const client = {
      getFriendManager: () => friendManager,
      getBurnAfterReadManager: () => burnManager,
      getWidgetManager: () => widgetManager
    }

    const { cleanup } = useExtensionEventBridge(client)
    // Each manager should have listeners registered
    expect(friendManager.on).toHaveBeenCalled()
    expect(burnManager.on).toHaveBeenCalled()
    expect(widgetManager.on).toHaveBeenCalled()

    cleanup()

    // After cleanup, off should be called for each registered handler
    expect(friendManager.off).toHaveBeenCalled()
    expect(burnManager.off).toHaveBeenCalled()
    expect(widgetManager.off).toHaveBeenCalled()
  })

  it('当 client 没有 getFriendManager 时不崩溃', () => {
    const client = {
      getBurnAfterReadManager: () => createMockManager(),
      getWidgetManager: () => createMockManager()
    }

    expect(() => useExtensionEventBridge(client)).not.toThrow()
  })
})
