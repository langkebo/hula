import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { primaryMonitor, UserAttentionType } from '@tauri-apps/api/window'

import type { useActionFeedback } from '@/composables/common/useActionFeedback'
import { isDesktop, isMac, isWindows, isWindows10 } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import {
  attachMacModalOverlay,
  clampSizeToMonitor,
  detachMacModalOverlay,
  isCompatibilityMode,
  logger,
  MAC_TRAFFIC_LIGHTS_SPACING
} from './windowHelpers'

interface ModalWindowDeps {
  sendWindowPayload: (windowLabel: string, payload: Record<string, unknown>) => Promise<void>
  showFeedback: ReturnType<typeof useActionFeedback>['showFeedback']
}

export function createModalWindowFactory(deps: ModalWindowDeps) {
  const { sendWindowPayload, showFeedback } = deps

  /**
   * 创建模态子窗口
   * @param title 窗口标题
   * @param label 窗口标识
   * @param width 窗口宽度
   * @param height 窗口高度
   * @param parent 父窗口
   * @param payload 传递给子窗口的数据
   * @returns 创建的窗口实例或已存在的窗口实例
   */
  const createModalWindow = async (
    title: string,
    label: string,
    width: number,
    height: number,
    parent: string,
    payload?: Record<string, unknown>,
    options?: {
      minWidth?: number
      minHeight?: number
    }
  ) => {
    // 移动端不支持窗口管理
    if (!isDesktop()) {
      return null
    }
    // 检查窗口是否已存在
    const existingWindow = await WebviewWindow.getByLabel(label)
    const parentWindow = parent ? await WebviewWindow.getByLabel(parent) : null

    if (existingWindow) {
      if (isMac()) {
        attachMacModalOverlay(label)
      }
      // 如果窗口已存在，则聚焦到现有窗口并使其闪烁
      existingWindow.requestUserAttention(UserAttentionType.Critical)
      return existingWindow
    }

    // 创建新窗口
    const monitor = await primaryMonitor()
    const clampedSize = clampSizeToMonitor(width, height, monitor)
    const _clampedMinWidth = Math.min(options?.minWidth ?? 500, clampedSize.width)
    const _clampedMinHeight = Math.min(options?.minHeight ?? 500, clampedSize.height)

    const effectiveMinWidth = Math.max(options?.minWidth ?? 500, clampedSize.width)
    const effectiveMinHeight = Math.max(options?.minHeight ?? 500, clampedSize.height)

    const modalWindow = new WebviewWindow(label, {
      url: `/${label}`,
      title: title,
      width: clampedSize.width,
      height: clampedSize.height,
      resizable: false,
      center: true,
      minWidth: effectiveMinWidth,
      minHeight: effectiveMinHeight,
      focus: true,
      minimizable: false,
      parent: parentWindow ? parentWindow : parent,
      decorations: !isCompatibilityMode.value,
      transparent: isCompatibilityMode.value,
      titleBarStyle: 'overlay', // mac覆盖标签栏
      hiddenTitle: true, // mac隐藏标题栏
      visible: false,
      dragDropEnabled: true, // 启用文件拖放
      ...(isWindows10() ? { shadow: false } : {})
    })

    // 监听窗口创建完成事件
    modalWindow.once('tauri://created', async () => {
      if (isWindows()) {
        // 禁用父窗口，模拟模态窗口效果
        await parentWindow?.setEnabled(false)
      }

      // 如果有 payload，发送到子窗口
      if (payload) {
        await sendWindowPayload(label, payload)
      }

      // 设置窗口为焦点
      await modalWindow.setFocus()

      if (isMac()) {
        await invokeSilently('set_window_movable', {
          windowLabel: label,
          movable: false
        })
        await invokeSilently('set_macos_traffic_lights_spacing', {
          windowLabel: label,
          spacing: MAC_TRAFFIC_LIGHTS_SPACING
        })
        attachMacModalOverlay(label)
      }
    })

    // 监听错误事件
    modalWindow.once('tauri://error', async (e) => {
      logger.error(`${title}窗口创建失败:`, e)
      showFeedback(`创建${title}窗口失败`, 'error')
      await parentWindow?.setEnabled(true)
    })

    void modalWindow.once('tauri://destroyed', async () => {
      if (isMac()) {
        detachMacModalOverlay(label)
      }
      if (isWindows()) {
        try {
          await parentWindow?.setEnabled(true)
        } catch (error) {
          logger.error('重新启用父窗口失败:', error)
        }
      }
    })

    return modalWindow
  }

  return createModalWindow
}
