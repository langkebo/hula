import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixEncryptionContextService } from '../MatrixEncryptionContextService'

describe('MatrixEncryptionContextService', () => {
  let mockCrypto: {
    getOwnDeviceKeys: ReturnType<typeof vi.fn>
  }
  let mockClient: {
    getCrypto: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockCrypto = {
      getOwnDeviceKeys: vi.fn()
    }
    mockClient = {
      getCrypto: vi.fn(() => mockCrypto)
    }

    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as unknown as MatrixClient)
    vi.spyOn(matrixClientService, 'getUserId').mockReturnValue('@alice:example.com')
    vi.spyOn(matrixClientService, 'getDeviceId').mockReturnValue('DEVICE123')
  })

  it('returns current session context', () => {
    expect(matrixEncryptionContextService.getCurrentSessionContext()).toEqual({
      userId: '@alice:example.com',
      deviceId: 'DEVICE123',
      isCryptoEnabled: true
    })
  })

  it('returns disabled context when encryption is unavailable', () => {
    mockClient.getCrypto.mockReturnValue(null)

    expect(matrixEncryptionContextService.getCurrentSessionContext()).toEqual({
      userId: '@alice:example.com',
      deviceId: 'DEVICE123',
      isCryptoEnabled: false
    })
  })

  it('returns current device fingerprint', async () => {
    mockCrypto.getOwnDeviceKeys.mockResolvedValue({
      ed25519: 'abcdef123456',
      curve25519: 'curve-key'
    })

    await expect(matrixEncryptionContextService.getCurrentDeviceFingerprint()).resolves.toBe('abcdef123456')
  })

  it('returns null when fingerprint fetch fails', async () => {
    mockCrypto.getOwnDeviceKeys.mockRejectedValue(new Error('fingerprint failed'))

    await expect(matrixEncryptionContextService.getCurrentDeviceFingerprint()).resolves.toBeNull()
  })

  it('prefers current device fingerprint when target device is self', async () => {
    mockCrypto.getOwnDeviceKeys.mockResolvedValue({
      ed25519: 'self-fingerprint'
    })

    await expect(matrixEncryptionContextService.getDeviceFingerprint('@alice:example.com', 'DEVICE123')).resolves.toBe(
      'self-fingerprint'
    )
  })

  it('非本机设备返回 null，且不再依赖幻影 getStoredDevice', async () => {
    // 历史缺陷：曾用不存在的 client.getStoredDevice 兜底，兜底恒返回 null，
    // 指纹获取静默失败却看不出原因。现在显式返回 null。
    await expect(
      matrixEncryptionContextService.getDeviceFingerprint('@alice:example.com', 'OTHER_DEVICE')
    ).resolves.toBeNull()
  })

  it('returns null when device context is missing', async () => {
    vi.mocked(matrixClientService.getUserId).mockReturnValue(null)
    vi.mocked(matrixClientService.getDeviceId).mockReturnValue(null)

    await expect(matrixEncryptionContextService.getDeviceFingerprint()).resolves.toBeNull()
  })

  // 旧的 prepareKeyBackupVersion 契约是幻影（SDK 无此方法），
  // 已由 MatrixEncryptionContextService.backupVersion.test.ts 用真实 API 覆盖。
})
