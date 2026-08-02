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
import { createClient, initializeManagerExtensions, type MatrixClient } from 'matrix-js-sdk'
import { resolveMatrixRuntimeHomeserverUrl } from '@/services/backend'
import { useI18nGlobal } from '@/services/i18n'
import { setMatrixClientAccessor } from '@/services/matrix/matrixClientAccessor'
import { getRuntimeAwareFetchFn } from '@/services/matrix/network/runtimeFetch'
import type { ICreateClientOpts } from '@/types/matrix-js-sdk'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

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
   */
  async initialize(config: MatrixClientConfig): Promise<void> {
    try {
      this.config = config
      this.connectionState = 'CONNECTING'

      // Manager 扩展注册：重试一次，失败时记录详细警告但不中断流程
      // 因为 FriendManager/ProfileManager 等是 synapse-rust 扩展功能，
      // 缺失会导致好友列表、用户资料等功能降级，但基础 sync 仍可工作
      await this.initializeManagerExtensionsWithRetry()

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

      const clientOpts: ICreateClientOpts = {
        baseUrl: config.homeserverUrl,
        deviceId: config.deviceId,
        accessToken: config.accessToken,
        userId: config.userId,
        useAuthorizationHeader: true,
        allowInsecureHttp: config.allowInsecureHttp,
        fetchFn
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
    } catch (err) {
      this.connectionState = 'ERROR'
      logger.error('客户端初始化失败:', err)
      throw err
    }
  }

  /**
   * 初始化 Manager 扩展，带重试机制
   *
   * Manager 扩展（FriendManager/ProfileManager 等）是 synapse-rust 特有功能，
   * 注册失败会导致好友列表、用户资料等功能降级，但基础 sync 仍可工作。
   * 因此失败时不抛出异常，仅记录详细警告。
   */
  private async initializeManagerExtensionsWithRetry(maxRetries = 1): Promise<void> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await initializeManagerExtensions()
        logger.info('Manager 扩展注册完成')
        return
      } catch (extErr) {
        if (attempt < maxRetries) {
          logger.warn(`Manager 扩展注册失败 (尝试 ${attempt + 1}/${maxRetries + 1})，重试中:`, extErr)
          await new Promise((resolve) => setTimeout(resolve, 200))
          continue
        }
        logger.error('Manager 扩展注册最终失败（好友/资料等功能将降级）:', extErr)
        logger.warn(
          '影响范围: FriendManager 未注册 → 好友列表/特别好友标识不可用；ProfileManager 未注册 → 用户资料查询降级'
        )
      }
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

  /** 成功 sync 后重置错误计数 */
  resetSyncErrorCount(): void {
    this.consecutiveSyncErrors = 0
  }

  /** 更新连接状态并通知所有订阅者 */
  updateConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) return
    this.connectionState = state
    this.stateChangeCallbacks.forEach((cb) => cb(state))
    logger.info(`连接状态已更新: ${state}`)
  }

  /** 订阅状态变更 */
  onStateChange(cb: ConnectionStateChangeCallback): void {
    this.stateChangeCallbacks.add(cb)
  }

  /** 取消订阅状态变更 */
  offStateChange(cb: ConnectionStateChangeCallback): void {
    this.stateChangeCallbacks.delete(cb)
  }

  /** 设置系统恢复监听器，返回清理函数 */
  setupResumeListener(onResume: () => void, registerFn: (cb: () => void) => () => void): void {
    this.cleanupResumeListener()
    this.resumeCleanup = registerFn(onResume)
  }

  /** 清理系统恢复监听器 */
  cleanupResumeListener(): void {
    if (this.resumeCleanup) {
      this.resumeCleanup()
      this.resumeCleanup = null
    }
  }

  /** 等待 client 就绪 */
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

  getClient(): MatrixClient | null {
    return this.client
  }

  getConfig(): MatrixClientConfig | null {
    return this.config
  }

  getConnectionState(): ConnectionState {
    return this.connectionState
  }

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

  /** 重置状态（供 facade 在 stop/logout 时调用） */
  resetState(): void {
    this.cleanupResumeListener()
    this.client = null
    this.config = null
    this.connectionState = 'DISCONNECTED'
    this.consecutiveSyncErrors = 0
  }
}
