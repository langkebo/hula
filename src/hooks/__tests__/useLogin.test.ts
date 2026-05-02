import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'

const mockRouterPush = vi.fn()
const mockRouterReplace = vi.fn()
const mockInvoke = vi.fn()
const mockEnsureAppStateReady = vi.fn()
const mockEmit = vi.fn()
const mockLogInfo = vi.fn()

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

const mockMatrixRuntimeSessionService = {
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

vi.mock('@/hooks/useWindow.ts', () => ({
  useWindow: () => ({
    resizeWindow: vi.fn(),
    createWebviewWindow: vi.fn()
  })
}))

vi.mock('@/hooks/useMitt', () => ({
  useMitt: {
    emit: vi.fn()
  }
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
  })
}))

vi.mock('@/services/matrix/auth/MatrixRuntimeSessionService', () => ({
  matrixRuntimeSessionService: mockMatrixRuntimeSessionService
}))

const { useLoginFlow } = await import('../useLoginFlow')

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
    mockMatrixRuntimeSessionService.getStoredTokens.mockResolvedValue({
      token: 'access-token',
      refreshToken: 'refresh-token'
    })
    mockMatrixRuntimeSessionService.restoreWithAccessToken.mockResolvedValue(undefined)
    mockMatrixRuntimeSessionService.loginWithPassword.mockResolvedValue(undefined)
    mockMatrixRuntimeSessionService.completeDesktopLoginTransition.mockResolvedValue(undefined)
  })

  it('prefers restoring stored token session during auto login', async () => {
    const { normalLogin } = useLoginFlow()

    await normalLogin('PC', true, true)

    expect(mockMatrixRuntimeSessionService.getStoredTokens).toHaveBeenCalledTimes(1)
    expect(mockMatrixRuntimeSessionService.restoreWithAccessToken).toHaveBeenCalledWith({
      uid: '@alice:example.com',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      displayName: 'Alice',
      account: 'alice',
      avatar: 'mxc://avatar',
      client: 'PC',
      bootstrapAfterRestore: true
    })
    expect(mockMatrixRuntimeSessionService.loginWithPassword).not.toHaveBeenCalled()
    expect(mockMatrixRuntimeSessionService.completeDesktopLoginTransition).toHaveBeenCalledTimes(1)
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
    mockMatrixRuntimeSessionService.getStoredTokens.mockResolvedValue({
      token: null,
      refreshToken: null
    })

    const { normalLogin } = useLoginFlow()

    await normalLogin('PC', true, true)

    expect(mockMatrixRuntimeSessionService.restoreWithAccessToken).not.toHaveBeenCalled()
    expect(mockMatrixRuntimeSessionService.loginWithPassword).toHaveBeenCalledWith({
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
    expect(mockMatrixRuntimeSessionService.completeDesktopLoginTransition).toHaveBeenCalledTimes(1)
  })
})
