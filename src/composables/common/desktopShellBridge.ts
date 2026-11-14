import type { UnlistenFn } from '@tauri-apps/api/event'
import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import { openMsgSessionByRoomId } from '@/composables/chat/openMsgSession'
import { INDEPENDENT_CHAT_EVENTS } from '@/composables/chat/useIndependentChatWindow'
import { useSessionStore } from '@/stores/domains/chat/chat/session'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'
import { isDesktop, isMac } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { useWindow } from './useWindow'

const logger = createLogger('DesktopShellBridge')

/** 未登录时收到的深链暂存键：login 窗口落盘，home 首启后消费（C-13）。 */
const PENDING_DEEP_LINK_ROOM_KEY = 'tjg:pending-deep-link-room'

interface ShellBridgeOptions {
  /** 当前窗口，用于按 label 分流 home / login 行为 */
  window: WebviewWindow
  /** App 侧的统一监听注册器，负责去重与卸载 */
  addListener: (listener: Promise<UnlistenFn>, key: string) => void
  /** i18n 翻译函数 */
  translate: (key: string) => string
}

/**
 * 桌面端默认快捷键拦截（C-11）：macOS 用 Cmd，Windows/Linux 用 Ctrl；
 * 带 Alt 的组合交给输入法或系统处理。
 */
function preventDesktopDefaultShortcuts(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return

  const key = event.key.toLowerCase()
  // macOS 额外拦截 Cmd+P（打印），Windows/Linux 的 Ctrl+P 保留给输入区
  const blockedKeys = isMac() ? ['f', 'r', 'g', 'j', 'p'] : ['f', 'r', 'g', 'j']
  if (blockedKeys.includes(key)) {
    event.preventDefault()
  }
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  if (!el?.tagName) return false
  return (
    el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea' || el.isContentEditable === true
  )
}

const preventImageInputDrag = (event: MouseEvent) => {
  const el = event.target as HTMLElement
  if (el.nodeName.toLowerCase() === 'img' || el.nodeName.toLowerCase() === 'input') {
    event.preventDefault()
  }
}

const preventGlobalContextMenu = (event: MouseEvent) => {
  // 生产环境仍屏蔽默认右键菜单，但输入类元素必须放行：复制/粘贴/拼写检查依赖原生菜单，
  // 全局屏蔽会导致设置项、搜索框等无法粘贴。消息输入区的自定义菜单由 ContextMenu 自身拦截。
  if (isEditableTarget(event.target)) return
  event.preventDefault()
}

/** 安装桌面端安全守卫：禁止拖拽图片、屏蔽默认右键菜单与快捷键（仅生产环境）。 */
export function installSecurityGuards(): void {
  window.addEventListener('dragstart', preventImageInputDrag)
  if (!import.meta.env.PROD) return
  window.addEventListener('keydown', preventDesktopDefaultShortcuts)
  window.addEventListener('contextmenu', preventGlobalContextMenu, false)
}

/** 卸载桌面端安全守卫，避免热更新或重复挂载时监听叠加。 */
export function uninstallSecurityGuards(): void {
  window.removeEventListener('dragstart', preventImageInputDrag)
  if (!import.meta.env.PROD) return
  window.removeEventListener('keydown', preventDesktopDefaultShortcuts)
  window.removeEventListener('contextmenu', preventGlobalContextMenu, false)
}

/**
 * macOS 托盘的文案由前端 i18n 下发，Rust 侧只保留英文默认值（C-08）。
 * 仅需首屏窗口各推一次，托盘菜单即可与界面语言一致。
 */
export function syncMacTrayMenuLabels(translate: (key: string) => string): void {
  if (!isDesktop() || !isMac()) return
  void invokeSilently('update_tray_menu_labels', {
    labels: {
      status: translate('message.tray.online_status_window_title'),
      open: translate('message.tray.open_main_panel'),
      mute: translate('message.tray.toggle_mute'),
      exit: translate('message.tray.exit')
    }
  })
}

/** home 窗口首启后消费 login 期间暂存的深链房间（C-13）。 */
export function consumePendingDeepLinkRoom(windowLabel: string): void {
  if (!isDesktop() || windowLabel !== 'home') return

  const pendingRoomId = localStorage.getItem(PENDING_DEEP_LINK_ROOM_KEY)
  if (!pendingRoomId) return

  localStorage.removeItem(PENDING_DEEP_LINK_ROOM_KEY)
  void openMsgSessionByRoomId(pendingRoomId).catch((error) => {
    logger.warn('consume pending deep link room failed:', error)
  })
}

/**
 * 注册深链与托盘菜单动作监听（C-08 / C-13）。
 * 深链在 login 落盘、在 home 直接定位会话；托盘动作只在 home 窗口执行。
 */
export function registerShellBridgeListeners(options: ShellBridgeOptions): void {
  const { window, addListener, translate } = options

  addListener(
    window.listen<string>('deep-link-open-room', async (event) => {
      const roomId = event.payload
      if (!roomId) return
      if (window.label === 'home') {
        await openMsgSessionByRoomId(roomId)
      } else {
        localStorage.setItem(PENDING_DEEP_LINK_ROOM_KEY, roomId)
      }
    }),
    'deep-link-open-room'
  )

  if (window.label !== 'home') return

  const { createWebviewWindow } = useWindow()
  const settingStore = useSettingStore()
  const sessionStore = useSessionStore()
  addListener(
    window.listen<string>('tray_menu_action', async (event) => {
      if (event.payload === 'open-status-window') {
        await createWebviewWindow(translate('message.tray.online_status_window_title'), 'onlineStatus', 320, 480)
      } else if (event.payload === 'toggle-mute') {
        settingStore.setMessageSoundEnabled(!settingStore.messageSoundEnabled)
      }
    }),
    'tray-menu-action'
  )

  // 独立聊天窗口关闭时会把该房间未读归零并广播，主窗口此前无人订阅，
  // 导致会话列表角标一直停在旧值；这里回写会话与本地未读账本。
  addListener(
    window.listen<{ roomId: string; unreadCount: number }>(INDEPENDENT_CHAT_EVENTS.UNREAD_UPDATED, (event) => {
      const { roomId, unreadCount } = event.payload ?? {}
      if (!roomId || typeof unreadCount !== 'number') return
      sessionStore.setUnreadCount(roomId, Math.max(0, Math.floor(unreadCount)))
    }),
    'chat-unread-updated'
  )
}
