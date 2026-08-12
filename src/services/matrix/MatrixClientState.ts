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
import type { EventDecryptedDebugState, RustCryptoDebugState } from '@/services/matrix/MatrixCryptoStateTracker'
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

  updateConnectionState(state: ConnectionState): void {
    this.deps.connectionManager.updateConnectionState(state)
  }

  getClient(): MatrixClient | null {
    return this.deps.connectionManager.getClient()
  }

  getSlidingSync(): SlidingSync | null {
    return this.deps.syncManager.get()
  }

  getRustCryptoDebugState(): RustCryptoDebugState {
    return this.deps.cryptoTracker.getRustCryptoDebugState()
  }

  /**
   * 检查 Rust Crypto 是否已成功初始化。
   * 用于在登录后判断加密功能是否可用，若不可用则在加密房间无法发送消息。
   */
  isCryptoReady(): boolean {
    return this.deps.cryptoTracker.getRustCryptoDebugState().initialized
  }

  getEventDecryptedDebugState(): EventDecryptedDebugState {
    return this.deps.cryptoTracker.getEventDecryptedDebugState()
  }

  getConnectionState(): ConnectionState {
    return this.deps.connectionManager.getConnectionState()
  }

  getUserId(): string | null {
    return this.deps.connectionManager.getClient()?.getUserId() ?? null
  }

  getAccessToken(): string | null {
    const client = this.deps.connectionManager.getClient()
    return client?.getAccessToken?.() ?? this.deps.connectionManager.getConfig()?.accessToken ?? null
  }

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

  getDeviceId(): string | null {
    return this.deps.connectionManager.getClient()?.getDeviceId() ?? null
  }

  getUser(userId: string): User | null {
    return this.deps.connectionManager.getClient()?.getUser(userId) ?? null
  }

  isRoomEncrypted(roomId: string): boolean {
    return this.deps.connectionManager.getClient()?.isRoomEncrypted?.(roomId) ?? false
  }
}
