/**
 * MatrixClientState — 客户端状态查询协作类
 *
 * 承载 MatrixClientService 的状态查询职责：
 * - getClient / getConnectionState / updateConnectionState
 * - getSlidingSync
 * - getUserId / getAccessToken / getHomeserverUrl / getServerDomain / getDeviceId / getUser
 * - isRoomEncrypted / isCryptoReady
 * - getRustCryptoDebugState / getEventDecryptedDebugState
 *
 * 通过 deps 注入主类持有的协作模块（connectionManager / syncManager / cryptoTracker），
 * 不再让主类直接承载这些方法的实现细节。
 */
import type { CryptoLifecycleDiagnostics } from '@/services/matrix/crypto/cryptoLifecycleDiagnostics'
import type { EventDecryptedDebugState, RustCryptoDebugState } from '@/services/matrix/MatrixCryptoStateTracker'
import { isRoomEncrypted } from '@/services/matrix/roomEncryption'
import type { MatrixClient, SlidingSync, User } from '@/services/matrix/sdk'
import type { ConnectionState, MatrixConnectionManager } from './MatrixConnectionManager'
import type { MatrixCryptoStateTracker } from './MatrixCryptoStateTracker'
import type { MatrixSyncManager } from './MatrixSyncManager'

/** State 子服务依赖的主类协作模块集合 */
export interface MatrixClientStateDeps {
  readonly connectionManager: MatrixConnectionManager
  readonly syncManager: MatrixSyncManager
  readonly cryptoTracker: MatrixCryptoStateTracker
}

/**
 * 客户端状态查询协作类。
 *
 * 所有查询方法都是只读的（除 updateConnectionState 委托给 connectionManager），
 * 不持有自己的可变状态。
 */
export class MatrixClientState {
  constructor(private readonly deps: MatrixClientStateDeps) {}

  /** 更新连接状态
   */
  updateConnectionState(state: ConnectionState): void {
    this.deps.connectionManager.updateConnectionState(state)
  }

  /** 获取 Matrix 客户端实例
   */
  getClient(): MatrixClient | null {
    return this.deps.connectionManager.getClient()
  }

  /** 获取 SlidingSync 实例
   */
  getSlidingSync(): SlidingSync | null {
    return this.deps.syncManager.get()
  }

  /**
   * 获取 Rust Crypto 调试状态。
   *
   * D9：tracker 的状态是窗口级单例，必须与**当前 client 的绑定**对账 ——
   * `initialized=true` 只有在 `getClient().getCrypto()` 真有句柄时才成立；
   * 否则降级为 false 并标注脱钩原因，避免业务判据与真机脚本读到
   * 「状态已初始化，但当前 client 没有 crypto」。
   */
  getRustCryptoDebugState(): RustCryptoDebugState {
    const state = this.deps.cryptoTracker.getRustCryptoDebugState()
    if (!state.initialized) {
      return state
    }
    const client = this.deps.connectionManager.getClient()
    const cryptoClient = client as (MatrixClient & { getCrypto?: () => unknown }) | null
    const crypto = typeof cryptoClient?.getCrypto === 'function' ? cryptoClient.getCrypto() : null
    const cryptoStopped = (crypto as { stopped?: boolean } | null)?.stopped === true

    if (crypto && !cryptoStopped) {
      // 句柄存在，但归属仍可能是上一个会话：状态标注的账号/设备与当前 client 不一致时
      // 同样不能算「当前会话已就绪」（D9：登出→登录复用 tracker 的典型形态）。
      const currentUserId = client?.getUserId?.() ?? null
      const currentDeviceId = client?.getDeviceId?.() ?? null
      const ownerMismatch =
        (state.userId !== null && currentUserId !== null && state.userId !== currentUserId) ||
        (state.deviceId !== null && currentDeviceId !== null && state.deviceId !== currentDeviceId)
      if (!ownerMismatch) {
        return state
      }
      return {
        ...state,
        initialized: false,
        skippedReason: 'crypto-state-owner-mismatch',
        error: `tracker 状态属于 ${state.userId}:${state.deviceId}，与当前 client ${currentUserId}:${currentDeviceId} 不一致`
      }
    }

    const identity = `${client?.getUserId?.() ?? 'unknown'}:${client?.getDeviceId?.() ?? 'unknown'}`
    return {
      ...state,
      initialized: false,
      skippedReason: cryptoStopped ? 'crypto-stopped' : 'crypto-unavailable-after-init',
      error: cryptoStopped
        ? `tracker 报 initialized，但当前 client 的 crypto 已停止（${identity}）`
        : `tracker 报 initialized，但当前 client 没有 crypto 句柄（${identity}）`
    }
  }

  /**
   * 检查 Rust Crypto 是否已成功初始化。
   * 用于在登录后判断加密功能是否可用，若不可用则在加密房间无法发送消息。
   */
  isCryptoReady(): boolean {
    return this.getRustCryptoDebugState().initialized
  }

  /** 获取事件解密调试状态
   */
  getEventDecryptedDebugState(): EventDecryptedDebugState {
    return this.deps.cryptoTracker.getEventDecryptedDebugState()
  }

  /** 获取 crypto 生命周期诊断（Batch 4.1）。
   */
  getCryptoLifecycleDiagnostics(): CryptoLifecycleDiagnostics {
    return this.deps.cryptoTracker.getCryptoLifecycleDiagnostics()
  }

  /** 获取当前连接状态
   */
  getConnectionState(): ConnectionState {
    return this.deps.connectionManager.getConnectionState()
  }

  /** 获取当前用户 ID
   */
  getUserId(): string | null {
    return this.deps.connectionManager.getClient()?.getUserId() ?? null
  }

  /**
   * 获取访问令牌。
   *
   * AR-07b / B1：**不再回退到连接配置里的 `accessToken` 快照**。
   * 那个兜底本身就是第二份真相：client 为 null 时配置里的 token 可能已经过期
   * （刷新只更新 client + Rust 存储，不更新配置），拿它顶上会让调用方以为"有 token"
   * 却发出必然 401 的请求。client 不存在时返回 null，由调用方显式处理更诚实。
   */
  getAccessToken(): string | null {
    return this.deps.connectionManager.getClient()?.getAccessToken?.() ?? null
  }

  /** 获取 homeserver URL
   */
  getHomeserverUrl(): string | null {
    const client = this.deps.connectionManager.getClient()
    return client?.getHomeserverUrl?.() ?? this.deps.connectionManager.getConfig()?.homeserverUrl ?? null
  }

  /**
   * 获取当前 Matrix homeserver 的域名（server name）。
   *
   * 用于在不直接访问 SDK client 的情况下判断联邦用户等场景。
   * 客户端未初始化时返回空字符串。
   */
  getServerDomain(): string {
    const client = this.deps.connectionManager.getClient()
    return client?.getDomain?.() ?? ''
  }

  /** 获取设备 ID
   */
  getDeviceId(): string | null {
    return this.deps.connectionManager.getClient()?.getDeviceId() ?? null
  }

  /** 获取指定用户信息
   */
  getUser(userId: string): User | null {
    return this.deps.connectionManager.getClient()?.getUser(userId) ?? null
  }

  /** 判断房间是否加密
   */
  isRoomEncrypted(roomId: string): boolean {
    return isRoomEncrypted(this.deps.connectionManager.getClient(), roomId)
  }
}
