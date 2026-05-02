import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQRLogin } from '../MatrixQrLoginService'

const mockMatrixStore = {
  userId: null as string | null,
  accessToken: null as string | null,
  deviceId: null as string | null,
  homeserverUrl: null as string | null
}

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: vi.fn(() => mockMatrixStore)
}))

vi.mock('@/services/backend/config', () => ({
  resolveMatrixSessionEndpointConfig: () => ({
    homeserverUrl: 'https://session.example.com',
    identityServerUrl: 'https://identity.example.com'
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

describe('MatrixQrLoginService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    mockMatrixStore.userId = null
    mockMatrixStore.accessToken = null
    mockMatrixStore.deviceId = null
    mockMatrixStore.homeserverUrl = null
  })

  it('should generate QR session and enter waiting_scan', async () => {
    const service = useQRLogin()

    const result = await service.generateQR()

    expect(result?.qrId).toBeTruthy()
    expect(service.status.value).toBe('waiting_scan')
  })

  it('should fail confirm when current device not logged in', async () => {
    const service = useQRLogin()
    const generated = await service.generateQR()

    const ok = await service.handleConfirm(generated?.qrId)

    expect(ok).toBe(false)
    expect(service.error.value).toBe('确认登录失败')
  })

  it('should confirm when current device has matrix session', async () => {
    const service = useQRLogin()
    const generated = await service.generateQR()
    mockMatrixStore.userId = '@user:example.com'
    mockMatrixStore.accessToken = 'token'
    mockMatrixStore.deviceId = 'DEVICE_ID'
    mockMatrixStore.homeserverUrl = 'https://confirmed.example.com'

    const ok = await service.handleConfirm(generated?.qrId)
    const status = await service.checkStatus(generated?.qrId)

    expect(ok).toBe(true)
    expect(service.status.value).toBe('success')
    expect(status?.userId).toBe('@user:example.com')
    expect(status?.data).toEqual(
      expect.objectContaining({
        homeserverUrl: 'https://confirmed.example.com',
        identityServerUrl: 'https://identity.example.com'
      })
    )
  })
})
