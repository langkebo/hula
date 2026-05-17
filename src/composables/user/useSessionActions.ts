import type {
  MatrixCaptchaResult,
  MatrixLoginResult,
  MatrixRegisterResult,
  MatrixRequestedEmailTokenResult
} from '@/services/matrix/auth/MatrixAuthService'
import { MatrixAuthService } from '@/services/matrix/auth/MatrixAuthService'
import type {
  OidcAuthorizationUrlParams,
  OidcDiscoveryDocument,
  OidcTokenResponse,
  OidcUserInfo
} from '@/services/matrix/auth/MatrixOidcService'
import { matrixOidcService } from '@/services/matrix/auth/MatrixOidcService'
import { sessionOrchestrator } from '@/services/matrix/auth/SessionOrchestrator'

export type {
  MatrixCaptchaResult,
  MatrixLoginResult,
  MatrixRegisterResult,
  MatrixRequestedEmailTokenResult,
  OidcAuthorizationUrlParams,
  OidcDiscoveryDocument,
  OidcTokenResponse,
  OidcUserInfo
}

export function useSessionActions() {
  const loginWithPassword = (options: Parameters<typeof sessionOrchestrator.loginWithPassword>[0]) => {
    return sessionOrchestrator.loginWithPassword(options)
  }

  const loginWithSsoToken = (options: Parameters<typeof sessionOrchestrator.loginWithSsoToken>[0]) => {
    return sessionOrchestrator.loginWithSsoToken(options)
  }

  const restoreWithAccessToken = (options: Parameters<typeof sessionOrchestrator.restoreWithAccessToken>[0]) => {
    return sessionOrchestrator.restoreWithAccessToken(options)
  }

  const logoutCurrentSession = (options?: Parameters<typeof sessionOrchestrator.logoutCurrentSession>[0]) => {
    return sessionOrchestrator.logoutCurrentSession(options)
  }

  const completeDesktopLoginTransition = () => {
    return sessionOrchestrator.completeDesktopLoginTransition()
  }

  const applyDesktopLoginState = () => {
    return sessionOrchestrator.applyDesktopLoginState()
  }

  const bootstrapPostLoginState = (options: Parameters<typeof sessionOrchestrator.bootstrapPostLoginState>[0]) => {
    return sessionOrchestrator.bootstrapPostLoginState(options)
  }

  const getStoredTokens = () => {
    return sessionOrchestrator.getStoredTokens()
  }

  const hasAuthenticatedSession = () => {
    return sessionOrchestrator.hasAuthenticatedSession()
  }

  const resetLocalSessionState = (options?: Parameters<typeof sessionOrchestrator.resetLocalSessionState>[0]) => {
    return sessionOrchestrator.resetLocalSessionState(options)
  }

  const register = (
    username: string,
    password: string,
    session?: string,
    authType?: string,
    authToken?: string,
    clientSecret?: string
  ): Promise<MatrixRegisterResult> => {
    return MatrixAuthService.register(username, password, session, authType, authToken, clientSecret)
  }

  const requestEmailToken = (
    email: string,
    sendAttempt?: number,
    clientSecret?: string
  ): Promise<MatrixRequestedEmailTokenResult> => {
    return MatrixAuthService.requestEmailToken(email, sendAttempt, clientSecret)
  }

  const submitEmailToken = (
    token: string,
    clientSecret: string,
    sid: string,
    purpose?: 'register' | 'password_reset'
  ) => {
    return MatrixAuthService.submitEmailToken(token, clientSecret, sid, purpose)
  }

  const requestPasswordEmailToken = (
    email: string,
    sendAttempt?: number,
    clientSecret?: string
  ): Promise<MatrixRequestedEmailTokenResult> => {
    return MatrixAuthService.requestPasswordEmailToken(email, sendAttempt, clientSecret)
  }

  const resetPassword = (
    newPassword: string,
    authSession?: string,
    authType?: string,
    authToken?: string,
    clientSecret?: string
  ) => {
    return MatrixAuthService.resetPassword(newPassword, authSession, authType, authToken, clientSecret)
  }

  const getLoginFlows = () => {
    return MatrixAuthService.getLoginFlows()
  }

  const getRegisterFlows = () => {
    return MatrixAuthService.getRegisterFlows()
  }

  const isUsernameAvailable = (username: string) => {
    return MatrixAuthService.isUsernameAvailable(username)
  }

  const discoverOidc = (homeserverUrl: string): Promise<OidcDiscoveryDocument | null> => {
    return matrixOidcService.discoverOidc(homeserverUrl)
  }

  const getOidcAuthorizationUrl = (params: OidcAuthorizationUrlParams): Promise<string | null> => {
    return matrixOidcService.getAuthorizationUrl(params)
  }

  const handleOidcCallback = (code: string, state: string): Promise<OidcTokenResponse | null> => {
    return matrixOidcService.handleCallback(code, state)
  }

  const getOidcUserInfo = (): Promise<OidcUserInfo | null> => {
    return matrixOidcService.getUserInfo()
  }

  return {
    loginWithPassword,
    loginWithSsoToken,
    restoreWithAccessToken,
    logoutCurrentSession,
    completeDesktopLoginTransition,
    applyDesktopLoginState,
    bootstrapPostLoginState,
    getStoredTokens,
    hasAuthenticatedSession,
    resetLocalSessionState,
    register,
    requestEmailToken,
    submitEmailToken,
    requestPasswordEmailToken,
    resetPassword,
    getLoginFlows,
    getRegisterFlows,
    isUsernameAvailable,
    discoverOidc,
    getOidcAuthorizationUrl,
    handleOidcCallback,
    getOidcUserInfo
  }
}
