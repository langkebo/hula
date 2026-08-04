import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { getCurrentWindow } from '@tauri-apps/api/window'

/**
 * 统一窗口关闭逻辑
 * 封装 Tauri 窗口关闭 API，避免混用 appWindow.close() 和 window.close()
 */
export function usePlatformClose() {
  /**
   * 关闭当前窗口
   * 统一使用 Tauri 的 getCurrentWindow().close()
   */
  const closeCurrentWindow = async (): Promise<void> => {
    await getCurrentWindow().close()
  }

  /**
   * 按 label 关闭指定窗口
   * 用于跨窗口关闭场景（如 CheckUpdate 关闭 login 窗口）
   */
  const closeWindowByLabel = async (label: string): Promise<void> => {
    const win = await WebviewWindow.getByLabel(label)
    if (win) {
      await win.close()
    }
  }

  return { closeCurrentWindow, closeWindowByLabel }
}
