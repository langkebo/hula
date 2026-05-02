import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const {
  mockDiscoverAndSaveMatrixEndpoints,
  mockResolveMatrixEndpointConfig,
  mockDiscoverOidc,
  mockGetAuthorizationUrl,
  mockSaveMatrixSessionEndpointConfig,
  mockInfo,
  mockWarn,
  mockError
} = vi.hoisted(() => ({
  mockDiscoverAndSaveMatrixEndpoints: vi.fn(),
  mockResolveMatrixEndpointConfig: vi.fn(),
  mockDiscoverOidc: vi.fn(),
  mockGetAuthorizationUrl: vi.fn(),
  mockSaveMatrixSessionEndpointConfig: vi.fn(),
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          'login.sso.title': '单点登录',
          'login.sso.oidc': 'OIDC 单点登录',
          'login.sso.saml': 'SAML 单点登录',
          'login.sso.cas': 'CAS 单点登录',
          'login.third_party.gitee': '使用 Gitee 登录',
          'login.third_party.github': '使用 GitHub 登录'
        }) as Record<string, string>
      )[key] || key
  })
}))

vi.mock('@/services/backend', () => ({
  discoverAndSaveMatrixEndpoints: mockDiscoverAndSaveMatrixEndpoints,
  resolveMatrixEndpointConfig: mockResolveMatrixEndpointConfig,
  saveMatrixSessionEndpointConfig: mockSaveMatrixSessionEndpointConfig
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: mockInfo,
    warn: mockWarn,
    error: mockError
  })
}))

vi.mock('@/hooks/useLoginFlow', () => ({
  useLoginFlow: () => ({
    loading: ref(false),
    loginDisabled: ref(false)
  })
}))

vi.mock('@/services/matrix/auth/MatrixOidcService', () => ({
  matrixOidcService: {
    discoverOidc: mockDiscoverOidc,
    getAuthorizationUrl: mockGetAuthorizationUrl
  }
}))

import ThirdPartyLogin from '../ThirdPartyLogin.vue'

describe('ThirdPartyLogin', () => {
  const mountComponent = () =>
    mount(ThirdPartyLogin, {
      props: {
        loginContext: {
          loading: ref(false),
          loginDisabled: ref(false),
          homeserverUrl: ref('example.com'),
          identityServerUrl: ref('')
        }
      },
      global: {
        stubs: {
          NTooltip: {
            template: '<div><slot name="trigger" /><slot /></div>'
          }
        }
      }
    })

  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveMatrixEndpointConfig.mockReturnValue({
      homeserverUrl: 'https://matrix.example.com',
      identityServerUrl: 'https://identity.example.com'
    })
    mockDiscoverAndSaveMatrixEndpoints.mockResolvedValue({
      homeserverUrl: 'https://resolved.example.com',
      identityServerUrl: 'https://identity.resolved.example.com',
      source: 'well_known',
      serverName: 'example.com'
    })
    mockDiscoverOidc.mockResolvedValue({
      issuer: 'https://issuer.example.com'
    })
    mockGetAuthorizationUrl.mockResolvedValue(null)
    window.$message = {
      error: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn()
    } as never
  })

  it('runs discovery before starting oidc login and syncs the resolved endpoints back to context', async () => {
    const homeserverUrl = ref('example.com')
    const identityServerUrl = ref('')

    const wrapper = mount(ThirdPartyLogin, {
      props: {
        loginContext: {
          loading: ref(false),
          loginDisabled: ref(false),
          homeserverUrl,
          identityServerUrl
        }
      },
      global: {
        stubs: {
          NTooltip: {
            template: '<div><slot name="trigger" /><slot /></div>'
          }
        }
      }
    })

    await wrapper.get('[aria-label="OIDC 单点登录"]').trigger('click')
    await flushPromises()

    expect(mockDiscoverAndSaveMatrixEndpoints).toHaveBeenCalledWith('example.com', {
      homeserverUrl: 'https://matrix.example.com',
      identityServerUrl: 'https://identity.example.com'
    })
    expect(mockSaveMatrixSessionEndpointConfig).toHaveBeenCalledWith({
      homeserverUrl: 'https://resolved.example.com',
      identityServerUrl: 'https://identity.resolved.example.com'
    })
    expect(mockDiscoverOidc).toHaveBeenCalledWith('https://resolved.example.com')
    expect(homeserverUrl.value).toBe('https://resolved.example.com')
    expect(identityServerUrl.value).toBe('https://identity.resolved.example.com')
  })

  it.each([
    {
      label: 'SAML 单点登录',
      expectedUrl: () =>
        `https://resolved.example.com/_matrix/client/r0/login/sso/redirect/saml?redirectUrl=${encodeURIComponent(
          `${window.location.origin}/login`
        )}`
    },
    {
      label: 'CAS 单点登录',
      expectedUrl: () =>
        `https://resolved.example.com/cas/login?service=${encodeURIComponent(`${window.location.origin}/login`)}`
    }
  ])('redirects $label to /login after discovery', async ({ label, expectedUrl }) => {
    const locationAssignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined)
    const wrapper = mountComponent()

    await wrapper.get(`[aria-label="${label}"]`).trigger('click')
    await flushPromises()

    expect(mockDiscoverAndSaveMatrixEndpoints).toHaveBeenCalledWith('example.com', {
      homeserverUrl: 'https://matrix.example.com',
      identityServerUrl: 'https://identity.example.com'
    })
    expect(mockSaveMatrixSessionEndpointConfig).toHaveBeenCalledWith({
      homeserverUrl: 'https://resolved.example.com',
      identityServerUrl: 'https://identity.resolved.example.com'
    })
    expect(locationAssignSpy).toHaveBeenCalledWith(expectedUrl())
  })
})
