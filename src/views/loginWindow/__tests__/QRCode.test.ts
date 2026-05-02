import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const {
  invokeMock,
  saveMatrixSessionEndpointConfigMock,
  getEnhancedFingerprintMock,
  generateQRMock,
  checkStatusMock,
  loginCommandMock,
  setIntervalMock,
  clearIntervalMock
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  saveMatrixSessionEndpointConfigMock: vi.fn(),
  getEnhancedFingerprintMock: vi.fn(),
  generateQRMock: vi.fn(),
  checkStatusMock: vi.fn(),
  loginCommandMock: vi.fn(),
  setIntervalMock: vi.fn(),
  clearIntervalMock: vi.fn()
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock
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
    NSkeleton: stub('NSkeleton'),
    NQrCode: stub('NQrCode'),
    NSpin: stub('NSpin')
  }
})

vi.mock('pinia', () => ({
  storeToRefs: (store: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(store).map(([key, value]) => [key, ref(value)]))
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          'login.qr.load_text.loading': '加载中...',
          'login.qr.load_text.scan_hint': '请扫码登录',
          'login.qr.load_text.login': '登录中...',
          'login.qr.actions.account_login': '账密登录',
          'login.qr.actions.register': '注册',
          'login.qr.actions.register_title': '注册',
          'login.qr.overlay.success': '登录成功'
        }) as Record<string, string>
      )[key] || key
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@/enums', () => ({
  TauriCommand: {
    UPDATE_TOKEN: 'update_token'
  }
}))

vi.mock('@/hooks/useLoginFlow', () => ({
  useLoginFlow: () => ({
    loading: ref(false),
    loginDisabled: ref(false)
  })
}))

vi.mock('@/hooks/useWindow.ts', () => ({
  useWindow: () => ({
    createWebviewWindow: vi.fn()
  })
}))

vi.mock('@/router', () => ({
  default: {
    push: vi.fn()
  }
}))

vi.mock('@/services/backend/config', () => ({
  saveMatrixSessionEndpointConfig: saveMatrixSessionEndpointConfigMock
}))

vi.mock('@/services/fingerprint', () => ({
  getEnhancedFingerprint: getEnhancedFingerprintMock
}))

vi.mock('@/services/matrix/auth/MatrixQrLoginService', () => ({
  matrixQrLoginService: {
    generateQR: generateQRMock,
    checkStatus: checkStatusMock
  }
}))

vi.mock('@/services/tauriCommand', () => ({
  loginCommand: loginCommandMock
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light'
  })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    isTrayMenuShow: false
  })
}))

vi.mock('@/utils/TimerManager', () => ({
  useTimerManager: () => ({
    setInterval: setIntervalMock,
    clearInterval: clearIntervalMock
  })
}))

vi.mock('./ThirdPartyLogin.vue', () => ({
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

const QRCode = (await import('../QRCode.vue')).default

describe('QRCode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getEnhancedFingerprintMock.mockResolvedValue('fingerprint-id')
    generateQRMock.mockResolvedValue({ qrId: 'qr-id' })
    checkStatusMock.mockResolvedValue({
      status: 'CONFIRMED',
      data: {
        uid: '@alice:example.com',
        token: 'access-token',
        refreshToken: 'refresh-token',
        homeserverUrl: 'https://resolved.example.com',
        identityServerUrl: 'https://identity.example.com'
      }
    })
    loginCommandMock.mockResolvedValue(undefined)
    invokeMock.mockResolvedValue(undefined)
    setIntervalMock.mockImplementation(async (callback: () => Promise<void>) => {
      await callback()
      return 1
    })
  })

  it('saves session endpoint before completing qr login command', async () => {
    shallowMount(QRCode)

    await flushPromises()

    expect(invokeMock).toHaveBeenCalledWith('update_token', {
      req: {
        uid: '@alice:example.com',
        token: 'access-token',
        refreshToken: 'refresh-token'
      }
    })
    expect(saveMatrixSessionEndpointConfigMock).toHaveBeenCalledWith({
      homeserverUrl: 'https://resolved.example.com',
      identityServerUrl: 'https://identity.example.com'
    })
    expect(loginCommandMock).toHaveBeenCalledWith({ uid: '@alice:example.com' })
    expect(saveMatrixSessionEndpointConfigMock.mock.invocationCallOrder[0]).toBeLessThan(
      loginCommandMock.mock.invocationCallOrder[0]
    )
  })
})
