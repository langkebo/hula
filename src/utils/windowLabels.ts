import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { hasTauriRuntime } from '@/utils/AppHarness'

/**
 * 不需要 Matrix 客户端运行时能力的窗口。
 *
 * 这些窗口仍会加载 App 壳（main.ts → App.vue），但不需要连接状态、
 * 来电监听、离线消息队列、WebSocket 事件处理或在线状态轮询。
 *
 * `capture/tray/notify/update/checkupdate`：截图 / 托盘 / 通知 / 更新，本就与 Matrix 无关。
 *
 * `login/register/forgetPassword`：**登录类窗口**。它们的任务是建立会话，而不是消费会话：
 * - 自动登录走 `useLoginOrchestrator` 自己的 `autoLoginEnabled` 分支（倒计时 → 调 login），
 *   不依赖 `recoverColdStartSession`；
 * - 登录成功后确实会短暂持有 client，但 `DesktopSessionTransition.openDesktopHomeWindow()`
 *   在交接给 home 前显式 `stopClient()`（否则两条 sync 会并发写同一个 sliding sync pos，
 *   导致游标回退与 400）；
 * - 因此它们不该跑 `initOfflineQueue` / `wsEventHandler` / `invitePolicyEnforcement` /
 *   `recoverColdStartSession` —— 尤其是最后一项：在登录窗口里它只会拿残留凭证去
 *   尝试建 client，正是"登录页背后悄悄连上"这种状态的来源。
 *
 * ⚠️ 因此：**登录类窗口不得依赖 Matrix 运行时**。若将来需要（例如登录前就要 sync），
 * 必须先把该窗口移回 `MATRIX_WINDOW_LABELS` 并重新评估上面三条。
 *
 * 注意：与 messageLoading 的 NON_CHAT_WINDOW_LABELS 不同——后者是"不参与消息加载"的名单，
 * 与是否跑 Matrix 运行时是两件事，不要合并。
 *
 * 'notify' 由 `windowRtc.ensureNotifyWindow()` 运行时创建，不在 `createWebviewWindow`
 * 静态采集范围内，因此 `check-window-label-registry` 会把它列为“无静态来源”，属预期提示。
 */
export const NON_MATRIX_WINDOW_LABELS = new Set([
  'capture',
  'tray',
  'notify',
  'update',
  'checkupdate',
  // 登录类窗口：只建立会话，不消费会话（见上方说明）
  'login',
  'register',
  'forgetPassword'
])

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
  'settings',
  'imageViewer',
  'videoViewer',
  'chat-history',
  'onlineStatus',
  // aboutWindow 内无任何 Matrix 引用，但当前仍会跑运行时初始化；
  // 若要跳过，需整体迁入 NON_MATRIX_WINDOW_LABELS 并验证在窗口内核验。
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

/**
 * 登录类窗口的 label（登录 / 注册 / 找回密码）。**是 `NON_MATRIX_WINDOW_LABELS` 的子集**。
 *
 * 这些窗口不承担连接：用户在里面的目的是建立会话，而不是消费会话。
 * 任何"连接状态"提示对它们都是误报 —— 尤其 `useConnectionStatus` 的
 * `DISCONNECTED + isLoggedIn → error` 分支：`isLoggedIn` 来自**持久化的 userId**，
 * 在登录窗口里它只是上一次登录的残留，用它会得出"登录页连接失败"这种自相矛盾的结论。
 *
 * 本常量比 `NON_MATRIX_WINDOW_LABELS` 更窄（后者还有截图/托盘/通知/更新），
 * 用于"该不该显示连接提示 / 该不该响应重试"这类**语义**判断；是否跳过运行时初始化
 * 仍由 `isNonMatrixWindow()` 决定，两者不要合并 —— 托盘窗口同样不显示连接提示，
 * 但它连 App 主界面都不渲染，语义不同。
 */
export const LOGIN_WINDOW_LABELS = new Set(['login', 'register', 'forgetPassword'])

/**
 * 当前窗口是否属于登录类窗口。
 * 非 Tauri 运行时（浏览器/测试）返回 false，保持默认行为。
 */
export function isLoginWindow(): boolean {
  if (!hasTauriRuntime()) return false
  try {
    return LOGIN_WINDOW_LABELS.has(WebviewWindow.getCurrent().label)
  } catch {
    return false
  }
}
