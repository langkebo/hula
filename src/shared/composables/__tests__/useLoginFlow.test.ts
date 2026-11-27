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

import { makeLoginResult } from '@/services/matrix/auth/__tests__/fixtures/session'
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

    h.loginWithPassword.mockResolvedValueOnce(makeLoginResult('@alice:hs', 'token'))
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

describe('useLoginFlow — 切换账号时不复用旧账号资料（P-28）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('选中 testuser1 历史后改用 testuser2 登录 ⇒ 昵称回退到账号本身，不沿用旧头像', async () => {
    h.loginWithPassword.mockResolvedValueOnce(makeLoginResult('@testuser2:matrix.test', 'token'))

    const flow = useLoginFlow()
    flow.selectAccount({
      account: '@testuser1:matrix.test',
      password: 'Test@123',
      avatar: 'mxc://avatar/testuser1',
      name: 'testuser1',
      uid: '@testuser1:matrix.test'
    })
    // 模拟用户在历史填充后直接改写账号输入框
    flow.info.value.account = '@testuser2:matrix.test'
    flow.info.value.password = 'Test@123'

    await flow.normalLogin('PC', true, false)

    expect(h.loginWithPassword).toHaveBeenCalledTimes(1)
    const payload = h.loginWithPassword.mock.calls[0][0] as { account: string; displayName: string; avatar?: string }
    expect(payload.account).toBe('@testuser2:matrix.test')
    expect(payload.displayName).toBe('@testuser2:matrix.test')
    expect(payload.avatar).toBeUndefined()
  })

  it('沿用同一历史账号登录 ⇒ 历史昵称与头像正常带出', async () => {
    h.loginWithPassword.mockResolvedValueOnce(makeLoginResult('@testuser1:matrix.test', 'token'))

    const flow = useLoginFlow()
    flow.selectAccount({
      account: 'testuser1',
      password: 'Test@123',
      avatar: 'mxc://avatar/testuser1',
      name: 'testuser1',
      uid: '@testuser1:matrix.test'
    })

    await flow.normalLogin('PC', true, false)

    const payload = h.loginWithPassword.mock.calls[0][0] as { account: string; displayName: string; avatar?: string }
    expect(payload.displayName).toBe('testuser1')
    expect(payload.avatar).toBe('mxc://avatar/testuser1')
  })
})
