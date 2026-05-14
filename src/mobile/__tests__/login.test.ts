import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const { invokeMock, routerPushMock, loginWithSsoTokenMock, useMittEmitMock, useMittOnMock, loggerErrorMock } =
  vi.hoisted(() => ({
    invokeMock: vi.fn(),
    routerPushMock: vi.fn(),
    loginWithSsoTokenMock: vi.fn(),
    useMittEmitMock: vi.fn(),
    useMittOnMock: vi.fn(),
    loggerErrorMock: vi.fn()
  }))

class MockWorker {
  onerror: ((error: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null

  postMessage(): void {}

  terminate(): void {}
}

vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker)

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock
}))

vi.mock('@vueuse/core', () => ({
  useDebounceFn: (fn: (...args: unknown[]) => unknown) => fn
}))

const showFailToastMock = vi.fn()

vi.mock('vant', () => ({
  showFailToast: showFailToastMock
}))

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pinia')>()

  return {
    ...actual,
    storeToRefs: (store: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(store).map(([key, value]) => [key, ref(value)]))
  }
})

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()

  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) =>
        (
          ({
            'login.status.logging_in': '登录中...',
            'login.button.login.default': '登录'
          }) as Record<string, string>
        )[key] || key
    })
  }
})

vi.mock('@/router', () => ({
  default: {
    push: routerPushMock
  }
}))

vi.mock('@/enums', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/enums')>()

  return {
    ...actual,
    MittEnum: {
      ...actual.MittEnum,
      MSG_INIT: 'MSG_INIT'
    }
  }
})

vi.mock('@/services/matrix/auth/SessionOrchestrator', () => ({
  sessionOrchestrator: {
    loginWithSsoToken: loginWithSsoTokenMock
  }
}))

vi.mock('@/services/matrix/auth/MatrixAuthService', () => ({
  MatrixAuthService: {
    requestEmailToken: vi.fn(),
    submitEmailToken: vi.fn(),
    register: vi.fn()
  }
}))

vi.mock('@/stores/domains/settings/mobile', () => ({
  useMobileStore: () => ({
    safeArea: {
      bottom: 0
    }
  })
}))

vi.mock('@/stores/domains/user/loginHistory', () => ({
  useLoginHistoriesStore: () => ({
    loginHistories: []
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    autoLoginEnabled: false
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: vi.fn(() => '')
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isAndroid: () => false,
  isIOS: () => false
}))

vi.mock('@/utils/Validate', () => ({
  validateAlphaNumeric: vi.fn(() => true),
  validateSpecialChar: vi.fn(() => true)
}))

const mobileLoadingRef = ref(false)
const mobileLoginTextRef = ref('登录')
const mobileLoginDisabledRef = ref(false)

vi.mock('../../hooks/useLoginFlow', () => ({
  useLoginFlow: () => ({
    normalLogin: vi.fn(),
    loading: mobileLoadingRef,
    loginText: mobileLoginTextRef,
    loginDisabled: mobileLoginDisabledRef,
    info: ref({
      account: '',
      password: '',
      avatar: '',
      name: '',
      uid: ''
    })
  })
}))

vi.mock('../../hooks/useMitt', () => ({
  useMitt: {
    emit: useMittEmitMock,
    on: useMittOnMock
  }
}))

const MobileLogin = (await import('../login.vue')).default

describe('mobile login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    history.replaceState({}, '', '/mobile/login?loginToken=mobile-sso-token')
    invokeMock.mockResolvedValue(undefined)
    loginWithSsoTokenMock.mockResolvedValue(undefined)
    routerPushMock.mockResolvedValue(undefined)
    mobileLoadingRef.value = false
    mobileLoginTextRef.value = '登录'
    mobileLoginDisabledRef.value = false
  })

  it('consumes loginToken callback and completes mobile sso login on mount', async () => {
    shallowMount(MobileLogin, {
      global: {
        stubs: {
          MobileLayout: {
            template: '<div><slot /></div>'
          },
          Validation: true,
          'van-field': true,
          'van-button': true,
          'van-checkbox': true
        }
      }
    })

    await flushPromises()

    expect(invokeMock).toHaveBeenCalledWith('hide_splash_screen', undefined)
    expect(loginWithSsoTokenMock).toHaveBeenCalledWith({
      loginToken: 'mobile-sso-token',
      client: 'MOBILE'
    })
    expect(useMittEmitMock).toHaveBeenCalledWith('MSG_INIT')
    expect(routerPushMock).toHaveBeenCalledWith('/mobile/home')
    expect(window.location.pathname).toBe('/mobile/login')
    expect(window.location.search).toBe('')
  })

  it('restores login state and shows toast when mobile sso callback fails', async () => {
    loginWithSsoTokenMock.mockRejectedValue(new Error('boom'))

    shallowMount(MobileLogin, {
      global: {
        stubs: {
          MobileLayout: {
            template: '<div><slot /></div>'
          },
          Validation: true,
          'van-field': true,
          'van-button': true,
          'van-checkbox': true
        }
      }
    })

    await flushPromises()

    expect(loginWithSsoTokenMock).toHaveBeenCalledWith({
      loginToken: 'mobile-sso-token',
      client: 'MOBILE'
    })
    expect(routerPushMock).not.toHaveBeenCalled()
    expect(showFailToastMock).toHaveBeenCalledWith('SSO 登录失败')
    expect(mobileLoadingRef.value).toBe(false)
    expect(mobileLoginDisabledRef.value).toBe(false)
    expect(mobileLoginTextRef.value).toBe('登录')
    expect(window.location.search).toBe('?loginToken=mobile-sso-token')
  })
})
