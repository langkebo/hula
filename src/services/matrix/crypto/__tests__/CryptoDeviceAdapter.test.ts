import { describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'
import type { CryptoApi, DeviceTrustManager, MatrixClientExtended } from '@/types/matrix-extensions'
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
  sdkDeviceKeysManager?: unknown
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
    getSDKDeviceKeysManager: () => (opts.sdkDeviceKeysManager ?? null) as never,
    getSDKKeyBackupManager: () => null,
    getSDKKeyVerificationManager: () => null
  } as CryptoAdapterAccessors
}

/** `keys/query` 的 device_keys 形状：deviceId → DeviceKeys */
function makeDeviceKeysManager(deviceKeys: Record<string, unknown>) {
  return { getUserDevices: vi.fn().mockResolvedValue(deviceKeys) }
}

describe('CryptoDeviceAdapter', () => {
  describe('getDevices', () => {
    it('sources devices from keys/query and enriches isVerified from the trust list', async () => {
      // keys/query 是唯一能查他人设备的地方；信任列表只提供 trust_level。
      const sdkDeviceKeysManager = makeDeviceKeysManager({
        DEV1: { device_id: 'DEV1', unsigned: { device_display_name: 'Alice Phone' } },
        DEV2: { device_id: 'DEV2' }
      })
      const trustManager = {
        getDeviceTrustList: vi.fn().mockResolvedValue([
          { device_id: 'DEV1', trust_level: 'verified' },
          { device_id: 'DEV2', trust_level: 'unverified' }
        ])
      } as unknown as DeviceTrustManager
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ trustManager, sdkDeviceKeysManager }))

      const result = await adapter.getDevices('@alice:matrix.org')

      expect(sdkDeviceKeysManager.getUserDevices).toHaveBeenCalledWith('@alice:matrix.org')
      expect(result).toEqual([
        {
          deviceId: 'DEV1',
          userId: '@alice:matrix.org',
          displayName: 'Alice Phone',
          isVerified: true
        },
        {
          deviceId: 'DEV2',
          userId: '@alice:matrix.org',
          displayName: undefined,
          isVerified: false
        }
      ])
    })

    it('does NOT use GET /device_trust as a device source (it has no user_id and is caller-scoped)', async () => {
      // 回归守卫：旧实现按 `d.user_id === userId` 过滤信任列表，
      // 但后端 `devices.rs::get_device_trust_list` 只返回
      // {device_id, trust_level, verified_at, verified_by} —— 好友设备列表恒为空。
      const trustManager = {
        getDeviceTrustList: vi.fn().mockResolvedValue([{ device_id: 'DEV1', trust_level: 'verified' }])
      } as unknown as DeviceTrustManager
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ trustManager }))

      // 没有 keys/query 能力时显式失败，绝不退化成「用 device_trust 列表当设备来源」
      await expect(adapter.getDevices('@alice:matrix.org')).rejects.toThrow(/DeviceKeysManager/)
    })

    it('无 DeviceKeysManager 时显式失败，而不是谎称「没有设备」', async () => {
      // 历史缺陷：曾用不存在的 client.getStoredDevicesForUser 兜底并 return []，
      // 让「能力缺失」看起来像「该用户没有设备」。
      const adapter = new CryptoDeviceAdapter(createMockAccessors({}))

      await expect(adapter.getDevices('@alice:matrix.org')).rejects.toThrow(/DeviceKeysManager/)
    })
  })

  describe('getDevice', () => {
    it('sources the device from keys/query and takes trust from the trust list', async () => {
      const sdkDeviceKeysManager = makeDeviceKeysManager({
        DEV1: { device_id: 'DEV1', unsigned: { device_display_name: 'Alice Phone' } }
      })
      const trustManager = {
        getDeviceTrustList: vi.fn().mockResolvedValue([{ device_id: 'DEV1', trust_level: 'verified' }])
      } as unknown as DeviceTrustManager
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ trustManager, sdkDeviceKeysManager }))

      const result = await adapter.getDevice('@alice:matrix.org', 'DEV1')

      expect(result).toEqual({
        deviceId: 'DEV1',
        userId: '@alice:matrix.org',
        displayName: 'Alice Phone',
        isVerified: true
      })
    })

    it('falls back to DeviceTrustManager.getDeviceTrust without inventing display_name/user_id', async () => {
      // 后端 `GET /device_trust/{device_id}` 只返回
      // {device_id, trust_level, verified_at, verified_by}；user_id 由调用方提供。
      const trustManager = {
        getDeviceTrust: vi.fn().mockResolvedValue({ device_id: 'DEV1', trust_level: 'verified' })
      } as unknown as DeviceTrustManager
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ trustManager }))

      const result = await adapter.getDevice('@alice:matrix.org', 'DEV1')

      expect(result).toEqual({
        deviceId: 'DEV1',
        userId: '@alice:matrix.org',
        isVerified: true
      })
      expect(result).not.toHaveProperty('displayName')
      expect(result).not.toHaveProperty('lastSeenTs')
    })

    it('returns null when the device is unknown to keys/query and to the trust manager', async () => {
      const sdkDeviceKeysManager = makeDeviceKeysManager({})
      const trustManager = {
        getDeviceTrust: vi.fn().mockResolvedValue(null)
      } as unknown as DeviceTrustManager
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ trustManager, sdkDeviceKeysManager }))
      const result = await adapter.getDevice('@alice:matrix.org', 'UNKNOWN')
      expect(result).toBeNull()
    })

    it('无 DeviceKeysManager 时 getDevice 返回 null，且不再依赖幻影 getStoredDevice', async () => {
      // 历史缺陷：曾用不存在的 client.getStoredDevice 兜底。
      const client = { getStoredDevice: vi.fn() } as unknown as Partial<MatrixClientExtended>
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ client }))

      const result = await adapter.getDevice('@alice:matrix.org', 'DEV1')

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

    it('无 CryptoApi 时显式失败，而不是恒返回「全部未验证」', async () => {
      // 历史缺陷：曾用不存在的 client.checkDeviceTrust 兜底并恒返回「全部 false」，
      // 使所有设备被显示为未验证。现在必须显式失败，让上层区分「查询失败」与「确实未验证」。
      const adapter = new CryptoDeviceAdapter(createMockAccessors({}))

      await expect(adapter.getDeviceVerificationStatus('@alice:matrix.org', 'DEV1')).rejects.toThrow(/CryptoApi/)
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

  // 屏蔽/取消屏蔽的契约由 CryptoDeviceAdapter.block.test.ts 覆盖：
  // SDK 无写入 API，必须显式失败而不是降级为「取消验证」。
  describe('blockDevice / unblockDevice 已不再伪实现', () => {
    it('两种操作都显式失败', async () => {
      const adapter = new CryptoDeviceAdapter(createMockAccessors({}))
      await expect(adapter.blockDevice('@alice:matrix.org', 'DEV1')).rejects.toThrow(/不支持屏蔽/)
      await expect(adapter.unblockDevice('@alice:matrix.org', 'DEV1')).rejects.toThrow(/不支持/)
    })
  })
})
