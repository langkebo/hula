import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const {
  invokeMock,
  invokeWithErrorHandlerMock,
  saveMatrixSessionEndpointConfigMock,
  getEnhancedFingerprintMock,
  resolveMatrixRuntimeEndpointConfigMock,
  generateQrCodeAsNewDeviceMock,
  waitForReciprocationAndLoginMock,
  onStatusChangeMock,
  cancelMock,
  loginCommandMock
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  invokeWithErrorHandlerMock: vi.fn(),
  saveMatrixSessionEndpointConfigMock: vi.fn(),
  getEnhancedFingerprintMock: vi.fn(),
  resolveMatrixRuntimeEndpointConfigMock: vi.fn(),
  generateQrCodeAsNewDeviceMock: vi.fn(),
  waitForReciprocationAndLoginMock: vi.fn(),
  onStatusChangeMock: vi.fn(),
  cancelMock: vi.fn(),
  loginCommandMock: vi.fn()
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
    NButton: stub('NButton'),
    NButtonGroup: stub('NButtonGroup'),
    NSkeleton: stub('NSkeleton'),
    NQrCode: stub('NQrCode'),
    NSpin: stub('NSpin')
  }
})

vi.mock('pinia', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    storeToRefs: () => ({ isTrayMenuShow: ref(false) })
  }
})

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<svg />' }
}))

vi.mock('@/enums', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    TauriCommand: {
      UPDATE_TOKEN: 'update_token'
    }
  }
})

vi.mock('@/shared/composables/useLoginFlow', () => ({
  useLoginFlow: () => ({
    loading: ref(false),
    loginDisabled: ref(false)
  })
}))

vi.mock('@/composables/common/useWindow', () => ({
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
  resolveMatrixRuntimeEndpointConfig: resolveMatrixRuntimeEndpointConfigMock,
  saveMatrixSessionEndpointConfig: saveMatrixSessionEndpointConfigMock
}))

vi.mock('@/services/secure/fingerprint', () => ({
  getEnhancedFingerprint: getEnhancedFingerprintMock
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeWithErrorHandler: invokeWithErrorHandlerMock
}))

vi.mock('@/services/matrix/auth/MatrixQrLoginSdkService', () => ({
  matrixQrLoginSdkService: {
    generateQrCodeAsNewDevice: generateQrCodeAsNewDeviceMock,
    waitForReciprocationAndLogin: waitForReciprocationAndLoginMock,
    onStatusChange: onStatusChangeMock,
    cancel: cancelMock
  }
}))

vi.mock('@/services/backend/tauriCommand', () => ({
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

vi.mock('@/components/rendezvous/RendezvousSessionManager.vue', () => ({
  default: { name: 'RendezvousSessionManager', template: '<div />' }
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
    resolveMatrixRuntimeEndpointConfigMock.mockReturnValue({
      homeserverUrl: 'https://matrix.example.com'
    })
    generateQrCodeAsNewDeviceMock.mockResolvedValue({
      qrCodeBase64: 'base64-qr-data',
      checkCode: '123456',
      rendezvousUrl: 'https://matrix.example.com/_matrix/client/unstable/org.matrix.msc4108/rendezvous/session-123'
    })
    waitForReciprocationAndLoginMock.mockResolvedValue({
      user_id: '@alice:example.com',
      access_token: 'access-token',
      device_id: 'NEWDEVICE',
      refresh_token: 'refresh-token',
      expires_in: 3600000,
      homeserver_url: 'https://resolved.example.com'
    })
    onStatusChangeMock.mockReturnValue(() => {})
    cancelMock.mockResolvedValue(undefined)
    loginCommandMock.mockResolvedValue(undefined)
    invokeMock.mockResolvedValue(undefined)
    invokeWithErrorHandlerMock.mockResolvedValue(undefined)
  })

  it('saves session endpoint before completing qr login command', async () => {
    shallowMount(QRCode)

    await flushPromises()
    await flushPromises()

    expect(generateQrCodeAsNewDeviceMock).toHaveBeenCalledWith('https://matrix.example.com')
    expect(invokeWithErrorHandlerMock).toHaveBeenCalledWith('update_token', {
      req: {
        uid: '@alice:example.com',
        token: 'access-token',
        refreshToken: 'refresh-token'
      }
    })
    expect(saveMatrixSessionEndpointConfigMock).toHaveBeenCalledWith({
      homeserverUrl: 'https://resolved.example.com',
      identityServerUrl: ''
    })
    expect(loginCommandMock).toHaveBeenCalledWith({ uid: '@alice:example.com' })
    expect(saveMatrixSessionEndpointConfigMock.mock.invocationCallOrder[0]).toBeLessThan(
      loginCommandMock.mock.invocationCallOrder[0]
    )
  })

  it('registers a status listener for UI updates', async () => {
    shallowMount(QRCode)

    await flushPromises()

    expect(onStatusChangeMock).toHaveBeenCalledOnce()
    expect(typeof onStatusChangeMock.mock.calls[0][0]).toBe('function')
  })

  it('cancels the MSC4108 session on unmount', async () => {
    const wrapper = shallowMount(QRCode)
    await flushPromises()

    wrapper.unmount()

    expect(cancelMock).toHaveBeenCalled()
  })
})
