import type { OnlineEnum } from '@/enums'
import type { MatrixClientConfig } from '@/services/matrix/MatrixClientService'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import type { RoomInfo, UserInfoType } from '@/services/types'
import type { MessageType } from '@/types/message'
import { IdempotencyGuard } from '@/utils/ExecutionGuard'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixRuntimeSessionService')

export interface StoredMatrixTokens {
  uid?: string | null
  token: string | null
  refreshToken?: string | null
}

export interface RestoreMatrixRuntimeSessionOptions {
  uid: string
  accessToken: string
  refreshToken?: string
  displayName?: string
  account?: string
  avatar?: string
  client?: 'PC' | 'MOBILE'
  persistTokens?: boolean
  persistUserInfo?: boolean
  switchDatabase?: boolean
  bootstrapAfterRestore?: boolean
}

export interface MatrixPostLoginBootstrapOptions {
  account?: string
  displayName?: string
  avatar?: string
  client?: 'PC' | 'MOBILE'
}

export interface MatrixPasswordLoginOptions extends MatrixPostLoginBootstrapOptions {
  username: string
  password: string
  homeserverUrl: string
  identityServerUrl?: string
  deviceName?: string
  persistTokens?: boolean
  persistUserInfo?: boolean
  switchDatabase?: boolean
}

export interface MatrixSsoLoginOptions extends MatrixPostLoginBootstrapOptions {
  loginToken: string
  persistTokens?: boolean
  persistUserInfo?: boolean
  switchDatabase?: boolean
}

export interface ResetMatrixRuntimeSessionOptions {
  preserveTokens?: boolean
}

export interface LogoutMatrixRuntimeSessionOptions extends ResetMatrixRuntimeSessionOptions {
  resetLocalState?: boolean
}

export interface PresenceUpdate {
  activeStatus: OnlineEnum
  lastOptTime: number
}

export interface SessionStorePort {
  matrix: {
    getClient(): unknown
    getUserId(): string | null | undefined
    isLoggedIn(): boolean
    isInitialized(): boolean
    getLastError(): string | undefined
    getAccessToken(): string | undefined
    getRefreshToken(): string | undefined
    getHomeserverUrl(): string | undefined
    initialize(config: MatrixClientConfig): Promise<void>
    login(username: string, password: string, deviceName?: string): Promise<boolean>
    completeSSOLogin(loginToken: string): Promise<boolean>
    loginWithToken(accessToken: string, userId: string, refreshToken?: string): Promise<boolean>
    logout(): Promise<void>
  }
  user: {
    getUserInfo(): UserInfoType | undefined
    initUserInfo(uid: string, displayName: string): void
    setUserInfo(info: UserInfoType): void
    clearUser(): void
    fetchUserProfile(uid: string): Promise<{ displayName?: string; avatarUrl?: string } | null>
    updateProfileFields(fields: Partial<Pick<UserInfoType, 'name' | 'avatar' | 'activeStatus' | 'lastOptTime'>>): void
  }
  room: {
    getRoomList(): RoomInfo[]
    getMessages(roomId: string): MessageType[]
    resetState(): void
    setupEventListeners(): Promise<void>
    loadRooms(): Promise<boolean>
  }
  chat: {
    getSessionList(refresh: boolean): Promise<void>
    getSessionListValue(): Array<{ roomId: string }>
  }
  group: {
    clearGroupDetails(): void
    clearMembersMap(): void
    updateUserPresence(userId: string, presence: PresenceUpdate): void
  }
  contact: {
    updateContactPresence(userId: string, patch: PresenceUpdate & { presence?: string; statusMessage?: string }): void
  }
  global: {
    getCurrentSessionRoomId(): string | undefined
    updateCurrentSessionRoomId(roomId: string): void
    setTrayMenuShow(show: boolean): void
  }
  loginHistory: {
    addLoginHistory(account: UserInfoType): void
  }
  emoji: {
    initEmojis(): Promise<void>
    prefetchEmojiToLocal(): Promise<void>
  }
  setting: {
    closeAutoLogin(): void
  }
}

/**
 * Internal host interface: sub-services call back into the orchestrator
 * for shared utilities and cross-cutting method delegations.
 * Not part of the public API.
 */
export interface SessionRuntimeHost {
  readonly port: SessionStorePort
  // Private utilities (kept on main class)
  getCurrentClientDeviceId(): string | null
  resolveDisplayName(uid: string, displayName?: string, account?: string): string
  clearUserLocalStorage(): void
  clearMessageCache(): void
  // Cross-cutting delegations
  getStoredTokens(): Promise<StoredMatrixTokens>
  restoreWithAccessToken(options: RestoreMatrixRuntimeSessionOptions): Promise<void>
  bootstrapPostLoginState(options: MatrixPostLoginBootstrapOptions): Promise<void>
  waitSyncPrepared(timeoutMs?: number): Promise<void>
  resetLocalSessionState(options?: ResetMatrixRuntimeSessionOptions): Promise<void>
}

/**
 * Shared mutable runtime state accessed by multiple sub-services.
 * - `bootstrapGuard` is used by SessionBootstrapService and reset by SessionLogoutService.
 * - `presenceChangeCleanup` is registered by SessionBootstrapService and cleared by SessionLogoutService.
 * - `beforeUnloadRegistered` / `onBeforeUnload` follow the same lifecycle.
 * - `cachedHasSession` is managed by SessionRestoreService and cleared by SessionLogoutService.
 */
export class SessionRuntimeState {
  readonly bootstrapGuard = new IdempotencyGuard()
  presenceChangeCleanup: (() => void) | null = null
  beforeUnloadRegistered = false
  cachedHasSession: boolean | null = null
  readonly onBeforeUnload = () => {
    void matrixPresenceService.setPresence('unavailable').catch((err) => {
      logger.warn('Set presence to unavailable failed:', err)
    })
  }
}
