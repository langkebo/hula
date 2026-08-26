import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { hasTauriRuntime } from '@/utils/AppHarness'

/**
 * 不需要 Matrix 客户端运行时能力的窗口（截图/托盘/通知/更新）。
 *
 * 这些窗口仍会加载 App 壳（main.ts → App.vue），但不需要连接状态、
 * 来电监听、离线消息队列、WebSocket 事件处理或在线状态轮询。
 *
 * 注意：与 messageLoading 的 NON_CHAT_WINDOW_LABELS 不同——后者包含 'login'
 * （登录窗不参与消息加载），但 login 窗口需要 Matrix 客户端来完成登录，故不在此列。
 */
export const NON_MATRIX_WINDOW_LABELS = new Set(['capture', 'tray', 'notify', 'update', 'checkupdate'])

/**
 * 当前窗口是否属于「非 Matrix 窗口」。
 * 非 Tauri 运行时（浏览器/测试）返回 false，保持默认行为。
 */
export function isNonMatrixWindow(): boolean {
  if (!hasTauriRuntime()) return false
  try {
    return NON_MATRIX_WINDOW_LABELS.has(WebviewWindow.getCurrent().label)
  } catch {
    // 窗口上下文不可用（如测试 stub）时保守返回 false
    return false
  }
}
