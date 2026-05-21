import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLoginWithPassword,
  mockLoginWithSsoToken,
  mockRestoreWithAccessToken,
  mockLogoutCurrentSession,
  mockCompleteDesktopLoginTransition,
  mockApplyDesktopLoginState,
  mockBootstrapPostLoginState,
  mockGetStoredTokens,
  mockHasAuthenticatedSession,
  mockResetLocalSessionState,
  mockRegister,
  mockRequestEmailToken,
  mockSubmitEmailToken,
  mockRequestPasswordEmailToken,
  mockResetPassword,
  mockGetLoginFlows,
  mockGetRegisterFlows,
  mockIsUsernameAvailable,
  mockDiscoverOidc,
  mockGetOidcAuthorizationUrl,
  mockHandleOidcCallback,
  mockGetOidcUserInfo
} = vi.hoisted(() => ({
  mockLoginWithPassword: vi.fn(),
  mockLoginWithSsoToken: vi.fn(),
  mockRestoreWithAccessToken: vi.fn(),
  mockLogoutCurrentSession: vi.fn(),
  mockCompleteDesktopLoginTransition: vi.fn(),
  mockApplyDesktopLoginState: vi.fn(),
  mockBootstrapPostLoginState: vi.fn(),
  mockGetStoredTokens: vi.fn(),
  mockHasAuthenticatedSession: vi.fn(),
  mockResetLocalSessionState: vi.fn(),
  mockRegister: vi.fn(),
  mockRequestEmailToken: vi.fn(),
  mockSubmitEmailToken: vi.fn(),
  mockRequestPasswordEmailToken: vi.fn(),
  mockResetPassword: vi.fn(),
  mockGetLoginFlows: vi.fn(),
  mockGetRegisterFlows: vi.fn(),
  mockIsUsernameAvailable: vi.fn(),
  mockDiscoverOidc: vi.fn(),
  mockGetOidcAuthorizationUrl: vi.fn(),
  mockHandleOidcCallback: vi.fn(),
  mockGetOidcUserInfo: vi.fn()
}))

vi.mock('@/services/matrix/auth/SessionOrchestrator', () => ({
  sessionOrchestrator: {
    loginWithPassword: mockLoginWithPassword,
    loginWithSsoToken: mockLoginWithSsoToken,
    restoreWithAccessToken: mockRestoreWithAccessToken,
    logoutCurrentSession: mockLogoutCurrentSession,
    completeDesktopLoginTransition: mockCompleteDesktopLoginTransition,
    applyDesktopLoginState: mockApplyDesktopLoginState,
    bootstrapPostLoginState: mockBootstrapPostLoginState,
    getStoredTokens: mockGetStoredTokens,
    hasAuthenticatedSession: mockHasAuthenticatedSession,
    resetLocalSessionState: mockResetLocalSessionState
  }
}))

vi.mock('@/services/matrix/auth/MatrixAuthService', () => ({
  MatrixAuthService: {
    register: mockRegister,
    requestEmailToken: mockRequestEmailToken,
    submitEmailToken: mockSubmitEmailToken,
    requestPasswordEmailToken: mockRequestPasswordEmailToken,
    resetPassword: mockResetPassword,
    getLoginFlows: mockGetLoginFlows,
    getRegisterFlows: mockGetRegisterFlows,
    isUsernameAvailable: mockIsUsernameAvailable
  }
}))

vi.mock('@/services/matrix/auth/MatrixOidcService', () => ({
  matrixOidcService: {
    discoverOidc: mockDiscoverOidc,
    getAuthorizationUrl: mockGetOidcAuthorizationUrl,
    handleCallback: mockHandleOidcCallback,
    getUserInfo: mockGetOidcUserInfo
  }
}))

import { useSessionActions } from '../useSessionActions'

describe('useSessionActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // sessionOrchestrator 委托方法
  // ============================================================================

  describe('loginWithPassword', () => {
    it('delegates to sessionOrchestrator.loginWithPassword', async () => {
      mockLoginWithPassword.mockResolvedValueOnce({ userId: '@alice:server' })
      const { loginWithPassword } = useSessionActions()
      const options = { username: 'alice', password: 'pass123', homeserverUrl: 'https://matrix.example.com' }
      const result = await loginWithPassword(options)
      expect(mockLoginWithPassword).toHaveBeenCalledWith(options)
      expect(result).toEqual({ userId: '@alice:server' })
    })

    it('propagates error', async () => {
      mockLoginWithPassword.mockRejectedValueOnce(new Error('invalid password'))
      const { loginWithPassword } = useSessionActions()
      await expect(
        loginWithPassword({ username: 'alice', password: 'wrong', homeserverUrl: 'https://matrix.example.com' })
      ).rejects.toThrow('invalid password')
    })
  })

  describe('loginWithSsoToken', () => {
    it('delegates to sessionOrchestrator.loginWithSsoToken', async () => {
      mockLoginWithSsoToken.mockResolvedValueOnce({ userId: '@bob:server' })
      const { loginWithSsoToken } = useSessionActions()
      const options = { loginToken: 'token123' }
      const result = await loginWithSsoToken(options)
      expect(mockLoginWithSsoToken).toHaveBeenCalledWith(options)
      expect(result).toEqual({ userId: '@bob:server' })
    })

    it('propagates error', async () => {
      mockLoginWithSsoToken.mockRejectedValueOnce(new Error('sso failed'))
      const { loginWithSsoToken } = useSessionActions()
      await expect(loginWithSsoToken({ loginToken: 'bad' })).rejects.toThrow('sso failed')
    })
  })

  describe('restoreWithAccessToken', () => {
    it('delegates to sessionOrchestrator.restoreWithAccessToken', async () => {
      mockRestoreWithAccessToken.mockResolvedValueOnce(undefined)
      const { restoreWithAccessToken } = useSessionActions()
      const options = { accessToken: 'at123', uid: '@alice:server' }
      await restoreWithAccessToken(options)
      expect(mockRestoreWithAccessToken).toHaveBeenCalledWith(options)
    })
  })

  describe('logoutCurrentSession', () => {
    it('delegates without options', async () => {
      mockLogoutCurrentSession.mockResolvedValueOnce(undefined)
      const { logoutCurrentSession } = useSessionActions()
      await logoutCurrentSession()
      expect(mockLogoutCurrentSession).toHaveBeenCalledWith(undefined)
    })

    it('delegates with options', async () => {
      mockLogoutCurrentSession.mockResolvedValueOnce(undefined)
      const { logoutCurrentSession } = useSessionActions()
      const options = { resetLocalState: true }
      await logoutCurrentSession(options)
      expect(mockLogoutCurrentSession).toHaveBeenCalledWith(options)
    })

    it('propagates error', async () => {
      mockLogoutCurrentSession.mockRejectedValueOnce(new Error('logout failed'))
      const { logoutCurrentSession } = useSessionActions()
      await expect(logoutCurrentSession()).rejects.toThrow('logout failed')
    })
  })

  describe('completeDesktopLoginTransition', () => {
    it('delegates to sessionOrchestrator.completeDesktopLoginTransition', async () => {
      mockCompleteDesktopLoginTransition.mockResolvedValueOnce(undefined)
      const { completeDesktopLoginTransition } = useSessionActions()
      await completeDesktopLoginTransition()
      expect(mockCompleteDesktopLoginTransition).toHaveBeenCalled()
    })
  })

  describe('applyDesktopLoginState', () => {
    it('delegates to sessionOrchestrator.applyDesktopLoginState', async () => {
      mockApplyDesktopLoginState.mockResolvedValueOnce(undefined)
      const { applyDesktopLoginState } = useSessionActions()
      await applyDesktopLoginState()
      expect(mockApplyDesktopLoginState).toHaveBeenCalled()
    })
  })

  describe('bootstrapPostLoginState', () => {
    it('delegates to sessionOrchestrator.bootstrapPostLoginState', async () => {
      mockBootstrapPostLoginState.mockResolvedValueOnce(undefined)
      const { bootstrapPostLoginState } = useSessionActions()
      const options = { displayName: 'Alice' }
      await bootstrapPostLoginState(options)
      expect(mockBootstrapPostLoginState).toHaveBeenCalledWith(options)
    })
  })

  describe('getStoredTokens', () => {
    it('delegates to sessionOrchestrator.getStoredTokens', () => {
      const tokens = { accessToken: 'at', refreshToken: 'rt' }
      mockGetStoredTokens.mockReturnValueOnce(tokens)
      const { getStoredTokens } = useSessionActions()
      const result = getStoredTokens()
      expect(mockGetStoredTokens).toHaveBeenCalled()
      expect(result).toEqual(tokens)
    })
  })

  describe('hasAuthenticatedSession', () => {
    it('returns true when authenticated', () => {
      mockHasAuthenticatedSession.mockReturnValueOnce(true)
      const { hasAuthenticatedSession } = useSessionActions()
      expect(hasAuthenticatedSession()).toBe(true)
    })

    it('returns false when not authenticated', () => {
      mockHasAuthenticatedSession.mockReturnValueOnce(false)
      const { hasAuthenticatedSession } = useSessionActions()
      expect(hasAuthenticatedSession()).toBe(false)
    })
  })

  describe('resetLocalSessionState', () => {
    it('delegates without options', async () => {
      mockResetLocalSessionState.mockResolvedValueOnce(undefined)
      const { resetLocalSessionState } = useSessionActions()
      await resetLocalSessionState()
      expect(mockResetLocalSessionState).toHaveBeenCalledWith(undefined)
    })

    it('delegates with options', async () => {
      mockResetLocalSessionState.mockResolvedValueOnce(undefined)
      const { resetLocalSessionState } = useSessionActions()
      const options = { preserveTokens: true }
      await resetLocalSessionState(options)
      expect(mockResetLocalSessionState).toHaveBeenCalledWith(options)
    })
  })

  // ============================================================================
  // MatrixAuthService 委托方法
  // ============================================================================

  describe('register', () => {
    it('delegates with all parameters', async () => {
      mockRegister.mockResolvedValueOnce({ userId: '@new:server' })
      const { register } = useSessionActions()
      const result = await register('newuser', 'pass123', 'sess1', 'm.login.email', 'token1', 'secret1')
      expect(mockRegister).toHaveBeenCalledWith('newuser', 'pass123', 'sess1', 'm.login.email', 'token1', 'secret1')
      expect(result).toEqual({ userId: '@new:server' })
    })

    it('delegates with required parameters only', async () => {
      mockRegister.mockResolvedValueOnce({ userId: '@new:server' })
      const { register } = useSessionActions()
      await register('newuser', 'pass123')
      expect(mockRegister).toHaveBeenCalledWith('newuser', 'pass123', undefined, undefined, undefined, undefined)
    })

    it('propagates error', async () => {
      mockRegister.mockRejectedValueOnce(new Error('username taken'))
      const { register } = useSessionActions()
      await expect(register('taken', 'pass')).rejects.toThrow('username taken')
    })
  })

  describe('requestEmailToken', () => {
    it('delegates with all parameters', async () => {
      mockRequestEmailToken.mockResolvedValueOnce({ sid: 'sid1' })
      const { requestEmailToken } = useSessionActions()
      const result = await requestEmailToken('a@b.c', 1, 'secret1')
      expect(mockRequestEmailToken).toHaveBeenCalledWith('a@b.c', 1, 'secret1')
      expect(result).toEqual({ sid: 'sid1' })
    })

    it('delegates with email only', async () => {
      mockRequestEmailToken.mockResolvedValueOnce({ sid: 'sid2' })
      const { requestEmailToken } = useSessionActions()
      await requestEmailToken('a@b.c')
      expect(mockRequestEmailToken).toHaveBeenCalledWith('a@b.c', undefined, undefined)
    })

    it('propagates error', async () => {
      mockRequestEmailToken.mockRejectedValueOnce(new Error('email token failed'))
      const { requestEmailToken } = useSessionActions()
      await expect(requestEmailToken('bad@email')).rejects.toThrow('email token failed')
    })
  })

  describe('submitEmailToken', () => {
    it('delegates with purpose parameter', async () => {
      mockSubmitEmailToken.mockResolvedValueOnce({ success: true })
      const { submitEmailToken } = useSessionActions()
      await submitEmailToken('tok1', 'secret1', 'sid1', 'register')
      expect(mockSubmitEmailToken).toHaveBeenCalledWith('tok1', 'secret1', 'sid1', 'register')
    })

    it('delegates without purpose parameter', async () => {
      mockSubmitEmailToken.mockResolvedValueOnce({ success: true })
      const { submitEmailToken } = useSessionActions()
      await submitEmailToken('tok1', 'secret1', 'sid1')
      expect(mockSubmitEmailToken).toHaveBeenCalledWith('tok1', 'secret1', 'sid1', undefined)
    })

    it('delegates with password_reset purpose', async () => {
      mockSubmitEmailToken.mockResolvedValueOnce({ success: true })
      const { submitEmailToken } = useSessionActions()
      await submitEmailToken('tok2', 'secret2', 'sid2', 'password_reset')
      expect(mockSubmitEmailToken).toHaveBeenCalledWith('tok2', 'secret2', 'sid2', 'password_reset')
    })

    it('propagates error', async () => {
      mockSubmitEmailToken.mockRejectedValueOnce(new Error('token invalid'))
      const { submitEmailToken } = useSessionActions()
      await expect(submitEmailToken('bad', 's', 'sid')).rejects.toThrow('token invalid')
    })
  })

  describe('requestPasswordEmailToken', () => {
    it('delegates with all parameters', async () => {
      mockRequestPasswordEmailToken.mockResolvedValueOnce({ sid: 'sid3' })
      const { requestPasswordEmailToken } = useSessionActions()
      const result = await requestPasswordEmailToken('a@b.c', 2, 'secret2')
      expect(mockRequestPasswordEmailToken).toHaveBeenCalledWith('a@b.c', 2, 'secret2')
      expect(result).toEqual({ sid: 'sid3' })
    })

    it('delegates with email only', async () => {
      mockRequestPasswordEmailToken.mockResolvedValueOnce({ sid: 'sid4' })
      const { requestPasswordEmailToken } = useSessionActions()
      await requestPasswordEmailToken('a@b.c')
      expect(mockRequestPasswordEmailToken).toHaveBeenCalledWith('a@b.c', undefined, undefined)
    })
  })

  describe('resetPassword', () => {
    it('delegates with all parameters', async () => {
      mockResetPassword.mockResolvedValueOnce(undefined)
      const { resetPassword } = useSessionActions()
      await resetPassword('newPass123', 'sess1', 'm.login.email', 'token1', 'secret1')
      expect(mockResetPassword).toHaveBeenCalledWith('newPass123', 'sess1', 'm.login.email', 'token1', 'secret1')
    })

    it('delegates with required parameters only', async () => {
      mockResetPassword.mockResolvedValueOnce(undefined)
      const { resetPassword } = useSessionActions()
      await resetPassword('newPass123')
      expect(mockResetPassword).toHaveBeenCalledWith('newPass123', undefined, undefined, undefined, undefined)
    })

    it('propagates error', async () => {
      mockResetPassword.mockRejectedValueOnce(new Error('reset failed'))
      const { resetPassword } = useSessionActions()
      await expect(resetPassword('bad')).rejects.toThrow('reset failed')
    })
  })

  describe('getLoginFlows', () => {
    it('delegates to MatrixAuthService.getLoginFlows', async () => {
      const flows = [{ type: 'm.login.password' }, { type: 'm.login.sso' }]
      mockGetLoginFlows.mockResolvedValueOnce(flows)
      const { getLoginFlows } = useSessionActions()
      const result = await getLoginFlows()
      expect(mockGetLoginFlows).toHaveBeenCalled()
      expect(result).toEqual(flows)
    })

    it('propagates error', async () => {
      mockGetLoginFlows.mockRejectedValueOnce(new Error('flows fetch failed'))
      const { getLoginFlows } = useSessionActions()
      await expect(getLoginFlows()).rejects.toThrow('flows fetch failed')
    })
  })

  describe('getRegisterFlows', () => {
    it('delegates to MatrixAuthService.getRegisterFlows', async () => {
      const flows = [{ stages: ['m.login.email'] }]
      mockGetRegisterFlows.mockResolvedValueOnce(flows)
      const { getRegisterFlows } = useSessionActions()
      const result = await getRegisterFlows()
      expect(mockGetRegisterFlows).toHaveBeenCalled()
      expect(result).toEqual(flows)
    })
  })

  describe('isUsernameAvailable', () => {
    it('delegates to MatrixAuthService.isUsernameAvailable', async () => {
      mockIsUsernameAvailable.mockResolvedValueOnce(true)
      const { isUsernameAvailable } = useSessionActions()
      const result = await isUsernameAvailable('alice')
      expect(mockIsUsernameAvailable).toHaveBeenCalledWith('alice')
      expect(result).toBe(true)
    })

    it('returns false when username is taken', async () => {
      mockIsUsernameAvailable.mockResolvedValueOnce(false)
      const { isUsernameAvailable } = useSessionActions()
      const result = await isUsernameAvailable('taken')
      expect(result).toBe(false)
    })

    it('propagates error', async () => {
      mockIsUsernameAvailable.mockRejectedValueOnce(new Error('check failed'))
      const { isUsernameAvailable } = useSessionActions()
      await expect(isUsernameAvailable('alice')).rejects.toThrow('check failed')
    })
  })

  // ============================================================================
  // matrixOidcService 委托方法
  // ============================================================================

  describe('discoverOidc', () => {
    it('delegates to matrixOidcService.discoverOidc', async () => {
      const doc = { issuer: 'https://auth.server', authorization_endpoint: 'https://auth.server/auth' }
      mockDiscoverOidc.mockResolvedValueOnce(doc)
      const { discoverOidc } = useSessionActions()
      const result = await discoverOidc('https://server')
      expect(mockDiscoverOidc).toHaveBeenCalledWith('https://server')
      expect(result).toEqual(doc)
    })

    it('returns null when OIDC not supported', async () => {
      mockDiscoverOidc.mockResolvedValueOnce(null)
      const { discoverOidc } = useSessionActions()
      const result = await discoverOidc('https://no-oidc.server')
      expect(result).toBeNull()
    })

    it('propagates error', async () => {
      mockDiscoverOidc.mockRejectedValueOnce(new Error('discovery failed'))
      const { discoverOidc } = useSessionActions()
      await expect(discoverOidc('https://bad')).rejects.toThrow('discovery failed')
    })
  })

  describe('getOidcAuthorizationUrl', () => {
    it('delegates to matrixOidcService.getAuthorizationUrl', async () => {
      mockGetOidcAuthorizationUrl.mockResolvedValueOnce('https://auth.server/auth?code=abc')
      const { getOidcAuthorizationUrl } = useSessionActions()
      const params = { redirectUri: 'https://app/callback', scope: 'openid' }
      const result = await getOidcAuthorizationUrl(params)
      expect(mockGetOidcAuthorizationUrl).toHaveBeenCalledWith(params)
      expect(result).toBe('https://auth.server/auth?code=abc')
    })

    it('returns null when URL cannot be generated', async () => {
      mockGetOidcAuthorizationUrl.mockResolvedValueOnce(null)
      const { getOidcAuthorizationUrl } = useSessionActions()
      const result = await getOidcAuthorizationUrl({ redirectUri: 'https://app/callback' })
      expect(result).toBeNull()
    })
  })

  describe('handleOidcCallback', () => {
    it('delegates to matrixOidcService.handleCallback', async () => {
      const tokenResponse = { access_token: 'at', token_type: 'Bearer' }
      mockHandleOidcCallback.mockResolvedValueOnce(tokenResponse)
      const { handleOidcCallback } = useSessionActions()
      const result = await handleOidcCallback('auth-code', 'state123')
      expect(mockHandleOidcCallback).toHaveBeenCalledWith('auth-code', 'state123')
      expect(result).toEqual(tokenResponse)
    })

    it('returns null on failure', async () => {
      mockHandleOidcCallback.mockResolvedValueOnce(null)
      const { handleOidcCallback } = useSessionActions()
      const result = await handleOidcCallback('bad-code', 'bad-state')
      expect(result).toBeNull()
    })

    it('propagates error', async () => {
      mockHandleOidcCallback.mockRejectedValueOnce(new Error('callback failed'))
      const { handleOidcCallback } = useSessionActions()
      await expect(handleOidcCallback('code', 'state')).rejects.toThrow('callback failed')
    })
  })

  describe('getOidcUserInfo', () => {
    it('delegates to matrixOidcService.getUserInfo', async () => {
      const userInfo = { sub: 'user1', name: 'Alice' }
      mockGetOidcUserInfo.mockResolvedValueOnce(userInfo)
      const { getOidcUserInfo } = useSessionActions()
      const result = await getOidcUserInfo()
      expect(mockGetOidcUserInfo).toHaveBeenCalled()
      expect(result).toEqual(userInfo)
    })

    it('returns null when not available', async () => {
      mockGetOidcUserInfo.mockResolvedValueOnce(null)
      const { getOidcUserInfo } = useSessionActions()
      const result = await getOidcUserInfo()
      expect(result).toBeNull()
    })
  })

  // ============================================================================
  // 错误传播 - 额外路径
  // ============================================================================

  describe('error propagation - additional paths', () => {
    it('restoreWithAccessToken propagates error', async () => {
      mockRestoreWithAccessToken.mockRejectedValueOnce(new Error('restore failed'))
      const { restoreWithAccessToken } = useSessionActions()
      await expect(restoreWithAccessToken({ accessToken: 'bad', uid: '@a:s' })).rejects.toThrow('restore failed')
    })

    it('completeDesktopLoginTransition propagates error', async () => {
      mockCompleteDesktopLoginTransition.mockRejectedValueOnce(new Error('transition failed'))
      const { completeDesktopLoginTransition } = useSessionActions()
      await expect(completeDesktopLoginTransition()).rejects.toThrow('transition failed')
    })

    it('applyDesktopLoginState propagates error', async () => {
      mockApplyDesktopLoginState.mockRejectedValueOnce(new Error('apply state failed'))
      const { applyDesktopLoginState } = useSessionActions()
      await expect(applyDesktopLoginState()).rejects.toThrow('apply state failed')
    })

    it('bootstrapPostLoginState propagates error', async () => {
      mockBootstrapPostLoginState.mockRejectedValueOnce(new Error('bootstrap failed'))
      const { bootstrapPostLoginState } = useSessionActions()
      await expect(bootstrapPostLoginState({ displayName: 'Alice' })).rejects.toThrow('bootstrap failed')
    })

    it('resetLocalSessionState propagates error', async () => {
      mockResetLocalSessionState.mockRejectedValueOnce(new Error('reset failed'))
      const { resetLocalSessionState } = useSessionActions()
      await expect(resetLocalSessionState()).rejects.toThrow('reset failed')
    })

    it('requestPasswordEmailToken propagates error', async () => {
      mockRequestPasswordEmailToken.mockRejectedValueOnce(new Error('password email token failed'))
      const { requestPasswordEmailToken } = useSessionActions()
      await expect(requestPasswordEmailToken('a@b.c')).rejects.toThrow('password email token failed')
    })

    it('getRegisterFlows propagates error', async () => {
      mockGetRegisterFlows.mockRejectedValueOnce(new Error('register flows failed'))
      const { getRegisterFlows } = useSessionActions()
      await expect(getRegisterFlows()).rejects.toThrow('register flows failed')
    })

    it('getOidcAuthorizationUrl propagates error', async () => {
      mockGetOidcAuthorizationUrl.mockRejectedValueOnce(new Error('auth url failed'))
      const { getOidcAuthorizationUrl } = useSessionActions()
      await expect(getOidcAuthorizationUrl({ redirectUri: 'https://app/callback' })).rejects.toThrow('auth url failed')
    })

    it('getOidcUserInfo propagates error', async () => {
      mockGetOidcUserInfo.mockRejectedValueOnce(new Error('user info failed'))
      const { getOidcUserInfo } = useSessionActions()
      await expect(getOidcUserInfo()).rejects.toThrow('user info failed')
    })
  })
})
