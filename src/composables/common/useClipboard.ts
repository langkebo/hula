import { writeText as tauriWriteText } from '@tauri-apps/plugin-clipboard-manager'
import { hasTauriRuntime } from '@/utils/AppHarness'

/**
 * 统一剪贴板写入封装。
 *
 * 在 Tauri 运行时优先调用原生 `plugin-clipboard-manager`，避免 WebView 中
 * `navigator.clipboard` 受权限/聚焦限制导致写入失败；非 Tauri 环境（浏览器、
 * 单测）回退到 `navigator.clipboard`。两者皆不可用时抛出，交由调用方兜底。
 */
export const useClipboard = () => {
  const write = async (text: string): Promise<void> => {
    if (hasTauriRuntime()) {
      try {
        await tauriWriteText(text)
        return
      } catch {
        // 原生写入失败，继续走 Web 回退路径
      }
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }

    throw new Error('Clipboard write is not supported in this environment')
  }

  return { write }
}
