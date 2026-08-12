import { LogicalSize } from '@tauri-apps/api/dpi'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { primaryMonitor } from '@tauri-apps/api/window'

import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { EventEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { isDesktop, isMac, isWindows10 } from '@/utils/PlatformConstants'
import { invokeSilently, invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { clampSizeToMonitor, isCompatibilityMode, logger, MAC_TRAFFIC_LIGHTS_SPACING } from './windowHelpers'
import { createModalWindowFactory } from './windowModal'
import { createRtcWindowManager } from './windowRtc'

export const useWindow = () => {
  const globalStore = useGlobalStore()
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()
  /** 创建窗口；移动端或非 Tauri 环境返回 null */
  const createWebviewWindow = async (
    title: string,
    label: string,
    width: number,
    height: number,
    wantCloseWindow?: string,
    resizable = false,
    minW = 330,
    minH = 495,
    transparent?: boolean,
    visible = false,
    queryParams?: Record<string, string | number | boolean>
  ) => {
    // 移动端不支持窗口管理，直接返回空对象
    if (!isDesktop()) {
      return null
    }
    // 浏览器环境（非 Tauri）无法创建原生窗口，直接返回 null
    // 调用方应通过 router.push 跳转而非创建新窗口
    if (!hasTauriRuntime()) {
      logger.info(`非 Tauri 环境，跳过窗口创建: ${label}`)
      return null
    }
    const originalLabel = label
    const isMultiMsgWindow = originalLabel.includes(EventEnum.MULTI_MSG)

    const checkLabel = () => {
      /** 如果是打开独立窗口就截取label中的固定label名称 */
      if (label.includes(EventEnum.ALONE)) {
        return label.replace(/\d/g, '')
      } else {
        return label
      }
    }

    // 对于multiMsg类型的窗口，保留原始label用于窗口标识，但URL路由统一指向 /multiMsg
    label = isMultiMsgWindow ? originalLabel : checkLabel()

    // 构建URL，包含查询参数
    let url = isMultiMsgWindow ? `/${EventEnum.MULTI_MSG}` : `/${label.split('--')[0]}`

    if (queryParams && Object.keys(queryParams).length > 0) {
      const searchParams = new URLSearchParams()
      Object.entries(queryParams).forEach(([key, value]) => {
        searchParams.append(key, String(value))
      })
      url += `?${searchParams.toString()}`
    }

    const monitor = await primaryMonitor()
    const clampedSize = clampSizeToMonitor(width, height, monitor)
    const _clampedMinWidth = Math.min(minW, clampedSize.width)
    const _clampedMinHeight = Math.min(minH, clampedSize.height)

    // 原生窗口的 minWidth/minHeight 不应小于请求的 width/height；
    // 否则 Tauri 可能在窗口创建后立即将尺寸压缩到 min 值，导致实际渲染尺寸小于预期。
    const effectiveMinWidth = Math.max(minW, clampedSize.width)
    const effectiveMinHeight = Math.max(minH, clampedSize.height)

    const webview = new WebviewWindow(label, {
      title: title,
      url: url,
      fullscreen: false,
      resizable: resizable,
      center: true,
      width: clampedSize.width,
      height: clampedSize.height,
      minHeight: effectiveMinHeight,
      minWidth: effectiveMinWidth,
      skipTaskbar: false,
      decorations: !isCompatibilityMode.value,
      transparent: transparent || isCompatibilityMode.value,
      titleBarStyle: 'overlay', // mac覆盖标签栏
      hiddenTitle: true, // mac隐藏标题栏
      visible: visible,
      dragDropEnabled: true, // 启用文件拖放
      ...(isWindows10() ? { shadow: false } : {})
    })

    await webview.once('tauri://created', async () => {
      if (isMac()) {
        await invokeSilently('set_macos_traffic_lights_spacing', {
          windowLabel: label,
          spacing: MAC_TRAFFIC_LIGHTS_SPACING
        })
      }
      if (wantCloseWindow) {
        const win = await WebviewWindow.getByLabel(wantCloseWindow)
        win?.close()
      }
    })

    await webview.once('tauri://error', async () => {
      logger.info('窗口创建失败')
      // 使用错误处理检测窗口是否已存在（刷新时直接用 getByLabel 可能返回 null）
      await checkWinExist(label)
    })

    return webview
  }

  /**
   * 向指定标签的窗口发送载荷（payload），可用于窗口之间通信。
   *
   * @param windowLabel - 要发送载荷的窗口标签，通常是在创建窗口时指定的 label。
   * @param payload - 要发送的 JSON 数据对象，不限制字段内容。
   * @returns 返回一个 Promise，表示调用 Rust 后端命令的完成情况。
   */
  const sendWindowPayload = async (windowLabel: string, payload: Record<string, unknown>) => {
    // 移动端不支持窗口管理
    if (!isDesktop()) {
      return Promise.resolve()
    }
    logger.debug('新窗口的载荷:', payload)
    return invokeWithErrorHandler<void>('push_window_payload', {
      label: windowLabel,
      // 这个payload只要是json就能传，不限制字段
      payload
    })
  }

  /**
   * 获取指定窗口的当前载荷（payload），用于初始化窗口时获取传递的数据。
   *
   * @param windowLabel - 要获取载荷的窗口标签。
   * @returns 返回一个 Promise，解析后为泛型 T，表示窗口中保存的 payload 数据。
   */
  const getWindowPayload = async <T>(windowLabel: string, once: boolean = true) => {
    // 移动端不支持窗口管理
    if (!isDesktop()) {
      return Promise.resolve({} as T)
    }
    return await invokeWithErrorHandler<T>('get_window_payload', { label: windowLabel, once })
  }

  const createModalWindow = createModalWindowFactory({ sendWindowPayload, showFeedback })

  /**
   * 调整窗口大小
   * @param label 窗口名称
   * @param width 窗口宽度
   * @param height 窗口高度
   * */
  const resizeWindow = async (label: string, width: number, height: number) => {
    // 移动端不支持窗口管理
    if (!isDesktop()) {
      return Promise.resolve()
    }
    const webview = await WebviewWindow.getByLabel(label)
    const monitor = await primaryMonitor()
    const clampedSize = clampSizeToMonitor(width, height, monitor)
    // 创建一个新的尺寸对象
    const newSize = new LogicalSize(clampedSize.width, clampedSize.height)
    // 调用窗口的 setSize 方法进行尺寸调整
    await webview?.setSize(newSize).catch((error) => {
      logger.error('无法调整窗口大小:', error)
    })
  }

  /**
   * 检查窗口是否存在
   * @param L 窗口标签
   */
  const checkWinExist = async (L: string) => {
    // 移动端不支持窗口管理
    if (!isDesktop()) {
      return Promise.resolve()
    }
    const isExistsWinds = await WebviewWindow.getByLabel(L)
    if (isExistsWinds) {
      nextTick().then(async () => {
        // 如果窗口已存在，首先检查是否最小化了
        const minimized = await isExistsWinds.isMinimized()
        // 检查是否是隐藏
        const hidden = await isExistsWinds.isVisible()
        if (!hidden) {
          await isExistsWinds.show()
        }
        if (minimized) {
          // 如果已最小化，恢复窗口
          await isExistsWinds.unminimize()
        }
        // 如果窗口已存在，则给它焦点，使其在最前面显示
        await isExistsWinds.setFocus()
      })
    }
  }

  /**
   * 设置窗口是否可调整大小
   * @param label 窗口名称
   * @param resizable 是否可调整大小
   */
  const setResizable = async (label: string, resizable: boolean) => {
    // 移动端不支持窗口管理
    if (!isDesktop()) {
      return Promise.resolve()
    }
    const webview = await WebviewWindow.getByLabel(label)
    if (webview) {
      await webview.setResizable(resizable).catch((error) => {
        logger.error('设置窗口可调整大小失败:', error)
      })
    }
  }

  const { startRtcCall, createRtcCallWindow, ensureCaptureWindow, ensureCheckUpdateWindow, ensureNotifyWindow } =
    createRtcWindowManager({ globalStore, t, showFeedback, createWebviewWindow })

  return {
    createWebviewWindow,
    createModalWindow,
    resizeWindow,
    checkWinExist,
    setResizable,
    sendWindowPayload,
    getWindowPayload,
    startRtcCall,
    createRtcCallWindow,
    ensureCaptureWindow,
    ensureCheckUpdateWindow,
    ensureNotifyWindow
  }
}

export async function ensureCaptureWindow() {
  const { ensureCaptureWindow: _ensure } = useWindow()
  return _ensure()
}
