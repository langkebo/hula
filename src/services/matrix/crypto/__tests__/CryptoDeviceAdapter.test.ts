import { describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'
import type { CryptoApi, MatrixClientExtended } from '@/types/matrix-extensions'
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
    getSecureBackupManager: () => null,
    getKeyBackupManager: () => null,
    getSDKDeviceKeysManager: () => (opts.sdkDeviceKeysManager ?? null) as never,
    getSDKKeyBackupManager: () => null
  } as CryptoAdapterAccessors
}

/** `keys/query` 的 device_keys 形状：deviceId → DeviceKeys */
function makeDeviceKeysManager(deviceKeys: Record<string, unknown>) {
  return { getUserDevices: vi.fn().mockResolvedValue(deviceKeys) }
}

/**
 * 造一个只回答「某设备是否已验证」的 CryptoApi。
 *
 * 设备验证状态的权威来源是本机 crypto store（`CryptoApi.getDeviceVerificationStatus`），
 * 不是后端 HTTP：`GET /device_trust` 已随后端模块一并删除，调用必然 404。
 */
function makeVerificationCrypto(verifiedDeviceIds: string[], opts: { throw?: boolean } = {}): CryptoApi {
  return {
    getDeviceVerificationStatus: vi.fn(async (_userId: string, deviceId: string) => {
      if (opts.throw) throw new Error('crypto store unavailable')
      return { isVerified: () => verifiedDeviceIds.includes(deviceId), crossSigningVerified: false, tofu: false }
    })
  } as unknown as CryptoApi
}

describe('CryptoDeviceAdapter', () => {
  describe('getDevices', () => {
    it('sources devices from keys/query and takes isVerified from CryptoApi', async () => {
      // keys/query 是唯一能查他人设备的地方；验证状态来自本机 crypto store。
      const sdkDeviceKeysManager = makeDeviceKeysManager({
        DEV1: { device_id: 'DEV1', unsigned: { device_display_name: 'Alice Phone' } },
        DEV2: { device_id: 'DEV2' }
      })
      const crypto = makeVerificationCrypto(['DEV1'])
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ crypto, sdkDeviceKeysManager }))

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

    it('设备来源只认 keys/query，缺它时显式失败', async () => {
      // 回归守卫：旧实现按 `d.user_id === userId` 过滤后端信任列表，
      // 但该列表既没有 user_id 也仅覆盖本人设备 —— 好友设备列表会恒为空。
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ crypto: makeVerificationCrypto([]) }))

      await expect(adapter.getDevices('@alice:matrix.org')).rejects.toThrow(/DeviceKeysManager/)
    })

    it('无 DeviceKeysManager 时显式失败，而不是谎称「没有设备」', async () => {
      // 历史缺陷：曾用不存在的 client.getStoredDevicesForUser 兜底并 return []，
      // 让「能力缺失」看起来像「该用户没有设备」。
      const adapter = new CryptoDeviceAdapter(createMockAccessors({}))

      await expect(adapter.getDevices('@alice:matrix.org')).rejects.toThrow(/DeviceKeysManager/)
    })

    it('无 CryptoApi 时按未验证处理，而不是谎称已验证', async () => {
      const sdkDeviceKeysManager = makeDeviceKeysManager({ DEV1: { device_id: 'DEV1' } })
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ sdkDeviceKeysManager }))

      const result = await adapter.getDevices('@alice:matrix.org')

      expect(result).toEqual([
        { deviceId: 'DEV1', userId: '@alice:matrix.org', displayName: undefined, isVerified: false }
      ])
    })

    it('CryptoApi 查询抛错时按未验证处理，不冒泡打断整个列表', async () => {
      const sdkDeviceKeysManager = makeDeviceKeysManager({ DEV1: { device_id: 'DEV1' } })
      const crypto = makeVerificationCrypto([], { throw: true })
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ crypto, sdkDeviceKeysManager }))

      const result = await adapter.getDevices('@alice:matrix.org')

      expect(result[0]?.isVerified).toBe(false)
    })
  })

  describe('getDevice', () => {
    it('sources the device from keys/query and takes isVerified from CryptoApi', async () => {
      const sdkDeviceKeysManager = makeDeviceKeysManager({
        DEV1: { device_id: 'DEV1', unsigned: { device_display_name: 'Alice Phone' } }
      })
      const crypto = makeVerificationCrypto(['DEV1'])
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ crypto, sdkDeviceKeysManager }))

      const result = await adapter.getDevice('@alice:matrix.org', 'DEV1')

      expect(result).toEqual({
        deviceId: 'DEV1',
        userId: '@alice:matrix.org',
        displayName: 'Alice Phone',
        isVerified: true
      })
    })

    it('returns null when the device is unknown to keys/query', async () => {
      const sdkDeviceKeysManager = makeDeviceKeysManager({})
      const adapter = new CryptoDeviceAdapter(
        createMockAccessors({ crypto: makeVerificationCrypto([]), sdkDeviceKeysManager })
      )
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
    it('marks the device verified through CryptoApi.setDeviceVerified', async () => {
      const crypto = { setDeviceVerified: vi.fn().mockResolvedValue(undefined) } as unknown as CryptoApi
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ crypto }))

      await adapter.verifyDevice('@alice:matrix.org', 'DEV1')

      expect(crypto.setDeviceVerified).toHaveBeenCalledWith('@alice:matrix.org', 'DEV1')
    })

    it('无 CryptoApi 时显式失败，而不是静默什么都不做', async () => {
      const adapter = new CryptoDeviceAdapter(createMockAccessors({}))

      await expect(adapter.verifyDevice('@alice:matrix.org', 'DEV1')).rejects.toThrow(/CryptoApi/)
    })
  })

  describe('unverifyDevice', () => {
    it('uses CryptoApi.setDeviceVerified with false', async () => {
      const crypto = { setDeviceVerified: vi.fn().mockResolvedValue(undefined) } as unknown as CryptoApi
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ crypto }))

      await adapter.unverifyDevice('@alice:matrix.org', 'DEV1')

      expect(crypto.setDeviceVerified).toHaveBeenCalledWith('@alice:matrix.org', 'DEV1', false)
    })

    it('无 CryptoApi 时显式失败', async () => {
      const adapter = new CryptoDeviceAdapter(createMockAccessors({}))

      await expect(adapter.unverifyDevice('@alice:matrix.org', 'DEV1')).rejects.toThrow(/CryptoApi/)
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
    it('delegates to CryptoApi.requestDeviceVerification', async () => {
      const verificationRequest = { transactionId: 'tx-1' }
      const crypto = {
        requestDeviceVerification: vi.fn().mockResolvedValue(verificationRequest)
      } as unknown as CryptoApi
      const adapter = new CryptoDeviceAdapter(createMockAccessors({ crypto }))

      const result = await adapter.requestDeviceVerification('@alice:matrix.org', 'DEV1')

      expect(crypto.requestDeviceVerification).toHaveBeenCalledWith('@alice:matrix.org', 'DEV1')
      expect(result).toBe(verificationRequest)
    })

    it('returns null when CryptoApi is unavailable', async () => {
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
