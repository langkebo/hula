import { createLogger } from '@/utils/Logger'
import { toLocalpart } from '@/utils/userIdentity'
import { DesktopSessionTransition } from './DesktopSessionTransition'
import { SessionBootstrapService } from './SessionBootstrapService'
import { SessionLoginService } from './SessionLoginService'
import { SessionLogoutService } from './SessionLogoutService'
import { SessionRestoreService } from './SessionRestoreService'
import {
  type LogoutMatrixRuntimeSessionOptions,
  type MatrixPasswordLoginOptions,
  type MatrixPostLoginBootstrapOptions,
  type MatrixSsoLoginOptions,
  type ResetMatrixRuntimeSessionOptions,
  type RestoreMatrixRuntimeSessionOptions,
  type SessionRuntimeHost,
  SessionRuntimeState,
  type SessionStorePort,
  type StoredMatrixTokens
} from './sessionRuntimeInternal'

// Re-export public types for backwards compatibility (SessionOrchestrator + tests import these)
export type { PresenceUpdate, SessionStorePort } from './sessionRuntimeInternal'

const logger = createLogger('MatrixRuntimeSessionService')

/**
 * MatrixRuntimeSessionService orchestrates the Matrix session lifecycle:
 * token restore, password/SSO login, post-login bootstrap, logout, and
 * desktop window transitions.
 *
 * Heavy logic is delegated to focused sub-services:
 *  - SessionRestoreService     : token read, session probe, access-token restore, sync wait
 *  - SessionLoginService        : password / SSO login
 *  - SessionBootstrapService    : post-login bootstrap (sync, presence, rooms, search index)
 *  - SessionLogoutService       : logout + local state reset
 *  - DesktopSessionTransition    : desktop-only window transitions (tray / home window)
 *
 * The main class keeps 4 private utility methods and a closure-based host
 * adapter that exposes them (plus cross-cutting delegations) to sub-services
 * without widening the public API.
 */
class MatrixRuntimeSessionService {
  private readonly state = new SessionRuntimeState()
  private readonly restoreService: SessionRestoreService
  private readonly loginService: SessionLoginService
  private readonly bootstrapService: SessionBootstrapService
  private readonly logoutService: SessionLogoutService
  private readonly desktopTransition: DesktopSessionTransition

  constructor(private readonly port: SessionStorePort) {
    // Closure-based host adapter: sub-services call back into the orchestrator
    // for shared utilities and cross-cutting method delegations. The arrows
    // capture `this` and resolve fields lazily (called after construction).
    const host: SessionRuntimeHost = {
      port,
      getCurrentClientDeviceId: () => this.getCurrentClientDeviceId(),
      resolveDisplayName: (uid, displayName, account) => this.resolveDisplayName(uid, displayName, account),
      clearUserLocalStorage: () => this.clearUserLocalStorage(),
      clearMessageCache: () => this.clearMessageCache(),
      getStoredTokens: () => this.getStoredTokens(),
      restoreWithAccessToken: (opts) => this.restoreWithAccessToken(opts),
      bootstrapPostLoginState: (opts) => this.bootstrapPostLoginState(opts),
      waitSyncPrepared: (timeoutMs?: number) => this.restoreService.waitSyncPrepared(timeoutMs),
      resetLocalSessionState: (opts?: ResetMatrixRuntimeSessionOptions) => this.resetLocalSessionState(opts)
    }

    this.restoreService = new SessionRestoreService(host, this.state)
    this.loginService = new SessionLoginService(host)
    this.bootstrapService = new SessionBootstrapService(host, this.state)
    this.logoutService = new SessionLogoutService(host, this.state)
    this.desktopTransition = new DesktopSessionTransition(host)
  }

  // ─── Private utility methods (kept on main class per refactor plan) ──────

  private getCurrentClientDeviceId(): string | null {
    const client = this.port.matrix.getClient() as { getDeviceId?: () => string | null } | null
    return client?.getDeviceId?.() ?? null
  }

  private resolveDisplayName(uid: string, displayName?: string, account?: string): string {
    return displayName || account || toLocalpart(uid) || uid
  }

  private clearUserLocalStorage(): void {
    const userScopedStoreKeys = ['chat', 'group', 'contacts', 'cached', 'sessionUnread']
    userScopedStoreKeys.forEach((key) => {
      localStorage.removeItem(key)
    })
    logger.debug('User localStorage has been cleared')
  }

  private clearMessageCache(): void {
    this.port.group.clearMembersMap()
    logger.debug('Message cache has been cleared')
  }

  // ─── Public API (delegates to sub-services) ──────────────────────────────

  /** 获取本地存储的登录令牌
   */
  async getStoredTokens(): Promise<StoredMatrixTokens> {
    return this.restoreService.getStoredTokens()
  }

  async hasAuthenticatedSession(): Promise<boolean> {
    return this.restoreService.hasAuthenticatedSession()
  }

  /** 使用访问令牌恢复会话
   */
  async restoreWithAccessToken(options: RestoreMatrixRuntimeSessionOptions): Promise<void> {
    return this.restoreService.restoreWithAccessToken(options)
  }

  /** 用户名密码登录
   */
  async loginWithPassword(options: MatrixPasswordLoginOptions): Promise<{ uid: string; accessToken: string }> {
    return this.loginService.loginWithPassword(options)
  }

  /** 使用 SSO 令牌登录
   */
  async loginWithSsoToken(options: MatrixSsoLoginOptions): Promise<{ uid: string; accessToken: string }> {
    return this.loginService.loginWithSsoToken(options)
  }

  /** 确保客户端已就绪
   */
  async ensureClientReady(options?: MatrixPostLoginBootstrapOptions): Promise<void> {
    return this.bootstrapService.ensureClientReady(options)
  }

  /** 初始化登录后状态
   */
  async bootstrapPostLoginState(options: MatrixPostLoginBootstrapOptions = {}): Promise<void> {
    return this.bootstrapService.bootstrapPostLoginState(options)
  }

  /** 重置本地会话状态
   */
  async resetLocalSessionState(options: ResetMatrixRuntimeSessionOptions = {}): Promise<void> {
    return this.logoutService.resetLocalSessionState(options)
  }

  async applyDesktopLoginState(): Promise<void> {
    return this.desktopTransition.applyDesktopLoginState()
  }

  async openDesktopHomeWindow(): Promise<void> {
    return this.desktopTransition.openDesktopHomeWindow()
  }

  async completeDesktopLoginTransition(): Promise<void> {
    return this.desktopTransition.completeDesktopLoginTransition()
  }

  /** 登出当前会话
   */
  async logoutCurrentSession(options: LogoutMatrixRuntimeSessionOptions = {}): Promise<void> {
    return this.logoutService.logoutCurrentSession(options)
  }
}

export { MatrixRuntimeSessionService }
