import { describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'
import type {
  CryptoApi,
  DeviceTrustManager,
  IDeviceTrustInfo,
  LegacyStoredDevice,
  MatrixClientExtended
} from '@/types/matrix-extensions'
import { CryptoDeviceAdapter } from '../CryptoDeviceAdapter'
import type { CryptoAdapterAccessors } from '../cryptoAdapterTypes'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

function createMockAccessors(opts: {
  trustManager?: DeviceTrustManager | null
  crypto?: CryptoApi | null
  client?: Partial<MatrixClientExtended> | null
  matrixClient?: Partial<MatrixClient> | null
}): CryptoAdapterAccessors {
  const client = (opts.client ?? {}) as MatrixClientExtended
  const matrixClient = (opts.matrixClient ?? { getDeviceId: () => 'current-device' }) as MatrixClient
  return {
    getCrypto: () => opts.crypto ?? null,
    getExtendedClient: () => client,
    getClient: () => matrixClient,
    getDeviceTrustManager: () => opts.trustManager ?? null,
    getSecureBackupManager: () => null,
    getKeyBackupManager: () => null,
    getSDKDeviceKeysManager: () => null,
    getSDKKeyBackupManager: () => null,
    getSDKKeyVerificationManager: () => null
  } as CryptoAdapterAccessors
}

describe('CryptoDeviceAdapter', () => {
  describe('getDevices', () => {
    it('returns mapped devices from DeviceTrustManager when available', async () => {
      const trustList: IDeviceTrustInfo[] = [
        {
          device_id: 'DEV1',
          user_id: '@alice:matrix.org',
          display_name: 'Alice Phone',
          trust_level: 'verified',
          last_seen_ts: 1700000000,
          last_seen_ip: '1.2.3.4'
        },
        {
          device_id: 'DEV2',
          user_id: '@bob:matrix.org',
          trust_level: 'unverified'
        }
      ]
      const trustManager = {
        getDeviceTrustList: vi.fn().mockResolvedValue(trustList)
      } as unknown as DeviceTrustManager
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ trustManager }))

      const result = await adapter.getDevices('@alice:matrix.org')

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        deviceId: 'DEV1',
        userId: '@alice:matrix.org',
        displayName: 'Alice Phone',
        lastSeenTs: 1700000000,
        lastSeenIp: '1.2.3.4',
        isVerified: true
      })
    })

    it('falls back to legacy getStoredDevicesForUser when no TrustManager', async () => {
      const legacyDevices: LegacyStoredDevice[] = [
        {
          deviceId: 'DEV1',
          userId: '@alice:matrix.org',
          displayName: 'Laptop',
          isVerified: () => true,
          isUnverified: () => false
        },
        {
          deviceId: 'DEV2',
          userId: '@alice:matrix.org',
          displayName: 'Phone',
          isVerified: () => false,
          isUnverified: () => true
        }
      ]
      const client = { getStoredDevicesForUser: vi.fn().mockResolvedValue(legacyDevices) }
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ client }))

      const result = await adapter.getDevices('@alice:matrix.org')

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        deviceId: 'DEV1',
        userId: '@alice:matrix.org',
        displayName: 'Laptop',
        isVerified: true
      })
    })

    it('returns empty array when neither TrustManager nor legacy method available', async () => {
      const adapter = new CryptoDeviceAdapter(createMockAccessors({}))
      const result = await adapter.getDevices('@alice:matrix.org')
      expect(result).toEqual([])
    })
  })

  describe('getDevice', () => {
    it('returns device from TrustManager when available', async () => {
      const trustInfo: IDeviceTrustInfo = {
        device_id: 'DEV1',
        user_id: '@alice:matrix.org',
        display_name: 'Alice Phone',
        trust_level: 'verified',
        last_seen_ts: 1700000000
      }
      const trustManager = {
        getDeviceTrust: vi.fn().mockResolvedValue(trustInfo)
      } as unknown as DeviceTrustManager
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ trustManager }))

      const result = await adapter.getDevice('@alice:matrix.org', 'DEV1')

      expect(result).toEqual({
        deviceId: 'DEV1',
        userId: '@alice:matrix.org',
        displayName: 'Alice Phone',
        lastSeenTs: 1700000000,
        isVerified: true
      })
    })

    it('returns null when TrustManager returns null', async () => {
      const trustManager = {
        getDeviceTrust: vi.fn().mockResolvedValue(null)
      } as unknown as DeviceTrustManager
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ trustManager }))
      const result = await adapter.getDevice('@alice:matrix.org', 'UNKNOWN')
      expect(result).toBeNull()
    })

    it('falls back to legacy getStoredDevice when no TrustManager', async () => {
      const legacyDevice: LegacyStoredDevice = {
        deviceId: 'DEV1',
        userId: '@alice:matrix.org',
        displayName: 'Laptop',
        isVerified: () => true,
        isUnverified: () => false
      }
      const client = { getStoredDevice: vi.fn().mockReturnValue(legacyDevice) }
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ client }))

      const result = await adapter.getDevice('@alice:matrix.org', 'DEV1')

      expect(result).toEqual({
        deviceId: 'DEV1',
        userId: '@alice:matrix.org',
        displayName: 'Laptop',
        isVerified: true
      })
    })

    it('returns null when legacy getStoredDevice returns null', async () => {
      const client = { getStoredDevice: vi.fn().mockReturnValue(null) }
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ client }))
      const result = await adapter.getDevice('@alice:matrix.org', 'MISSING')
      expect(result).toBeNull()
    })
  })

  describe('verifyDevice', () => {
    it('uses TrustManager requestVerification + respondToVerification', async () => {
      const trustManager = {
        requestVerification: vi.fn().mockResolvedValue({ token: 'verify-token' }),
        respondToVerification: vi.fn().mockResolvedValue(undefined)
      } as unknown as DeviceTrustManager
      const matrixClient = { getDeviceId: () => 'current-device' }
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ trustManager, matrixClient }))

      await adapter.verifyDevice('@alice:matrix.org', 'DEV1')

      expect(trustManager.requestVerification).toHaveBeenCalledWith({
        new_device_id: 'DEV1',
        device_id: 'current-device',
        method: 'sas'
      })
      expect(trustManager.respondToVerification).toHaveBeenCalledWith('verify-token', true)
    })

    it('falls back to CryptoApi.setDeviceVerified when no TrustManager', async () => {
      const crypto = { setDeviceVerified: vi.fn().mockResolvedValue(undefined) } as unknown as CryptoApi
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ crypto }))

      await adapter.verifyDevice('@alice:matrix.org', 'DEV1')

      expect(crypto.setDeviceVerified).toHaveBeenCalledWith('@alice:matrix.org', 'DEV1')
    })

    it('falls back to legacy client.setDeviceVerified when no TrustManager or CryptoApi', async () => {
      const client = { setDeviceVerified: vi.fn().mockResolvedValue(undefined) }
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ client }))

      await adapter.verifyDevice('@alice:matrix.org', 'DEV1')

      expect(client.setDeviceVerified).toHaveBeenCalledWith('@alice:matrix.org', 'DEV1')
    })
  })

  describe('unverifyDevice', () => {
    it('uses CryptoApi.setDeviceVerified with false', async () => {
      const crypto = { setDeviceVerified: vi.fn().mockResolvedValue(undefined) } as unknown as CryptoApi
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ crypto }))

      await adapter.unverifyDevice('@alice:matrix.org', 'DEV1')

      expect(crypto.setDeviceVerified).toHaveBeenCalledWith('@alice:matrix.org', 'DEV1', false)
    })

    it('falls back to legacy client.setDeviceVerified with false', async () => {
      const client = { setDeviceVerified: vi.fn().mockResolvedValue(undefined) }
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ client }))

      await adapter.unverifyDevice('@alice:matrix.org', 'DEV1')

      expect(client.setDeviceVerified).toHaveBeenCalledWith('@alice:matrix.org', 'DEV1', false)
    })
  })

  describe('getDeviceVerificationStatus', () => {
    it('returns status from CryptoApi when available', async () => {
      const crypto = {
        getDeviceVerificationStatus: vi.fn().mockResolvedValue({
          isVerified: () => true,
          crossSigningVerified: true
        })
      } as unknown as CryptoApi
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ crypto }))

      const result = await adapter.getDeviceVerificationStatus('@alice:matrix.org', 'DEV1')

      expect(result).toEqual({
        verified: true,
        crossSigningVerified: true,
        devicesCrossSigningVerified: true,
        tofu: false
      })
    })

    it('maps tofu from CryptoApi status', async () => {
      const crypto = {
        getDeviceVerificationStatus: vi.fn().mockResolvedValue({
          isVerified: () => true,
          crossSigningVerified: true,
          tofu: true
        })
      } as unknown as CryptoApi
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ crypto }))

      const result = await adapter.getDeviceVerificationStatus('@alice:matrix.org', 'DEV1')

      expect(result.tofu).toBe(true)
    })

    it('returns false status when CryptoApi returns null', async () => {
      const crypto = {
        getDeviceVerificationStatus: vi.fn().mockResolvedValue(null)
      } as unknown as CryptoApi
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ crypto }))

      const result = await adapter.getDeviceVerificationStatus('@alice:matrix.org', 'DEV1')

      expect(result).toEqual({
        verified: false,
        crossSigningVerified: false,
        devicesCrossSigningVerified: false,
        tofu: false
      })
    })

    it('falls back to legacy checkDeviceTrust when no CryptoApi', async () => {
      const client = {
        checkDeviceTrust: vi.fn().mockResolvedValue({
          isVerified: () => false,
          crossSigningVerified: false
        })
      }
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ client }))

      const result = await adapter.getDeviceVerificationStatus('@alice:matrix.org', 'DEV1')

      expect(result).toEqual({
        verified: false,
        crossSigningVerified: false,
        devicesCrossSigningVerified: false,
        tofu: false
      })
    })

    it('returns false status when neither CryptoApi nor legacy available', async () => {
      const adapter = new CryptoDeviceAdapter(createMockAccessors({}))
      const result = await adapter.getDeviceVerificationStatus('@alice:matrix.org', 'DEV1')
      expect(result).toEqual({
        verified: false,
        crossSigningVerified: false,
        devicesCrossSigningVerified: false,
        tofu: false
      })
    })
  })

  describe('requestDeviceVerification', () => {
    it('uses TrustManager and returns null when available', async () => {
      const trustManager = {
        requestVerification: vi.fn().mockResolvedValue({ token: 'req-token' })
      } as unknown as DeviceTrustManager
      const matrixClient = { getDeviceId: () => 'current-device' }
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ trustManager, matrixClient }))

      const result = await adapter.requestDeviceVerification('@alice:matrix.org', 'DEV1')

      expect(trustManager.requestVerification).toHaveBeenCalledWith({
        new_device_id: 'DEV1',
        device_id: 'current-device',
        method: 'sas'
      })
      expect(result).toBeNull()
    })

    it('uses CryptoApi.requestDeviceVerification when no TrustManager', async () => {
      const verificationRequest = { transactionId: 'tx-1' }
      const crypto = {
        requestDeviceVerification: vi.fn().mockResolvedValue(verificationRequest)
      } as unknown as CryptoApi
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ crypto }))

      const result = await adapter.requestDeviceVerification('@alice:matrix.org', 'DEV1')

      expect(crypto.requestDeviceVerification).toHaveBeenCalledWith('@alice:matrix.org', 'DEV1')
      expect(result).toBe(verificationRequest)
    })

    it('returns null when neither TrustManager nor CryptoApi available', async () => {
      const adapter = new CryptoDeviceAdapter(createMockAccessors({}))
      const result = await adapter.requestDeviceVerification('@alice:matrix.org', 'DEV1')
      expect(result).toBeNull()
    })
  })

  describe('blockDevice', () => {
    it('uses legacy client.setDeviceBlocked when available', async () => {
      const client = { setDeviceBlocked: vi.fn().mockResolvedValue(undefined) }
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ client }))

      await adapter.blockDevice('@alice:matrix.org', 'DEV1')

      expect(client.setDeviceBlocked).toHaveBeenCalledWith('@alice:matrix.org', 'DEV1', true)
    })

    it('falls back to CryptoApi.setDeviceVerified(false) when no legacy method', async () => {
      const crypto = { setDeviceVerified: vi.fn().mockResolvedValue(undefined) } as unknown as CryptoApi
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ crypto }))

      await adapter.blockDevice('@alice:matrix.org', 'DEV1')

      expect(crypto.setDeviceVerified).toHaveBeenCalledWith('@alice:matrix.org', 'DEV1', false)
    })
  })

  describe('unblockDevice', () => {
    it('uses legacy client.setDeviceBlocked(false) when available', async () => {
      const client = { setDeviceBlocked: vi.fn().mockResolvedValue(undefined) }
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ client }))

      await adapter.unblockDevice('@alice:matrix.org', 'DEV1')

      expect(client.setDeviceBlocked).toHaveBeenCalledWith('@alice:matrix.org', 'DEV1', false)
    })

    it('falls back to CryptoApi.setDeviceVerified(false) when no legacy method', async () => {
      const crypto = { setDeviceVerified: vi.fn().mockResolvedValue(undefined) } as unknown as CryptoApi
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ crypto }))

      await adapter.unblockDevice('@alice:matrix.org', 'DEV1')

      expect(crypto.setDeviceVerified).toHaveBeenCalledWith('@alice:matrix.org', 'DEV1', false)
    })
  })
})
