import type { WebviewOptions } from '@tauri-apps/api/webview'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import type { Monitor, WindowOptions } from '@tauri-apps/api/window'

import { assign } from 'es-toolkit/compat'
import { useI18nGlobal } from '@/services/i18n'
import { createLogger } from '@/utils/Logger'
import { isCompatibility, isDesktop, isMac } from '@/utils/PlatformConstants'

export const logger = createLogger('useWindow')

/** 判断是兼容的系统 */
export const isCompatibilityMode = computed(() => isCompatibility())

export const WINDOW_SAFE_PADDING = 32
export const MIN_LOGICAL_WIDTH = 320
export const MIN_LOGICAL_HEIGHT = 200
export const MAC_TRAFFIC_LIGHTS_SPACING = 6

export type DesktopWindowOptions = Omit<WebviewOptions, 'x' | 'y' | 'width' | 'height'> & WindowOptions

export const clampSizeToMonitor = (width: number, height: number, monitor?: Monitor | null) => {
  if (!monitor) {
    return { width, height }
  }

  const scaleFactor = monitor.scaleFactor ?? 1
  const maxLogicalWidth = Math.max(MIN_LOGICAL_WIDTH, monitor.size.width / scaleFactor - WINDOW_SAFE_PADDING)
  const maxLogicalHeight = Math.max(MIN_LOGICAL_HEIGHT, monitor.size.height / scaleFactor - WINDOW_SAFE_PADDING)

  return {
    width: Math.min(width, Math.floor(maxLogicalWidth)),
    height: Math.min(height, Math.floor(maxLogicalHeight))
  }
}

// Mac 端用于模拟父窗口禁用态的透明蒙层
export const MAC_MODAL_OVERLAY_ID = 'mac-modal-overlay'
// 记录当前已经打开模态窗口的 label，方便在最后一个关闭时移除蒙层
export const activeMacModalLabels = new Set<string>()

// 创建或复用蒙层 DOM
export const ensureMacOverlayElement = () => {
  if (typeof document === 'undefined') return
  if (document.getElementById(MAC_MODAL_OVERLAY_ID)) return
  const overlay = document.createElement('div')
  overlay.id = MAC_MODAL_OVERLAY_ID
  assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '9999',
    backgroundColor: 'transparent',
    pointerEvents: 'auto',
    width: '100vw',
    height: '100vh',
    userSelect: 'none',
    cursor: 'not-allowed'
  })
  const mountPoint = document.body ?? document.documentElement
  mountPoint?.appendChild(overlay)
}

// 移除蒙层
export const removeMacOverlayElement = () => {
  if (typeof document === 'undefined') return
  document.getElementById(MAC_MODAL_OVERLAY_ID)?.remove()
}

// 记录当前窗口并展示蒙层
export const attachMacModalOverlay = (label: string) => {
  if (!isMac()) return
  activeMacModalLabels.add(label)
  ensureMacOverlayElement()
}

// 解除当前窗口的蒙层记录，如果没有其他窗口则移除蒙层
export const detachMacModalOverlay = (label: string) => {
  if (!isMac()) return
  activeMacModalLabels.delete(label)
  if (activeMacModalLabels.size === 0) {
    removeMacOverlayElement()
  }
}

export const awaitWindowCreation = async (label: string, webview: WebviewWindow): Promise<WebviewWindow> => {
  return new Promise((resolve, reject) => {
    let settled = false

    const resolveWindow = (window: WebviewWindow) => {
      if (settled) return
      settled = true
      resolve(window)
    }

    const rejectWindow = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }

    void webview.once('tauri://created', () => {
      resolveWindow(webview)
    })

    void webview.once('tauri://error', async () => {
      const existingWindow = await WebviewWindow.getByLabel(label)
      if (existingWindow) {
        resolveWindow(existingWindow)
        return
      }

      rejectWindow(new Error(useI18nGlobal().t('hooks.window.create_failed', { label })))
    })
  })
}

export const ensureDesktopWindowInstance = async (
  label: string,
  options: DesktopWindowOptions,
  onCreated?: (window: WebviewWindow) => Promise<void> | void
) => {
  if (!isDesktop()) {
    return null
  }

  const existingWindow = await WebviewWindow.getByLabel(label)
  if (existingWindow) {
    return existingWindow
  }

  const webview = new WebviewWindow(label, options)
  const createdWindow = await awaitWindowCreation(label, webview)
  await onCreated?.(createdWindow)
  return createdWindow
}
