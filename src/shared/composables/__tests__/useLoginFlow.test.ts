import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  loginWithPassword: vi.fn(),
  stopClient: vi.fn(async () => {}),
  showFeedback: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  setAutoLogin: vi.fn(),
  emit: vi.fn()
}))

vi.mock('@vueuse/core', () => ({
  useNetwork: () => ({ isOnline: { value: true } })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: h.push, replace: h.replace })
}))

vi.mock('@/composables/usePlatform', () => ({
  useIsMobile: () => ({ value: false })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: h.showFeedback })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: { emit: h.emit }
}))

vi.mock('@/enums', () => ({
  MittEnum: { MSG_INIT: 'MSG_INIT' }
}))

vi.mock('@/services/backend', () => ({
  resolveMatrixRuntimeEndpointConfig: () => ({
    homeserverUrl: 'https://hs.example.com',
    identityServerUrl: ''
  })
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('@/services/matrix/auth/SessionOrchestrator', () => ({
  sessionOrchestrator: {
    loginWithPassword: h.loginWithPassword,
    restoreWithAccessToken: vi.fn(async () => {}),
    getStoredTokens: vi.fn(async () => ({ token: null, refreshToken: null })),
    completeDesktopLoginTransition: vi.fn(async () => {}),
    applyDesktopLoginState: vi.fn(async () => {}),
    bootstrapPostLoginState: vi.fn(async () => {}),
    logoutCurrentSession: vi.fn(async () => {})
  }
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    stopClient: h.stopClient,
    updateConnectionState: vi.fn()
  }
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => ({ connectionState: 'CONNECTED', isInitialized: true, userId: '' })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({ autoLoginEnabled: false, setAutoLogin: h.setAutoLogin })
}))

vi.mock('@/stores/domains/user/loginHistory', () => ({
  useLoginHistoriesStore: () => ({ removeLoginHistory: vi.fn() })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: null })
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => false
}))

vi.mock('@/utils/AppStateReady', () => ({
  ensureAppStateReady: vi.fn(async () => {})
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isDesktop: () => true
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeSilently: vi.fn(async () => {})
}))

vi.mock('@/common/matrixErrorTranslator', () => ({
  translateMatrixError: () => ({
    userMessage: 'error.matrix.unknown',
    level: 'toast',
    recoverable: false,
    action: 'none'
  })
}))

import { useLoginFlow } from '../useLoginFlow'

/** 填充手动登录表单，避免走「账号缺失」提前返回分支。 */
function fillManualForm(flow: ReturnType<typeof useLoginFlow>) {
  flow.info.value.account = 'alice'
  flow.info.value.password = 'secret'
}

describe('useLoginFlow — 登录重入锁', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('并发触发两次 normalLogin ⇒ 底层 loginWithPassword 只执行一次', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    h.loginWithPassword.mockImplementation(async () => {
      await gate
      return { uid: '@alice:hs.example.com', accessToken: 'token' }
    })

    const flow = useLoginFlow()
    fillManualForm(flow)

    const first = flow.normalLogin('PC', true, false)
    const second = flow.normalLogin('PC', true, false)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(h.loginWithPassword).toHaveBeenCalledTimes(1)

    release()
    await Promise.all([first, second])

    expect(h.loginWithPassword).toHaveBeenCalledTimes(1)
    expect(flow.loginStatus.value).toBe('success')
  })

  it('登录失败后被 finally 释放锁，下一次登录可以真正重试', async () => {
    h.loginWithPassword.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { errcode: 'M_FORBIDDEN' }))

    const flow = useLoginFlow()
    fillManualForm(flow)

    await flow.normalLogin('PC', true, false)
    expect(flow.loginStatus.value).toBe('failed')

    h.loginWithPassword.mockResolvedValueOnce({ uid: '@alice:hs', accessToken: 'token' })
    await flow.normalLogin('PC', true, false)

    expect(h.loginWithPassword).toHaveBeenCalledTimes(2)
    expect(flow.loginStatus.value).toBe('success')
  })

  it('失败路径会 teardown 已创建的 client', async () => {
    h.loginWithPassword.mockRejectedValueOnce(new Error('network down'))

    const flow = useLoginFlow()
    fillManualForm(flow)

    await flow.normalLogin('PC', true, false)

    expect(h.stopClient).toHaveBeenCalledTimes(1)
  })

  it('429（仅 httpStatus）⇒ 展示限流提示而非通用网络错误', async () => {
    h.loginWithPassword.mockRejectedValueOnce(Object.assign(new Error('rate limited'), { httpStatus: 429 }))

    const flow = useLoginFlow()
    fillManualForm(flow)

    await flow.normalLogin('PC', true, false)

    expect(flow.loginStatus.value).toBe('failed')
    expect(flow.lastLoginError.value).toBe('error.matrix.rate_limited')
  })
})
