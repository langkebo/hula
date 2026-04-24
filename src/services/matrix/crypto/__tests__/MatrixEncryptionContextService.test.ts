import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixEncryptionContextService } from '../MatrixEncryptionContextService'

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(),
    getUserId: vi.fn(),
    getDeviceId: vi.fn()
  }
}))

describe('MatrixEncryptionContextService', () => {
  let mockCrypto: {
    getOwnDeviceKeys: ReturnType<typeof vi.fn>
    prepareKeyBackupVersion: ReturnType<typeof vi.fn>
  }
  let mockKeyBackupManager: {
    prepareKeyBackupVersion: ReturnType<typeof vi.fn>
  }
  let mockClient: {
    getCrypto: ReturnType<typeof vi.fn>
    getKeyBackupManager: ReturnType<typeof vi.fn>
    getStoredDevice: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockCrypto = {
      getOwnDeviceKeys: vi.fn(),
      prepareKeyBackupVersion: vi.fn()
    }
    mockKeyBackupManager = {
      prepareKeyBackupVersion: vi.fn()
    }
    mockClient = {
      getCrypto: vi.fn(() => mockCrypto),
      getKeyBackupManager: vi.fn(() => mockKeyBackupManager),
      getStoredDevice: vi.fn()
    }

    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)
    vi.mocked(matrixClientService.getUserId).mockReturnValue('@alice:example.com')
    vi.mocked(matrixClientService.getDeviceId).mockReturnValue('DEVICE123')
  })

  it('返回当前会话上下文', () => {
    expect(matrixEncryptionContextService.getCurrentSessionContext()).toEqual({
      userId: '@alice:example.com',
      deviceId: 'DEVICE123',
      isCryptoEnabled: true
    })
  })

  it('在加密不可用时返回禁用上下文', () => {
    mockClient.getCrypto.mockReturnValue(null)

    expect(matrixEncryptionContextService.getCurrentSessionContext()).toEqual({
      userId: '@alice:example.com',
      deviceId: 'DEVICE123',
      isCryptoEnabled: false
    })
  })

  it('返回当前设备指纹', async () => {
    mockCrypto.getOwnDeviceKeys.mockResolvedValue({
      ed25519: 'abcdef123456',
      curve25519: 'curve-key'
    })

    await expect(matrixEncryptionContextService.getCurrentDeviceFingerprint()).resolves.toBe('abcdef123456')
  })

  it('在获取指纹失败时返回 null', async () => {
    mockCrypto.getOwnDeviceKeys.mockRejectedValue(new Error('fingerprint failed'))

    await expect(matrixEncryptionContextService.getCurrentDeviceFingerprint()).resolves.toBeNull()
  })

  it('优先返回当前设备指纹', async () => {
    mockCrypto.getOwnDeviceKeys.mockResolvedValue({
      ed25519: 'self-fingerprint'
    })

    await expect(matrixEncryptionContextService.getDeviceFingerprint('@alice:example.com', 'DEVICE123')).resolves.toBe(
      'self-fingerprint'
    )
    expect(mockClient.getStoredDevice).not.toHaveBeenCalled()
  })

  it('在目标设备不是当前设备时返回存储设备指纹', async () => {
    mockClient.getStoredDevice.mockResolvedValue({
      getFingerprint: () => 'other-fingerprint'
    })

    await expect(
      matrixEncryptionContextService.getDeviceFingerprint('@alice:example.com', 'OTHER_DEVICE')
    ).resolves.toBe('other-fingerprint')
  })

  it('在设备上下文缺失或获取失败时返回 null', async () => {
    vi.mocked(matrixClientService.getUserId).mockReturnValue(null)
    vi.mocked(matrixClientService.getDeviceId).mockReturnValue(null)

    await expect(matrixEncryptionContextService.getDeviceFingerprint()).resolves.toBeNull()

    vi.mocked(matrixClientService.getUserId).mockReturnValue('@alice:example.com')
    vi.mocked(matrixClientService.getDeviceId).mockReturnValue('DEVICE123')
    mockClient.getStoredDevice.mockRejectedValue(new Error('stored device failed'))

    await expect(
      matrixEncryptionContextService.getDeviceFingerprint('@alice:example.com', 'OTHER_DEVICE')
    ).resolves.toBeNull()
  })

  it('优先使用 KeyBackupManager 准备备份版本', async () => {
    const prepared = {
      algorithm: 'm.megolm.backup.v1',
      auth_data: { public_key: 'pk' },
      privateKey: new Uint8Array([1, 2, 3])
    }
    mockKeyBackupManager.prepareKeyBackupVersion.mockResolvedValue(prepared)

    await expect(matrixEncryptionContextService.prepareKeyBackupVersion()).resolves.toEqual({
      algorithm: 'm.megolm.backup.v1',
      authData: { public_key: 'pk' },
      privateKey: new Uint8Array([1, 2, 3])
    })
    expect(mockCrypto.prepareKeyBackupVersion).not.toHaveBeenCalled()
  })

  it('在 KeyBackupManager 不可用时回退到 crypto.prepareKeyBackupVersion', async () => {
    mockClient.getKeyBackupManager.mockReturnValue(null)
    mockCrypto.prepareKeyBackupVersion.mockResolvedValue({
      algorithm: 'm.megolm.backup.v1',
      auth_data: { public_key: 'fallback' },
      privateKey: new Uint8Array([9])
    })

    await expect(matrixEncryptionContextService.prepareKeyBackupVersion()).resolves.toEqual({
      algorithm: 'm.megolm.backup.v1',
      authData: { public_key: 'fallback' },
      privateKey: new Uint8Array([9])
    })
  })

  it('在无法准备备份版本时返回 null', async () => {
    mockClient.getKeyBackupManager.mockReturnValue(null)
    mockCrypto.prepareKeyBackupVersion.mockResolvedValue(undefined)

    await expect(matrixEncryptionContextService.prepareKeyBackupVersion()).resolves.toBeNull()
  })
})
