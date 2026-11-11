/**
 * 浏览器存储键的唯一定义源（src 与 e2e 共用）。
 *
 * 背景（F-8）：应用从 hula 更名为 tjg 后，`e2e/support/*` 仍写 `hula:e2e:*` 与
 * `hula-homeserver-url`，而 src 读的是 `tjg:*` / `tjg-homeserver-url`。结果是
 * e2e 播下的 `mock-auth` / `platform` 标记**从未生效**（`shouldBypassAuthForE2E()`
 * 恒 false、`detectAppPlatform()` 恒走 UA 兜底），用例靠登录页与宽松断言「假绿」。
 *
 * 约束：
 * 1. 本模块必须保持**零依赖**（纯常量），因为 `e2e/support/*` 会以相对路径直接
 *    import 它（Playwright 用 esbuild 转译，不能把 `@tauri-apps/*` 之类拉进浏览器上下文）；
 * 2. 新增存储键一律在此声明，禁止在 e2e / scripts 里写字面量（静态守卫见
 *    `src/utils/__tests__/storageKeys.test.ts`）。
 */

/** E2E 开关类标记（`AppHarness` / `platformDetection` 消费）。 */
export const E2E_STORAGE_KEYS = {
  /** 全局 E2E 模式开关，跳过 driver.js 引导层。 */
  enabled: 'tjg:e2e:enabled',
  /** 旁路鉴权（仅 DEV），用于 mock 会话的 UI 用例。 */
  mockAuth: 'tjg:e2e:mock-auth',
  /** 强制平台标记，绕开 `getOsType()` 在纯浏览器里抛错的问题。 */
  platform: 'tjg:e2e:platform'
} as const

/** 用户配置的 homeserver 地址（未登录态）。 */
export const MATRIX_HOMESERVER_STORAGE_KEY = 'tjg-homeserver-url'
/** 用户配置的 identity server 地址（未登录态）。 */
export const MATRIX_IDENTITY_SERVER_STORAGE_KEY = 'tjg-identity-server-url'
/** 当前会话实际使用的 homeserver 地址。 */
export const MATRIX_SESSION_HOMESERVER_STORAGE_KEY = 'tjg-session-homeserver-url'
/** 当前会话实际使用的 identity server 地址。 */
export const MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY = 'tjg-session-identity-server-url'
/**
 * 「允许浏览器 at-rest 凭证回退」开关（`matrixClientPlatform` 消费）。
 *
 * 真机默认关闭：凭证只由 Rust 保管。仅有伪造 `__TAURI_INTERNALS__` 却读不到
 * token 的场景（浏览器 e2e shim / 无真实命令的宿主 WebView）需显式置 1。
 */
export const WEB_SESSION_FALLBACK_STORAGE_KEY = 'tjg:session:web-fallback'

/** 离线消息队列的持久化键（`OfflineQueueService` 与 e2e 断网用例共用）。 */
export const OFFLINE_QUEUE_STORAGE_KEY = 'tjg-offline-queue'

/** 搜索索引 IndexedDB 库名（`searchIndexDb` 与 e2e 校验用例共用）。 */
export const SEARCH_INDEX_DB_NAME = 'tjg-worker-cache'

/** 本模块声明的所有键（守卫用：e2e 里出现的 tjg 字面量必须命中本集合）。 */
export const ALL_STORAGE_KEYS: readonly string[] = [
  ...Object.values(E2E_STORAGE_KEYS),
  MATRIX_HOMESERVER_STORAGE_KEY,
  MATRIX_IDENTITY_SERVER_STORAGE_KEY,
  MATRIX_SESSION_HOMESERVER_STORAGE_KEY,
  MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY,
  WEB_SESSION_FALLBACK_STORAGE_KEY,
  OFFLINE_QUEUE_STORAGE_KEY,
  SEARCH_INDEX_DB_NAME
]
