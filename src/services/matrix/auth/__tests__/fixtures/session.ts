/**
 * 会话/认证域测试夹具。
 *
 * 结构真值全部来自服务层类型，不手抄：
 * - 登录/已存令牌：`sessionOrchestrator` 方法签名（`Awaited<ReturnType<...>>`）
 * - 注册/邮箱令牌/提交令牌：`MatrixAuthService` 导出的 DTO
 * - OIDC：`MatrixOidcService` 的 `OidcXxx` 接口
 *
 * 这些形状此前在测试里是手写的，且**与真实契约不一致**（`{ userId }`、`{ sid }`、
 * 缺 `client_secret` 等），夹具化后由 `vue-tsc` 兜底。
 */
import type {
  MatrixRegisterResult,
  MatrixRequestedEmailTokenResult,
  SubmitEmailTokenResponse
} from '@/services/matrix/auth/MatrixAuthService'
import type { OidcDiscoveryDocument, OidcTokenResponse, OidcUserInfo } from '@/services/matrix/auth/MatrixOidcService'
import type { sessionOrchestrator } from '@/services/matrix/auth/SessionOrchestrator'
import type { LoginResult as MatrixClientLoginResult } from '@/services/matrix/MatrixClientAuth'
import type { matrixClientService } from '@/services/matrix/MatrixClientService'

/** 密码 / SSO 登录结果：`{ uid, accessToken }` —— 不是 `{ userId }` */
type LoginResult = Awaited<ReturnType<typeof sessionOrchestrator.loginWithPassword>>
/** `matrixClientService.login()` 的 App 层登录结果 */
type ClientLoginResult = MatrixClientLoginResult
/** `matrixClientService.resolveIdentityByWhoami()` 的身份（`userId` / `deviceId` 均可缺省） */
type WhoamiIdentity = Awaited<ReturnType<typeof matrixClientService.resolveIdentityByWhoami>>
/** 已存会话令牌：`{ uid?, token, refreshToken? }` —— 不是 `{ accessToken }` */
type StoredTokens = Awaited<ReturnType<typeof sessionOrchestrator.getStoredTokens>>

/** 登录成功结果 */
export function makeLoginResult(uid: string, accessToken = 'access-token'): LoginResult {
  return { uid, accessToken }
}

/** 已存会话令牌（`getStoredTokens` 是异步的，mock 需 `mockResolvedValueOnce`） */
export function makeStoredTokens(
  uid: string | null,
  token: string | null,
  refreshToken: string | null = null
): StoredTokens {
  return { uid, token, refreshToken }
}

/** `matrixClientService.login()` 成功结果（App 层 DTO，不是 wire 的 `user_id`） */
export function makeClientLoginResult(overrides: Partial<ClientLoginResult> = {}): ClientLoginResult {
  return {
    success: true,
    userId: '@test:matrix.org',
    accessToken: 'token123',
    deviceId: 'device123',
    ...overrides
  }
}

/** `matrixClientService.resolveIdentityByWhoami()` 的身份 */
export function makeWhoamiIdentity(overrides: Partial<WhoamiIdentity> = {}): WhoamiIdentity {
  return { userId: '@whoami:matrix.test', ...overrides }
}

/** 注册成功（wire 结构：`user_id`） */
export function makeRegisterResult(userId: string): MatrixRegisterResult {
  return { user_id: userId }
}

/** 请求邮箱令牌成功（`client_secret` 为必填，不能只回 `{ sid }`） */
export function makeRequestedEmailToken(sid: string, clientSecret = 'client-secret'): MatrixRequestedEmailTokenResult {
  return { sid, client_secret: clientSecret }
}

/** 提交邮箱令牌成功 */
export const submitEmailTokenSuccessFixture: SubmitEmailTokenResponse = { success: true }

/** OIDC 发现文档：必填 7 项 */
export const oidcDiscoveryDocumentFixture: OidcDiscoveryDocument = {
  issuer: 'https://auth.server',
  authorization_endpoint: 'https://auth.server/auth',
  token_endpoint: 'https://auth.server/token',
  userinfo_endpoint: 'https://auth.server/userinfo',
  jwks_uri: 'https://auth.server/jwks',
  response_types_supported: ['code'],
  subject_types_supported: ['public']
}

/** OIDC 换码结果：`expires_in` 为必填 */
export const oidcTokenResponseFixture: OidcTokenResponse = {
  access_token: 'at',
  token_type: 'Bearer',
  expires_in: 3600
}

/** OIDC 用户信息 */
export const oidcUserInfoFixture: OidcUserInfo = { sub: 'user1', name: 'Alice' }
