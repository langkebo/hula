import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { ensureCaptureWindow as ensureCaptureOverlayWindow } from '@/composables/common/useWindow'
import { createLogger } from '@/utils/Logger'
import { isMac } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'

const logger = createLogger('GlobalShortcut')

// 防抖状态管理
let togglePanelTimeout: ReturnType<typeof setTimeout> | null = null
let lastToggleTime = 0
const isMacPlatform = isMac()
let captureCloseHandlerBound = false

/**
 * 确保 capture 窗口存在。
 * 如果不存在则创建，如果存在则确保设置了关闭拦截。
 */
export const ensureCaptureWindow = async () => {
  const captureWindow = await ensureCaptureOverlayWindow()

  if (captureWindow) {
    if (!captureCloseHandlerBound) {
      // 设置关闭拦截 - 将关闭转为隐藏
      captureWindow.onCloseRequested(async (event) => {
        event.preventDefault()
        await captureWindow.hide()
        // 触发重置事件，让 Screenshot 组件重新初始化
        await captureWindow.emit('capture-reset', {})
      })
      captureCloseHandlerBound = true
    }

    // 初始状态为隐藏
    await captureWindow.hide()
  }

  return captureWindow
}

/**
 * 截图处理函数
 */
export const handleScreenshot = async (options: { concealHome: boolean }) => {
  try {
    const homeWindow = await WebviewWindow.getByLabel('home')
    if (!homeWindow) return

    const captureWindow = await ensureCaptureWindow()
    if (!captureWindow) return

    // 检查是否需要隐藏 home 窗口
    if (options.concealHome) {
      await homeWindow.hide()
      // 等待窗口隐藏完成
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // 设置窗口覆盖整个屏幕（包括菜单栏）
    const screenWidth = window.screen.width * window.devicePixelRatio
    const screenHeight = window.screen.height * window.devicePixelRatio

    // 依靠窗口级别设置来确保覆盖菜单栏
    await captureWindow.setSize(new LogicalSize(screenWidth, screenHeight))
    await captureWindow.setPosition(new LogicalPosition(0, 0))

    // 在 macOS 上设置窗口级别以覆盖菜单栏
    if (isMacPlatform) {
      await invokeSilently('set_window_level_above_menubar', { windowLabel: 'capture' })
    }

    await captureWindow.show()
    await captureWindow.setFocus()
    await captureWindow.emit('capture', true)

    logger.debug('截图窗口已启动')
  } catch (error) {
    logger.error('Failed to open screenshot window:', error)
  }
}

/**
 * 切换主面板显示状态
 * - 如果窗口已显示，则隐藏
 * - 如果窗口隐藏或最小化，则显示并聚焦
 */
export const handleOpenMainPanel = async () => {
  const currentTime = Date.now()

  // 防抖：如果距离上次操作少于 500ms，则忽略
  if (currentTime - lastToggleTime < 500) {
    return
  }

  // 清除之前的延时操作
  if (togglePanelTimeout) {
    clearTimeout(togglePanelTimeout)
    togglePanelTimeout = null
  }

  lastToggleTime = currentTime

  try {
    const homeWindow = await WebviewWindow.getByLabel('home')
    if (!homeWindow) {
      logger.warn('Home window not found')
      return
    }

    // 获取当前窗口状态
    const isVisible = await homeWindow.isVisible()
    const isMinimized = await homeWindow.isMinimized()

    logger.debug(`快捷键触发 - 窗口状态: 可见=${isVisible}, 最小化=${isMinimized}`)

    if (isVisible && !isMinimized) {
      // 窗口当前可见且未最小化，直接隐藏
      await homeWindow.hide()
    } else {
      // 处理最小化状态
      if (isMinimized) {
        await homeWindow.unminimize()
      }

      // 显示窗口
      await homeWindow.show()

      // 延迟设置焦点，确保窗口已完全显示
      togglePanelTimeout = setTimeout(async () => {
        await homeWindow.setFocus()
      }, 50)
    }
  } catch (error) {
    logger.error('Failed to toggle main panel:', error)
  }
}

/** 清理防抖定时器（清理快捷键时调用）。 */
export const resetPanelToggleState = () => {
  if (togglePanelTimeout) {
    clearTimeout(togglePanelTimeout)
    togglePanelTimeout = null
  }
}
