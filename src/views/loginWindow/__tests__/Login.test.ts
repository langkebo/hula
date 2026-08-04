import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const {
  currentWindowShowMock,
  routerPushMock,
  normalLoginMock,
  loginWithSsoTokenMock,
  completeDesktopLoginTransitionMock,
  getWindowPayloadMock,
  loggerErrorMock,
  showFeedbackMock,
  loginLoadingRef,
  loginTextRef,
  loginDisabledRef
} = vi.hoisted(() => ({
  currentWindowShowMock: vi.fn(),
  routerPushMock: vi.fn(),
  normalLoginMock: vi.fn(),
  loginWithSsoTokenMock: vi.fn(),
  completeDesktopLoginTransitionMock: vi.fn(),
  getWindowPayloadMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  loginLoadingRef: { value: false },
  loginTextRef: { value: '登录' },
  loginDisabledRef: { value: false }
}))

class MockWorker {
  onerror: ((error: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null

  postMessage(): void {}

  terminate(): void {}
}

vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker)

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({
    label: 'login',
    show: currentWindowShowMock
  })
}))

vi.mock('@vueuse/core', () => ({
  useNetwork: () => ({
    isOnline: ref(true)
  })
}))

vi.mock('pinia', () => ({
  storeToRefs: (store: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(store).map(([key, value]) => [key, ref(value)]))
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          'login.status.logging_in': '登录中...',
          'login.button.login.default': '登录',
          'login.button.login.network_error': '网络异常',
          'login.button.qr_code': '扫码登录',
          'login.option.more': '更多选项',
          'login.button.remove_account': '移除账号',
          'login.button.cancel_login': '取消登录',
          'login.input.account.placeholder': '邮箱/Tjg账号',
          'login.input.pass.placeholder': '输入 Tjg 密码'
        }) as Record<string, string>
      )[key] || key
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('naive-ui', () => {
  const stub = (name: string) => ({
    name,
    template: '<div><slot /><slot name="trigger" /><slot name="suffix" /><slot name="footer" /></div>'
  })

  return {
    darkTheme: { name: 'dark' },
    lightTheme: { name: 'light' },
    NConfigProvider: stub('NConfigProvider'),
    NFlex: stub('NFlex'),
    NAvatar: stub('NAvatar'),
    NInput: stub('NInput'),
    NCheckbox: stub('NCheckbox'),
    NButton: stub('NButton'),
    NScrollbar: stub('NScrollbar'),
    NPopover: stub('NPopover'),
    NModal: stub('NModal'),
    NFormItem: stub('NFormItem'),
    NAlert: stub('NAlert'),
    NEllipsis: stub('NEllipsis')
  }
})

vi.mock('@/composables/common/useCheckUpdate', () => ({
  useCheckUpdate: () => ({
    checkUpdate: vi.fn(),
    CHECK_UPDATE_LOGIN_TIME: 60000
  })
}))

vi.mock('@/composables/common/useDriver', () => ({
  useDriver: () => ({
    startTour: vi.fn(),
    reinitialize: vi.fn()
  })
}))

vi.mock('@/composables/user/useLoginFlow', () => ({
  useLoginFlow: () => ({
    normalLogin: normalLoginMock,
    loading: loginLoadingRef,
    loginText: loginTextRef,
    loginDisabled: loginDisabledRef,
    info: ref({
      account: '',
      password: '',
      avatar: '',
      name: '',
      uid: ''
    }),
    uiState: ref<'manual' | 'auto'>('manual'),
    homeserverUrl: ref('https://matrix.example.com'),
    identityServerUrl: ref('https://identity.example.com')
  })
}))

vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({
    createWebviewWindow: vi.fn(),
    createModalWindow: vi.fn(),
    getWindowPayload: getWindowPayloadMock
  })
}))

vi.mock('@/router', () => ({
  default: {
    push: routerPushMock
  }
}))

vi.mock('@/services/backend', () => ({
  DEFAULT_MATRIX_HOMESERVER_URL: 'http://localhost:8008',
  DEFAULT_MATRIX_IDENTITY_SERVER_URL: '',
  discoverAndSaveMatrixEndpoints: vi.fn(),
  isValidHttpUrl: vi.fn(() => true),
  saveMatrixHomeserverUrl: vi.fn((value: string) => value),
  saveMatrixIdentityServerUrl: vi.fn((value: string) => value)
}))

vi.mock('@/services/matrix/auth/SessionOrchestrator', () => ({
  sessionOrchestrator: {
    loginWithSsoToken: loginWithSsoTokenMock,
    completeDesktopLoginTransition: completeDesktopLoginTransitionMock
  }
}))

vi.mock('@/stores/domains/settings/guide', () => ({
  useGuideStore: () => ({
    isGuideCompleted: true
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light',
    autoLoginEnabled: false,
    setAutoLogin: vi.fn()
  })
}))

vi.mock('@/stores/domains/user/loginHistory', () => ({
  useLoginHistoriesStore: () => ({
    loginHistories: []
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    userInfo: undefined
  })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    isTrayMenuShow: false,
    updateCurrentSessionRoomId: vi.fn()
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: vi.fn(() => '')
  }
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => true
}))

vi.mock('@/utils/Formatting', () => ({
  formatBottomText: (value: string) => value
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
  isCompatibility: () => false,
  isDesktop: () => true,
  isMac: () => false
}))

vi.mock('@/utils/TimerManager', () => ({
  useTimerManager: () => ({
    setTimeout: vi.fn((callback: () => void) => {
      callback()
      return 1
    }),
    clearTimeout: vi.fn()
  })
}))

vi.mock('@/enums', () => ({
  ThemeEnum: {
    DARK: 'dark'
  },
  MittEnum: {
    MSG_INIT: 'MSG_INIT'
  }
}))

vi.mock('../ThirdPartyLogin.vue', () => ({
  default: {
    name: 'ThirdPartyLogin',
    template: '<div class="third-party-login" />'
  }
}))

vi.mock('@/components/windows/ActionBar.vue', () => ({
  default: {
    name: 'ActionBar',
    template: '<div class="action-bar" />'
  }
}))

const Login = (await import('../Login.vue')).default

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    history.replaceState({}, '', '/login?loginToken=sso-login-token')
    getWindowPayloadMock.mockResolvedValue(undefined)
    loginWithSsoTokenMock.mockResolvedValue(undefined)
    completeDesktopLoginTransitionMock.mockResolvedValue(undefined)
    currentWindowShowMock.mockResolvedValue(undefined)
    loginLoadingRef.value = false
    loginTextRef.value = '登录'
    loginDisabledRef.value = false
  })

  it('consumes loginToken callback and completes desktop sso login on mount', async () => {
    shallowMount(Login)

    await flushPromises()

    expect(currentWindowShowMock).toHaveBeenCalled()
    expect(loginWithSsoTokenMock).toHaveBeenCalledWith({
      loginToken: 'sso-login-token',
      client: 'PC'
    })
    expect(completeDesktopLoginTransitionMock).toHaveBeenCalled()
    expect(window.location.pathname).toBe('/login')
    expect(window.location.search).toBe('')
  })

  it('restores login state and shows error when sso callback fails', async () => {
    loginWithSsoTokenMock.mockRejectedValue(new Error('boom'))

    shallowMount(Login)

    await flushPromises()

    expect(loginWithSsoTokenMock).toHaveBeenCalledWith({
      loginToken: 'sso-login-token',
      client: 'PC'
    })
    expect(completeDesktopLoginTransitionMock).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('login.sso_login_failed', 'error')
    expect(loginLoadingRef.value).toBe(false)
    expect(loginDisabledRef.value).toBe(false)
    expect(loginTextRef.value).toBe('登录')
    expect(window.location.search).toBe('?loginToken=sso-login-token')
  })
})
