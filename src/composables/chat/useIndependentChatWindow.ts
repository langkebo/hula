import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onUnmounted } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import router from '@/router'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { isDesktop } from '@/utils/PlatformConstants'

const logger = createLogger('useIndependentChatWindow')

/**
 * 独立聊天窗口事件（附录 C.3 窗口间通信）
 */
export const INDEPENDENT_CHAT_EVENTS = {
  OPENED: 'chat:opened-independently',
  UNREAD_UPDATED: 'chat:unread-updated',
  CLOSED: 'chat:closed'
} as const

/** 独立聊天窗口默认尺寸 */
const DEFAULT_WIDTH = 720
const DEFAULT_HEIGHT = 560
const DEFAULT_MIN_WIDTH = 480
const DEFAULT_MIN_HEIGHT = 400

/** 独立窗口 label 前缀（label 必须唯一，用 roomId 区分） */
const WINDOW_LABEL_PREFIX = 'windowChat--'

/**
 * 构造独立聊天窗口的 label
 * @param roomId 房间 ID
 */
export const buildWindowChatLabel = (roomId: string): string => `${WINDOW_LABEL_PREFIX}${roomId}`

/**
 * 从 label 中解析 roomId（仅用于日志/调试）
 */
export const parseRoomIdFromLabel = (label: string): string | null => {
  if (!label.startsWith(WINDOW_LABEL_PREFIX)) return null
  return label.slice(WINDOW_LABEL_PREFIX.length)
}

/**
 * 独立聊天窗口管理（需求文档附录 C）
 *
 * 核心策略：
 * - 主窗口退让：创建独立窗口后，主窗口 router.back()
 * - 独立窗口自治：独立路由 /window/chat/:roomId，与主窗口隔离
 * - 窗口间通信：通过 Tauri emit/listen 同步未读数
 * - 重复打开：焦点切换到已存在的窗口，不重复创建
 *
 * 非桌面端 / 非 Tauri 环境降级为 router.push('/message/:roomId')
 */
export const useIndependentChatWindow = () => {
  const { showFeedback } = useActionFeedback()
  const globalStore = useGlobalStore()

  /** 已注册的监听器卸载函数集合（onUnmounted 时统一清理） */
  const unlistenFns: UnlistenFn[] = []

  /**
   * 在新窗口打开聊天
   *
   * @param roomId 房间 ID
   * @returns 创建的窗口实例；已存在时聚焦原窗口；非桌面端返回 null
   */
  const openInNewWindow = async (roomId: string): Promise<WebviewWindow | null> => {
    if (!roomId) {
      showFeedback('roomId is required', 'error')
      return null
    }

    // 非桌面端 / 非 Tauri 环境降级为路由跳转
    if (!isDesktop() || !hasTauriRuntime()) {
      logger.info(`非 Tauri 环境，降级为路由跳转: /message/${roomId}`)
      await router.push(`/message/${roomId}`)
      return null
    }

    const label = buildWindowChatLabel(roomId)

    try {
      // C.4 重复打开：焦点切换到已存在的窗口
      const existing = await WebviewWindow.getByLabel(label)
      if (existing) {
        logger.info(`独立窗口已存在，聚焦: ${label}`)
        const minimized = await existing.isMinimized().catch(() => false)
        if (minimized) {
          await existing.unminimize()
        }
        await existing.show()
        await existing.setFocus()
        // 主窗口退让
        router.back()
        return existing
      }

      // 创建独立窗口，使用专用路由 /window/chat/:roomId
      const webview = new WebviewWindow(label, {
        title: 'Tjg Chat',
        url: `/window/chat/${encodeURIComponent(roomId)}`,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        minWidth: DEFAULT_MIN_WIDTH,
        minHeight: DEFAULT_MIN_HEIGHT,
        resizable: true,
        center: true,
        decorations: true,
        transparent: false,
        titleBarStyle: 'overlay',
        hiddenTitle: true,
        visible: true,
        skipTaskbar: false
      })

      await webview.once('tauri://created', async () => {
        logger.info(`独立聊天窗口创建成功: ${label}`)
        // C.3 通知主窗口（其他潜在监听者）已独立打开
        await emit(INDEPENDENT_CHAT_EVENTS.OPENED, { roomId, windowId: label }).catch((err) => {
          logger.warn('emit chat:opened-independently failed', err)
        })
      })

      await webview.once('tauri://error', async (e) => {
        logger.error('独立聊天窗口创建失败:', e)
        showFeedback('打开独立窗口失败', 'error')
      })

      // 监听窗口关闭事件，通知主窗口
      webview.once('tauri://destroyed', async () => {
        logger.info(`独立聊天窗口关闭: ${label}`)
        await emit(INDEPENDENT_CHAT_EVENTS.CLOSED, { roomId }).catch((err) => {
          logger.warn('emit chat:closed failed', err)
        })
      })

      // C.1 主窗口退让：独立窗口创建后，主窗口返回上一个视图
      // 注意：在 created 事件后再 back，确保窗口创建成功
      // 如果是当前会话被独立出去，清空当前会话状态
      if (globalStore.currentSessionRoomId === roomId) {
        globalStore.updateCurrentSessionRoomId('')
      }
      router.back()

      return webview
    } catch (error) {
      logger.error('openInNewWindow 异常:', error)
      showFeedback('打开独立窗口失败', 'error')
      return null
    }
  }

  /**
   * 通知主窗口未读数更新（独立窗口内调用）
   *
   * @param roomId 房间 ID
   * @param unreadCount 未读数
   */
  const notifyUnreadUpdate = async (roomId: string, unreadCount: number): Promise<void> => {
    if (!hasTauriRuntime()) return
    await emit(INDEPENDENT_CHAT_EVENTS.UNREAD_UPDATED, { roomId, unreadCount }).catch((err) => {
      logger.warn('emit chat:unread-updated failed', err)
    })
  }

  /**
   * 主窗口监听独立窗口的未读数更新
   *
   * @param onUpdate 收到更新时的回调
   * @returns 卸载函数（取消监听）
   */
  const listenUnreadUpdates = async (
    onUpdate: (payload: { roomId: string; unreadCount: number }) => void
  ): Promise<UnlistenFn | null> => {
    if (!hasTauriRuntime()) return null
    const unlisten = await listen<{ roomId: string; unreadCount: number }>(
      INDEPENDENT_CHAT_EVENTS.UNREAD_UPDATED,
      (event) => {
        onUpdate(event.payload)
      }
    ).catch((err) => {
      logger.warn('listen chat:unread-updated failed', err)
      return null
    })
    if (unlisten) {
      unlistenFns.push(unlisten)
    }
    return unlisten
  }

  /**
   * 主窗口监听独立窗口关闭事件
   *
   * @param onClose 收到关闭事件时的回调
   * @returns 卸载函数（取消监听）
   */
  const listenChatClosed = async (onClose: (payload: { roomId: string }) => void): Promise<UnlistenFn | null> => {
    if (!hasTauriRuntime()) return null
    const unlisten = await listen<{ roomId: string }>(INDEPENDENT_CHAT_EVENTS.CLOSED, (event) => {
      onClose(event.payload)
    }).catch((err) => {
      logger.warn('listen chat:closed failed', err)
      return null
    })
    if (unlisten) {
      unlistenFns.push(unlisten)
    }
    return unlisten
  }

  /**
   * 主窗口监听独立窗口打开事件
   *
   * @param onOpen 收到打开事件时的回调
   * @returns 卸载函数（取消监听）
   */
  const listenChatOpened = async (
    onOpen: (payload: { roomId: string; windowId: string }) => void
  ): Promise<UnlistenFn | null> => {
    if (!hasTauriRuntime()) return null
    const unlisten = await listen<{ roomId: string; windowId: string }>(INDEPENDENT_CHAT_EVENTS.OPENED, (event) => {
      onOpen(event.payload)
    }).catch((err) => {
      logger.warn('listen chat:opened-independently failed', err)
      return null
    })
    if (unlisten) {
      unlistenFns.push(unlisten)
    }
    return unlisten
  }

  // 组件卸载时清理所有监听器
  onUnmounted(() => {
    unlistenFns.forEach((unlisten) => {
      try {
        unlisten()
      } catch (err) {
        logger.warn('unlisten failed', err)
      }
    })
    unlistenFns.length = 0
  })

  return {
    openInNewWindow,
    notifyUnreadUpdate,
    listenUnreadUpdates,
    listenChatClosed,
    listenChatOpened
  }
}
