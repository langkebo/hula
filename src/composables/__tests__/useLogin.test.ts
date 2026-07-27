import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'

const mockRouterPush = vi.fn()
const mockRouterReplace = vi.fn()
const mockInvoke = vi.fn()
const mockEnsureAppStateReady = vi.fn()
const mockEmit = vi.fn()
const mockLogInfo = vi.fn()
const showFeedbackMock = vi.fn()

const mockGlobalStore = reactive({
  isTrayMenuShow: false,
  updateCurrentSessionRoomId: vi.fn()
})

const mockSettingStore = reactive({
  autoLoginEnabled: true,
  setAutoLogin: vi.fn(),
  closeAutoLogin: vi.fn()
})

const mockUserStore = reactive({
  userInfo: {
    uid: '@alice:example.com',
    account: 'alice',
    password: '',
    avatar: 'mxc://avatar',
    name: 'Alice',
    email: ''
  }
})

const mockMatrixStore = reactive({
  userId: '',
  logout: vi.fn()
})

const mockSessionOrchestrator = {
  getStoredTokens: vi.fn(),
  restoreWithAccessToken: vi.fn(),
  loginWithPassword: vi.fn(),
  applyDesktopLoginState: vi.fn(),
  completeDesktopLoginTransition: vi.fn()
}

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace
  })
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}))

vi.mock('@tauri-apps/api/event', () => ({
  emit: mockEmit
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getByLabel: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: mockLogInfo
}))

vi.mock('@vueuse/core', () => ({
  useNetwork: () => ({
    isOnline: ref(true)
  })
}))

vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({
    resizeWindow: vi.fn(),
    createWebviewWindow: vi.fn()
  })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    emit: vi.fn()
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => mockGlobalStore
}))

vi.mock('../useMitt', () => ({
  useMitt: {
    emit: vi.fn()
  }
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => mockMatrixStore
}))

vi.mock('../../stores/domains/settings/setting', () => ({
  useSettingStore: () => mockSettingStore
}))

vi.mock('../../stores/domains/user/user', () => ({
  useUserStore: () => mockUserStore
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isDesktop: () => true,
  isMac: () => false,
  isMobile: () => false
}))

// useLoginFlow 在登录成功后仅当 isDesktop() && hasTauriRuntime() 才调用 completeDesktopLoginTransition
vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => true
}))

vi.mock('@/utils/AppStateReady', () => ({
  ensureAppStateReady: mockEnsureAppStateReady
}))

vi.mock('../../services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/services/backend', () => ({
  resolveMatrixEndpointConfig: () => ({
    homeserverUrl: 'https://matrix.example.com',
    identityServerUrl: 'https://identity.example.com'
  }),
  resolveMatrixRuntimeEndpointConfig: () => ({
    homeserverUrl: 'https://matrix.example.com',
    identityServerUrl: 'https://identity.example.com'
  })
}))

vi.mock('@/services/matrix/auth/SessionOrchestrator', () => ({
  sessionOrchestrator: mockSessionOrchestrator
}))

const { useLoginFlow } = await import('@/composables/user/useLoginFlow')

describe('useLoginFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingStore.autoLoginEnabled = true
    mockUserStore.userInfo = {
      uid: '@alice:example.com',
      account: 'alice',
      password: '',
      avatar: 'mxc://avatar',
      name: 'Alice',
      email: ''
    }
    mockMatrixStore.userId = ''
    mockEnsureAppStateReady.mockResolvedValue(undefined)
    mockSessionOrchestrator.getStoredTokens.mockResolvedValue({
      token: 'access-token',
      refreshToken: 'refresh-token'
    })
    mockSessionOrchestrator.restoreWithAccessToken.mockResolvedValue(undefined)
    mockSessionOrchestrator.loginWithPassword.mockResolvedValue(undefined)
    mockSessionOrchestrator.completeDesktopLoginTransition.mockResolvedValue(undefined)
  })

  it('prefers restoring stored token session during auto login', async () => {
    const { normalLogin } = useLoginFlow()

    await normalLogin('PC', true, true)

    expect(mockSessionOrchestrator.getStoredTokens).toHaveBeenCalledTimes(1)
    expect(mockSessionOrchestrator.restoreWithAccessToken).toHaveBeenCalledWith({
      uid: '@alice:example.com',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      displayName: 'Alice',
      account: 'alice',
      avatar: 'mxc://avatar',
      client: 'PC',
      bootstrapAfterRestore: true
    })
    expect(mockSessionOrchestrator.loginWithPassword).not.toHaveBeenCalled()
    expect(mockSessionOrchestrator.completeDesktopLoginTransition).toHaveBeenCalledTimes(1)
  })

  it('falls back to password login when auto login has no stored token', async () => {
    mockUserStore.userInfo = {
      uid: '@alice:example.com',
      account: 'alice',
      password: 'secret',
      avatar: 'mxc://avatar',
      name: 'Alice',
      email: ''
    }
    mockSessionOrchestrator.getStoredTokens.mockResolvedValue({
      token: null,
      refreshToken: null
    })

    const { normalLogin } = useLoginFlow()

    await normalLogin('PC', true, true)

    expect(mockSessionOrchestrator.restoreWithAccessToken).not.toHaveBeenCalled()
    expect(mockSessionOrchestrator.loginWithPassword).toHaveBeenCalledWith({
      username: 'alice',
      password: 'secret',
      homeserverUrl: 'https://matrix.example.com',
      identityServerUrl: 'https://identity.example.com',
      deviceName: 'HuLa Client',
      account: 'alice',
      displayName: 'Alice',
      avatar: 'mxc://avatar',
      client: 'PC'
    })
    expect(mockSessionOrchestrator.completeDesktopLoginTransition).toHaveBeenCalledTimes(1)
  })

  it('shows action feedback and disables auto login fallback when auto login fails', async () => {
    mockSessionOrchestrator.restoreWithAccessToken.mockRejectedValueOnce(new Error('restore failed'))

    const { normalLogin, uiState } = useLoginFlow()

    await normalLogin('PC', true, true)

    expect(showFeedbackMock).toHaveBeenCalledWith('restore failed', 'error')
    expect(uiState.value).toBe('manual')
    expect(mockSettingStore.setAutoLogin).toHaveBeenCalledWith(false)
  })

  it('shows invalid credentials for login-context forbidden errors', async () => {
    mockSessionOrchestrator.restoreWithAccessToken.mockRejectedValueOnce(
      Object.assign(new Error('Invalid username or password'), {
        errcode: 'M_FORBIDDEN',
        httpStatus: 403
      })
    )

    const { normalLogin } = useLoginFlow()

    await normalLogin('PC', true, true)

    expect(showFeedbackMock).toHaveBeenCalledWith('error.matrix.invalid_credentials', 'error')
  })
})
