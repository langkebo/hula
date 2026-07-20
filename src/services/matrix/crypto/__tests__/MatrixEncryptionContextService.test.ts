import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixEncryptionContextService } from '../MatrixEncryptionContextService'

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
    expect(mockClient.getStoredDevice).not.toHaveBeenCalled()
  })

  it('fetches stored device fingerprint when target device is not self', async () => {
    mockClient.getStoredDevice.mockResolvedValue({
      getFingerprint: () => 'other-fingerprint'
    })

    await expect(
      matrixEncryptionContextService.getDeviceFingerprint('@alice:example.com', 'OTHER_DEVICE')
    ).resolves.toBe('other-fingerprint')
  })

  it('returns null when device context is missing or fetch fails', async () => {
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

  it('prefers KeyBackupManager to prepare backup version', async () => {
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

  it('falls back to crypto.prepareKeyBackupVersion when KeyBackupManager is unavailable', async () => {
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

  it('returns null when backup version cannot be prepared', async () => {
    mockClient.getKeyBackupManager.mockReturnValue(null)
    mockCrypto.prepareKeyBackupVersion.mockResolvedValue(undefined)

    await expect(matrixEncryptionContextService.prepareKeyBackupVersion()).resolves.toBeNull()
  })
})
