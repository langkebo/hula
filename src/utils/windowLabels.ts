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
 * 会**跑** App.vue 里 Matrix 运行时初始化（离线队列 / WebSocket 事件处理 / 在线状态轮询 /
 * 邀请策略）的窗口 label。
 *
 * ⚠️ 语义是**记录当前行为**，不是"这些窗口需要 client"的断言：
 * `isNonMatrixWindow()` 只决定是否跳过上述 4 项初始化；凡不在此名单也不在
 * `NON_MATRIX_WINDOW_LABELS` 的窗口，都会执行它们。
 *
 * 为什么要有这份名单：窗口 label 由 `tauri.*.conf.json` 静态声明 + 9 处运行时
 * `new WebviewWindow(...)` / `createWebviewWindow(...)` 动态创建，散落各处；
 * 新增窗口若忘记分类，会**静默**多跑一套运行时（且没有任何红灯）。
 * `scripts/check-window-label-registry.mjs` 会静态收集全部 label 并强制"必须归类"。
 *
 * 动态 label（前缀）以 `--` 结尾登记，例如独立聊天窗口 `windowChat--<roomId>`。
 *
 * 注意：本常量由 `scripts/check-window-label-registry.mjs` 以文本方式解析，
 * TS 侧无 import 引用，勿按"未使用导出"删除。
 */
export const MATRIX_WINDOW_LABELS = new Set([
  'home',
  'mobile-home',
  'login',
  'register',
  'settings',
  'imageViewer',
  'videoViewer',
  'chat-history',
  'onlineStatus',
  'forgetPassword',
  // `about` 当前也会跑运行时（aboutWindow 内无任何 matrix 引用 ⇒ 属"可跳过"候选，
  // 见 docs/TJG_INTEGRATION_OPTIMIZATION_PLAN_2026-10-13.md Batch 2）
  'about',
  // 动态：`windowChat--${roomId}`（useIndependentChatWindow.buildWindowChatLabel）
  'windowChat--'
])

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
