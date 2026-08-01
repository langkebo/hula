import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ExtensionEventBridge')

interface ManagerLike {
  on(event: string, handler: (...args: unknown[]) => void): void
  off(event: string, handler: (...args: unknown[]) => void): void
}

interface ClientLike {
  getFriendManager?(): ManagerLike
  getBurnAfterReadManager?(): ManagerLike
  getWidgetManager?(): ManagerLike
}

export function useExtensionEventBridge(client: ClientLike) {
  const unlisteners: Array<() => void> = []

  function bridge<M extends ManagerLike>(
    getManager: (() => M) | undefined,
    event: string,
    mittEvent: MittEnum,
    transform?: (...args: unknown[]) => unknown
  ) {
    if (!getManager) return
    let manager: M
    try {
      manager = getManager()
    } catch {
      return
    }
    const handler = transform
      ? (...args: unknown[]) => useMitt.emit(mittEvent, transform(...args))
      : (...args: unknown[]) => useMitt.emit(mittEvent, args[0])
    manager.on(event, handler)
    unlisteners.push(() => manager.off(event, handler))
  }

  // Friend events
  bridge(client.getFriendManager, 'RequestReceived', MittEnum.FRIEND_REQUEST_RECEIVED)
  bridge(client.getFriendManager, 'RequestAccepted', MittEnum.FRIEND_REQUEST_ACCEPTED)
  bridge(client.getFriendManager, 'FriendRemoved', MittEnum.FRIEND_REMOVED)

  // Burn after read events
  bridge(
    client.getBurnAfterReadManager,
    'MessageRead',
    MittEnum.BURN_MESSAGE_READ,
    (eventId: unknown, readAt: unknown) => ({ eventId, readAt })
  )
  bridge(
    client.getBurnAfterReadManager,
    'MessageBurned',
    MittEnum.BURN_MESSAGE_BURNED,
    (eventId: unknown, burnedAt: unknown) => ({ eventId, burnedAt })
  )
  bridge(
    client.getBurnAfterReadManager,
    'SettingsChanged',
    MittEnum.BURN_SETTINGS_CHANGED,
    (roomId: unknown, settings: unknown) => ({ roomId, settings })
  )

  // Widget events
  bridge(client.getWidgetManager, 'WidgetCreated', MittEnum.WIDGET_CREATED)
  bridge(client.getWidgetManager, 'WidgetUpdated', MittEnum.WIDGET_UPDATED)
  bridge(client.getWidgetManager, 'WidgetDeleted', MittEnum.WIDGET_DELETED)

  logger.info('扩展 Manager 事件桥接已注册')

  const cleanup = () => {
    unlisteners.forEach((fn) => {
      try {
        fn()
      } catch (err) {
        logger.error('取消事件订阅失败:', err)
      }
    })
    unlisteners.length = 0
  }

  return { cleanup }
}
