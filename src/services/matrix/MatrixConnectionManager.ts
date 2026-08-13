/**
 * MatrixConnectionManager — 连接生命周期 + 状态机深模块
 *
 * 职责：
 * - 管理 MatrixClient 实例的创建与配置
 * - 维护 ConnectionState 状态机（DISCONNECTED/CONNECTING/CONNECTED/RECONNECTING/ERROR）
 * - 映射 SDK SyncState → ConnectionState
 * - 追踪 SlidingSync 连续错误，3 次后降级为 RECONNECTING
 * - 系统恢复后触发重连
 *
 * 不负责：
 * - 事件路由（由 MatrixEventRouter 负责）
 * - Crypto 初始化（由 MatrixCryptoStateTracker 负责）
 * - Auth 登录流程（由 facade MatrixClientService 编排）
 *
 * @see codebase-design DEEPENING.md — 接受依赖，不创建依赖
 */

import { resolveMatrixRuntimeHomeserverUrl } from '@/services/backend'
import { useI18nGlobal } from '@/services/i18n'
import { isFriendManagerRegistered } from '@/services/matrix/extensions/managerExtensions'
import { setMatrixClientAccessor } from '@/services/matrix/matrixClientAccessor'
import { getRuntimeAwareFetchFn } from '@/services/matrix/network/runtimeFetch'
import {
  type CryptoCallbacks,
  createClient,
  initializeManagerExtensions,
  type MatrixClient
} from '@/services/matrix/sdk'
import { useCapabilityStore } from '@/stores/domains/chat/capability'
import type { ICreateClientOpts } from '@/types/matrix-js-sdk'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { track } from '@/utils/telemetry'

const logger = createLogger('MatrixConnection')

/** 连接状态类型 */
export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'CATCHUP' | 'ERROR'

type SyncErrorLike = {
  errcode?: string
  name?: string
}

/** Matrix 客户端配置接口 */
export interface MatrixClientConfig {
  homeserverUrl: string
  identityServerUrl?: string
  deviceId?: string
  accessToken?: string
  userId?: string
  allowInsecureHttp?: boolean
  slidingSync?: {
    roomRangeEnd?: number
    timelineLimit?: number
    pollTimeout?: number
  }
}

/** 状态变更回调类型 */
export type ConnectionStateChangeCallback = (state: ConnectionState) => void

/** 同步状态映射结果 */
export type SyncStateMappingResult = {
  /** 映射后的连接状态（null 表示无需变更） */
  connectionState: ConnectionState | null
  /** 是否是 PREPARED/SYNCING（用于 markReady） */
  isReady: boolean
}

/**
 * 连接生命周期管理器
 *
 * 深模块：小接口（initialize/getClient/getState/onStateChange）+ 大实现
 * （SDK 初始化、runtime URL resolve、manager extensions 注册、状态机映射、错误追踪）
 */
export class MatrixConnectionManager {
  private client: MatrixClient | null = null
  private connectionState: ConnectionState = 'DISCONNECTED'
  private consecutiveSyncErrors = 0
  private config: MatrixClientConfig | null = null
  private readonly stateChangeCallbacks: Set<ConnectionStateChangeCallback> = new Set()
  private resumeCleanup: (() => void) | null = null

  /**
   * 初始化 MatrixClient 实例
   *
   * 隐藏的复杂实现：
   * - runtime URL resolve（dev proxy / Android emulator 重写）
   * - manager extensions 注册
   * - matrixClientAccessor 设置
   * - fetchFn 选择（Tauri nativeFetch vs browser fetch）
   *
   * 身份 vs 易变字段分离（对齐 element-web SdkConfig）：
   * - 身份字段（homeserverUrl/userId/deviceId/identityServerUrl/allowInsecureHttp）变化 → 重建 client
   * - 易变字段（accessToken）变化 → 原地 setAccessToken，绝不重建
   *   避免 token 刷新时整客户端重建导致 sync 中断、E2EE 重新握手、事件监听器重挂
   */
  async initialize(config: MatrixClientConfig): Promise<void> {
    // 身份等价 → 复用现有 client（不 detach 监听器 / 不 stop sync / 不 reset crypto）
    if (this.client && this.config && this.isIdentityEquivalent(config)) {
      // token 旋转：身份不变但 accessToken 变化时，原地更新而非重建
      if (config.accessToken && config.accessToken !== this.config.accessToken) {
        const tokenUpdated = this.tryUpdateAccessTokenInPlace(config.accessToken)
        if (!tokenUpdated) {
          // fallback：setAccessToken 失败 → 释放旧实例走重建路径
          logger.warn('setAccessToken 原地更新失败，回退到整客户端重建')
          this.resetState()
          // 继续走下方的重建路径
        } else {
          this.config = config
          return
        }
      } else {
        logger.info('MatrixClient 已初始化且配置一致，复用现有实例')
        return
      }
    }
    // 身份变化（如 deviceId/userId 变化）→ 先释放旧实例，避免内存/连接泄漏。
    if (this.client) {
      logger.info('MatrixClient 身份变更，释放旧实例后重建')
      this.resetState()
    }

    try {
      this.config = config
      this.connectionState = 'CONNECTING'

      try {
        await initializeManagerExtensions()
        logger.info('Manager 扩展注册完成')
      } catch (extErr) {
        logger.error('Manager 扩展注册失败:', extErr)
      }

      // Runtime resolve: https://matrix.test → dev proxy origin
      const runtimeHomeserverUrl = resolveMatrixRuntimeHomeserverUrl(config.homeserverUrl)
      if (runtimeHomeserverUrl !== config.homeserverUrl) {
        logger.info(`Runtime resolve homeserver: ${config.homeserverUrl} -> ${runtimeHomeserverUrl}`)
        config = { ...config, homeserverUrl: runtimeHomeserverUrl }
      }

      const fetchFn = getRuntimeAwareFetchFn()
      logger.info(
        `初始化 MatrixClient: baseUrl=${config.homeserverUrl}, hasTauriRuntime=${hasTauriRuntime()}, fetchFn=${fetchFn ? 'custom' : 'undefined(SDK default)'}`
      )

      const cryptoCallbacks: CryptoCallbacks = {
        getSecretStorageKey: async (opts: { keys: Record<string, unknown> }) => {
          // Try to find a cached key in sessionStorage
          for (const keyId of Object.keys(opts.keys)) {
            const cached = sessionStorage.getItem(`ssss_${keyId}`)
            if (cached) {
              try {
                const key = Uint8Array.from(atob(cached), (c) => c.charCodeAt(0))
                return [keyId, key]
              } catch {
                sessionStorage.removeItem(`ssss_${keyId}`)
              }
            }
          }
          return null
        },
        cacheSecretStorageKey: (keyId: string, _keyInfo: unknown, key: Uint8Array) => {
          sessionStorage.setItem(`ssss_${keyId}`, btoa(String.fromCharCode(...key)))
        }
      }

      const clientOpts: ICreateClientOpts = {
        baseUrl: config.homeserverUrl,
        deviceId: config.deviceId,
        accessToken: config.accessToken,
        userId: config.userId,
        useAuthorizationHeader: true,
        allowInsecureHttp: config.allowInsecureHttp,
        fetchFn,
        cryptoCallbacks
      }

      if (config.identityServerUrl) {
        clientOpts.idBaseUrl = config.identityServerUrl
      }

      setMatrixClientAccessor({
        getClient: () => this.client,
        getAccessToken: () => this.client?.getAccessToken() ?? null,
        getHomeserverUrl: () => this.client?.getHomeserverUrl() ?? null,
        waitForClientReady: (opts) => this.waitForClientReady(opts)
      })

      this.client = createClient(clientOpts)
      logger.info(`客户端初始化完成: ${config.homeserverUrl}`)

      // 扩展健康断言：在 client 创建后检测关键扩展是否已注册。
      // 缺失时 warn + 写入 capability store 的 extensionHealth（degraded），
      // 不再被 info 级静默吞掉。UI 层可据此显示降级提示。
      this.assertCriticalExtensions()
    } catch (err) {
      this.connectionState = 'ERROR'
      logger.error('客户端初始化失败:', err)
      throw err
    }
  }

  /**
   * 映射 SDK SyncState → ConnectionState
   *
   * 返回 connectionState（null 表示无变更）和 isReady 标志。
   * 调用方根据 isReady 决定是否调用 syncManager.markReady()。
   */
  mapSyncState(state: string, prevState?: string, data?: unknown): SyncStateMappingResult {
    const errorData = data as SyncErrorLike | undefined

    // 日志降噪：限流/超时不输出 error 日志
    if (state === 'ERROR') {
      if (errorData?.errcode === 'M_LIMIT_EXCEEDED' || errorData?.name === 'ConnectionError') {
        // 限流/超时是常见暂时性问题，不输出日志避免刷屏
      } else {
        logger.error(`同步错误: ${state}`, {
          prevState,
          errcode: errorData?.errcode,
          errorName: errorData?.name
        })
      }
    } else if (state !== prevState) {
      logger.info(`同步状态: ${state}`)
    }

    switch (state) {
      case 'PREPARED':
      case 'SYNCING':
        return { connectionState: 'CONNECTED', isReady: true }
      case 'CATCHUP':
        // CATCHUP 是 SDK 从断开恢复后重新同步历史消息的瞬态，独立暴露
        // 让 UI 可显示"正在同步历史消息"提示（非阻塞）
        return { connectionState: 'CATCHUP', isReady: true }
      case 'RECONNECTING':
        return { connectionState: 'RECONNECTING', isReady: false }
      case 'ERROR':
        return { connectionState: 'ERROR', isReady: false }
      case 'STOPPED':
        return { connectionState: 'DISCONNECTED', isReady: false }
      default:
        return { connectionState: null, isReady: false }
    }
  }

  /**
   * 处理 SlidingSync Lifecycle 错误
   *
   * 隐藏的复杂实现：
   * - 递增 consecutiveSyncErrors
   * - 连续 3 次错误 + 当前 CONNECTED → 降级为 RECONNECTING
   */
  handleSyncLifecycleError(_err: Error): void {
    this.consecutiveSyncErrors++
    if (this.consecutiveSyncErrors >= 3 && this.connectionState === 'CONNECTED') {
      this.updateConnectionState('RECONNECTING')
    }
  }

  /** 重置同步错误计数
   */
  resetSyncErrorCount(): void {
    this.consecutiveSyncErrors = 0
  }

  /** 更新连接状态
   */
  updateConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) return
    this.connectionState = state
    this.stateChangeCallbacks.forEach((cb) => cb(state))
    logger.info(`连接状态已更新: ${state}`)
  }

  /** 注册连接状态变更监听
   */
  onStateChange(cb: ConnectionStateChangeCallback): void {
    this.stateChangeCallbacks.add(cb)
  }

  /** 移除连接状态变更监听
   */
  offStateChange(cb: ConnectionStateChangeCallback): void {
    this.stateChangeCallbacks.delete(cb)
  }

  /** 设置系统恢复监听器，返回清理函数 */
  setupResumeListener(onResume: () => void, registerFn: (cb: () => void) => () => void): void {
    this.cleanupResumeListener()
    this.resumeCleanup = registerFn(onResume)
  }

  /** 清理系统恢复监听器
   */
  cleanupResumeListener(): void {
    if (this.resumeCleanup) {
      this.resumeCleanup()
      this.resumeCleanup = null
    }
  }

  /** 等待客户端就绪
   */
  async waitForClientReady(opts?: { timeoutMs?: number; intervalMs?: number }): Promise<MatrixClient> {
    if (this.client) return this.client
    const timeoutMs = opts?.timeoutMs ?? 5000
    const intervalMs = opts?.intervalMs ?? 50
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (this.client) return this.client
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    throw new Error(useI18nGlobal().t('matrix_error.client.not_ready_timeout'))
  }

  // ---- Accessors -------------------------------------------------------------

  /** 获取 Matrix 客户端实例
   */
  getClient(): MatrixClient | null {
    return this.client
  }

  /** 获取客户端配置
   */
  getConfig(): MatrixClientConfig | null {
    return this.config
  }

  /**
   * 原地更新 accessToken，避免 token 旋转时整客户端重建。
   *
   * 场景：token 刷新（MatrixTokenManager / loginWithToken refresh）后，
   * 身份字段不变仅 accessToken 变化。此时通过 SDK 的 setAccessToken 原地更新，
   * 避免 rebuild 导致 sync 中断、E2EE 重新握手、事件监听器重挂。
   *
   * @returns true 表示更新成功；false 表示 setAccessToken 不可用或抛错，调用方应回退到 rebuild
   */
  private tryUpdateAccessTokenInPlace(newToken: string): boolean {
    if (!this.client) return false
    try {
      const setter = (this.client as unknown as { setAccessToken?: (token: string) => void }).setAccessToken
      if (typeof setter !== 'function') {
        logger.warn('MatrixClient 不支持 setAccessToken，无法原地更新 token')
        return false
      }
      setter.call(this.client, newToken)
      logger.info('Token 旋转，原地更新 accessToken（不重建 client）')
      return true
    } catch (err) {
      logger.warn('setAccessToken 抛错，将回退到整客户端重建:', err)
      return false
    }
  }

  /**
   * 判断配置身份是否等价（不含 accessToken 等易变字段）。
   *
   * 身份字段（不可变）：homeserverUrl / userId / deviceId / identityServerUrl / allowInsecureHttp
   * 易变字段（可原地更新）：accessToken
   *
   * 对齐 element-web SdkConfig 的"身份 vs 易变"分离原则：
   * 仅身份变化才需要重建 client；token 旋转通过 setAccessToken 原地更新。
   */
  private isIdentityEquivalent(config: MatrixClientConfig): boolean {
    const cur = this.config
    if (!cur) return false
    return (
      cur.homeserverUrl === config.homeserverUrl &&
      cur.userId === config.userId &&
      cur.deviceId === config.deviceId &&
      cur.identityServerUrl === config.identityServerUrl &&
      cur.allowInsecureHttp === config.allowInsecureHttp
    )
  }

  /**
   * 供 facade（MatrixClientService.initialize）判断本次 initialize 是否会复用现有 client。
   *
   * 复用判定基于身份等价（不含 accessToken），因此 token 旋转时也返回 true，
   * facade 据此跳过 detach / stop / reset（避免丢失已挂载的事件路由和 sync 状态）。
   * token 更新由 connectionManager.initialize 内部通过 setAccessToken 原地完成。
   */
  shouldReuse(config: MatrixClientConfig): boolean {
    return !!this.client && !!this.config && this.isIdentityEquivalent(config)
  }

  /** 获取当前连接状态
   */
  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  /** 获取连续同步错误次数
   */
  getConsecutiveSyncErrors(): number {
    return this.consecutiveSyncErrors
  }

  /**
   * 设置 client（供 facade 在 auth 流程中使用）
   *
   * auth 方法（login/loginWithToken）需要先 createClient 再替换 client，
   * 此方法暴露受控的 setter 避免外部直接修改。
   */
  setClient(client: MatrixClient | null): void {
    this.client = client
  }

  /**
   * 扩展健康断言：检测关键 SDK 扩展是否已注册到 client。
   *
   * 在 initializeManagerExtensions() 后调用。检测结果写入 capability store 的
   * extensionHealth 字段，UI 层可据此显示降级提示。
   *
   * 检测方式：通过鸭子类型检查 client 上的扩展访问器方法是否存在。
   * - friend-manager：检查 `client.getFriendManager` 是否为 function
   *
   * 缺失时不 throw（与现有 MatrixFriendService 的 REST 降级策略一致），
   * 但会 warn 级日志 + 标记 degraded，不再被 info 级静默吞掉。
   */
  private assertCriticalExtensions(): void {
    if (!this.client) return

    const _clientWithMethods = this.client as unknown as Record<string, unknown>
    const results: Record<string, 'healthy' | 'degraded'> = {}

    // FriendManager 扩展 —— 注册检查统一委托单一真相谓词，避免逻辑漂移
    const hasFriendManager = isFriendManagerRegistered(this.client)

    results['friend-manager'] = hasFriendManager ? 'healthy' : 'degraded'

    if (!hasFriendManager) {
      logger.warn(
        '[扩展健康断言] FriendManager 扩展未注册，好友功能将降级到 REST API。' +
          '可能原因：initializeManagerExtensions 失败或 SDK 版本不兼容。'
      )
      // O2: 通过 telemetry 事件总线发射健康事件，供监控/告警消费
      track({
        kind: 'health',
        name: 'friend_manager_degraded',
        severity: 'warn',
        context: {
          reason: 'getFriendManager_unavailable',
          fallback: 'rest_api',
          possibleCause: 'initializeManagerExtensions_failed_or_sdk_incompatible'
        }
      })
    } else {
      logger.info('[扩展健康断言] FriendManager 扩展已注册')
    }

    // 写入 capability store（Pinia 可能未初始化，如独立 WebView / 测试环境）
    try {
      const store = useCapabilityStore()
      store.setExtensionHealthBatch(results)
    } catch {
      // Pinia 未初始化时静默跳过（测试环境常见），不影响 client 创建
      logger.debug('[扩展健康断言] capability store 未初始化，跳过状态写入')
    }
  }

  /** 重置连接管理器状态
   */
  resetState(): void {
    this.cleanupResumeListener()
    this.client = null
    this.config = null
    this.connectionState = 'DISCONNECTED'
    this.consecutiveSyncErrors = 0
  }
}

// ─── globalThis 单例守卫 ──────────────────────────────────────────────────────
// 防止 Vite HMR 模块重载 / 动态-静态导入混用 / 绕过 MatrixClientService 直接 new
// 导致第二个 ConnectionManager 实例并发调用 initializeManagerExtensions() 和
// createClient()，竞争 IndexedDB crypto 句柄。
// 与 MatrixClientService 的 __TJG_MATRIX_CLIENT_SERVICE__ 守卫对齐。
const CONNECTION_MANAGER_SINGLETON_KEY = '__TJG_MATRIX_CONNECTION_MANAGER__'
const __g = globalThis as Record<string, unknown>

/**
 * 获取 MatrixConnectionManager 的进程级单例。
 *
 * 生产代码应通过此函数获取实例，而非直接 `new MatrixConnectionManager()`。
 * 单元测试如需独立实例，可直接 `new`（构造函数保持公开），
 * 但应在 beforeEach / afterEach 中清理 globalThis 上的单例缓存以避免污染。
 */
export function getMatrixConnectionManager(): MatrixConnectionManager {
  const existing = __g[CONNECTION_MANAGER_SINGLETON_KEY] as MatrixConnectionManager | undefined
  if (existing) return existing
  const instance = new MatrixConnectionManager()
  __g[CONNECTION_MANAGER_SINGLETON_KEY] = instance
  return instance
}

/** 测试专用：清理 globalThis 单例缓存，确保下一个 getMatrixConnectionManager() 创建新实例。 */
export function __resetConnectionManagerSingletonForTesting(): void {
  delete __g[CONNECTION_MANAGER_SINGLETON_KEY]
}
