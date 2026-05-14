import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  routerPushMock,
  messageSuccessMock,
  handleCallbackMock,
  exchangeOidcForMatrixTokenMock,
  restoreWithAccessTokenMock,
  applyDesktopLoginStateMock,
  loggerErrorMock,
  loggerDebugMock,
  saveMatrixSessionEndpointConfigMock,
  resolveMatrixEndpointConfigMock
} = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
  messageSuccessMock: vi.fn(),
  handleCallbackMock: vi.fn(),
  exchangeOidcForMatrixTokenMock: vi.fn(),
  restoreWithAccessTokenMock: vi.fn(),
  applyDesktopLoginStateMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  loggerDebugMock: vi.fn(),
  saveMatrixSessionEndpointConfigMock: vi.fn(),
  resolveMatrixEndpointConfigMock: vi.fn()
}))

vi.mock('naive-ui', () => ({
  NButton: {
    name: 'NButton',
    emits: ['click'],
    template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
  },
  NResult: {
    name: 'NResult',
    props: ['status', 'title', 'description'],
    template:
      '<div class="n-result"><div class="title">{{ title }}</div><div class="description">{{ description }}</div><slot name="footer" /></div>'
  },
  NSpace: {
    name: 'NSpace',
    template: '<div class="n-space"><slot /></div>'
  },
  NSpin: {
    name: 'NSpin',
    template: '<div class="n-spin">loading</div>'
  },
  useMessage: () => ({
    success: messageSuccessMock
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          'login.oidc.processing': '正在处理登录',
          'login.oidc.success_title': '登录成功',
          'login.oidc.login_success': 'OIDC 登录成功'
        }) as Record<string, string>
      )[key] || key
  })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPushMock
  })
}))

vi.mock('@/services/backend/config', () => ({
  saveMatrixSessionEndpointConfig: saveMatrixSessionEndpointConfigMock,
  resolveMatrixEndpointConfig: resolveMatrixEndpointConfigMock
}))

vi.mock('@/services/matrix/auth/MatrixOidcService', () => ({
  matrixOidcService: {
    handleCallback: handleCallbackMock,
    exchangeOidcForMatrixToken: exchangeOidcForMatrixTokenMock,
    getHomeserverUrl: vi.fn(() => 'https://hs.example.com')
  }
}))

vi.mock('@/services/matrix/auth/SessionOrchestrator', () => ({
  sessionOrchestrator: {
    restoreWithAccessToken: restoreWithAccessTokenMock,
    applyDesktopLoginState: applyDesktopLoginStateMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock,
    debug: loggerDebugMock,
    info: vi.fn(),
    warn: vi.fn()
  })
}))

import OidcCallback from '../OidcCallback.vue'

describe('OidcCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    resolveMatrixEndpointConfigMock.mockReturnValue({
      homeserverUrl: 'https://matrix.example.com',
      identityServerUrl: 'https://identity.example.com'
    })

    history.replaceState({}, '', '/oidc/callback?code=oidc-code&state=oidc-state')

    handleCallbackMock.mockResolvedValue({
      access_token: 'oidc-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'oidc-refresh-token'
    })
    exchangeOidcForMatrixTokenMock.mockResolvedValue({
      user_id: '@alice:example.com',
      access_token: 'matrix-access-token',
      device_id: 'DEVICE123',
      refresh_token: 'matrix-refresh-token'
    })
    restoreWithAccessTokenMock.mockResolvedValue(undefined)
    applyDesktopLoginStateMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    history.replaceState({}, '', '/')
    vi.useRealTimers()
  })

  it('restores matrix session and redirects home after a successful oidc callback', async () => {
    const wrapper = mount(OidcCallback)

    await flushPromises()

    expect(handleCallbackMock).toHaveBeenCalledWith('oidc-code', 'oidc-state')
    expect(exchangeOidcForMatrixTokenMock).toHaveBeenCalledWith('oidc-access-token', 'oidc-refresh-token')
    expect(saveMatrixSessionEndpointConfigMock).toHaveBeenCalledWith({
      homeserverUrl: 'https://hs.example.com',
      identityServerUrl: 'https://identity.example.com'
    })
    expect(restoreWithAccessTokenMock).toHaveBeenCalledWith({
      uid: '@alice:example.com',
      accessToken: 'matrix-access-token',
      refreshToken: 'matrix-refresh-token',
      persistTokens: true,
      client: 'PC',
      bootstrapAfterRestore: true
    })
    expect(applyDesktopLoginStateMock).toHaveBeenCalled()
    expect(messageSuccessMock).toHaveBeenCalledWith('OIDC 登录成功')
    expect(wrapper.text()).toContain('登录成功')

    vi.advanceTimersByTime(1500)

    expect(routerPushMock).toHaveBeenCalledWith('/home')
  })
})
