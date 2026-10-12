import { describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'
import type { CryptoApi, MatrixClientExtended } from '@/types/matrix-extensions'
import { CryptoSecurityAdapter } from '../CryptoSecurityAdapter'
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
}): CryptoAdapterAccessors {
  const client = (opts.client ?? {}) as MatrixClientExtended
  const matrixClient = (opts.matrixClient ?? { getUserId: () => '@alice:matrix.org' }) as MatrixClient
  return {
    getCrypto: () => opts.crypto ?? null,
    getExtendedClient: () => client,
    getClient: () => matrixClient,
    getSecureBackupManager: () => null,
    getKeyBackupManager: () => null,
    getSDKDeviceKeysManager: () => null,
    getSDKKeyBackupManager: () => null
  } as CryptoAdapterAccessors
}

describe('CryptoSecurityAdapter', () => {
  describe('getCrossSigningStatus', () => {
    it('returns all-false defaults when no CryptoApi', async () => {
      const adapter = new CryptoSecurityAdapter(createMockAccessors({}))
      await expect(adapter.getCrossSigningStatus()).resolves.toEqual({
        privateKeysCached: false,
        crossSigningVerified: false,
        isSetup: false,
        publicKeysOnDevice: false,
        privateKeysInSecretStorage: false,
        privateKeysCachedLocally: false
      })
    })

    it('returns full status with keys and public keys', async () => {
      // 真实 API 是 getCrossSigningKeyId（不是幻影 crossSigningInfo.getId）
      const crypto = {
        getCrossSigningStatus: vi.fn().mockResolvedValue({
          publicKeysOnDevice: true,
          privateKeysInSecretStorage: true,
          privateKeysCachedLocally: { masterKey: true, selfSigningKey: true, userSigningKey: true }
        }),
        isCrossSigningReady: vi.fn().mockResolvedValue(true),
        getCrossSigningKeyId: vi.fn(async (type?: string) => {
          if (type === 'self_signing') return 'self-pub'
          if (type === 'user_signing') return 'user-pub'
          return 'master-pub'
        })
      } as unknown as CryptoApi
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto }))

      const result = await adapter.getCrossSigningStatus()

      expect(result).toEqual({
        privateKeysCached: true,
        crossSigningVerified: true,
        isSetup: true,
        publicKeysOnDevice: true,
        privateKeysInSecretStorage: true,
        privateKeysCachedLocally: true,
        masterPublicKey: 'master-pub',
        selfSigningPublicKey: 'self-pub',
        userSigningPublicKey: 'user-pub'
      })
    })

    it('在交叉签名未初始化时把密钥 ID 返回为 null', async () => {
      const crypto = {
        getCrossSigningStatus: vi.fn().mockResolvedValue({
          publicKeysOnDevice: false,
          privateKeysInSecretStorage: false,
          privateKeysCachedLocally: { masterKey: false, selfSigningKey: false, userSigningKey: false }
        }),
        isCrossSigningReady: vi.fn().mockResolvedValue(false)
      } as unknown as CryptoApi
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto }))

      const result = await adapter.getCrossSigningStatus()

      expect(result.privateKeysCached).toBe(false)
      expect(result.crossSigningVerified).toBe(false)
      expect(result.isSetup).toBe(false)
      expect(result.publicKeysOnDevice).toBe(false)
      expect(result.privateKeysCachedLocally).toBe(false)
      // SDK 未提供该能力时为 null（明确语义），而不是 undefined
      expect(result.masterPublicKey).toBeNull()
      expect(result.selfSigningPublicKey).toBeNull()
      expect(result.userSigningPublicKey).toBeNull()
    })

    it('degrades gracefully when both crypto calls throw', async () => {
      const crypto = {
        getCrossSigningStatus: vi.fn().mockRejectedValue(new Error('get failed')),
        isCrossSigningReady: vi.fn().mockRejectedValue(new Error('ready failed'))
      } as unknown as CryptoApi
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto }))

      const result = await adapter.getCrossSigningStatus()

      expect(result.privateKeysCached).toBe(false)
      expect(result.crossSigningVerified).toBe(false)
      expect(result.isSetup).toBe(false)
      expect(result.publicKeysOnDevice).toBe(false)
      expect(result.privateKeysInSecretStorage).toBe(false)
      expect(result.privateKeysCachedLocally).toBe(false)
    })

    /**
     * R-2（2026-10-12）：把 SDK 的三个**互相独立**的事实分别暴露。
     *
     * 历史实现只取 `privateKeysInSecretStorage` 并命名为 `privateKeysCached`，
     * 于是「已建立交叉签名但私钥未入 4S」与「从未建立交叉签名」对消费方完全同形，
     * UI 也就无法给出「立即存入密钥存储」这类可操作提示。
     */
    it('R-2：私钥只在本机（已建立交叉签名但未入 4S）必须可区分', async () => {
      const crypto = {
        getCrossSigningStatus: vi.fn().mockResolvedValue({
          publicKeysOnDevice: true,
          privateKeysInSecretStorage: false,
          privateKeysCachedLocally: { masterKey: true, selfSigningKey: true, userSigningKey: false }
        }),
        isCrossSigningReady: vi.fn().mockResolvedValue(true)
      } as unknown as CryptoApi
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto }))

      const result = await adapter.getCrossSigningStatus()

      expect(result.publicKeysOnDevice).toBe(true)
      expect(result.privateKeysInSecretStorage).toBe(false)
      // 逐密钥布尔按「任一为真」聚合
      expect(result.privateKeysCachedLocally).toBe(true)
      // 兼容字段仍跟随 4S 标记（语义未变，避免影响既有消费方）
      expect(result.privateKeysCached).toBe(false)
      expect(result.isSetup).toBe(false)
    })

    it('R-2：三把私钥都不在本机时聚合为 false', async () => {
      const crypto = {
        getCrossSigningStatus: vi.fn().mockResolvedValue({
          publicKeysOnDevice: true,
          privateKeysInSecretStorage: false,
          privateKeysCachedLocally: { masterKey: false, selfSigningKey: false, userSigningKey: false }
        }),
        isCrossSigningReady: vi.fn().mockResolvedValue(false)
      } as unknown as CryptoApi
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto }))

      await expect(adapter.getCrossSigningStatus()).resolves.toMatchObject({
        privateKeysCachedLocally: false
      })
    })

    it('R-2：SDK 未提供 privateKeysCachedLocally 时按 false 处理（不抛错）', async () => {
      const crypto = {
        getCrossSigningStatus: vi.fn().mockResolvedValue({ privateKeysInSecretStorage: false }),
        isCrossSigningReady: vi.fn().mockResolvedValue(false)
      } as unknown as CryptoApi
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto }))

      const result = await adapter.getCrossSigningStatus()

      expect(result.publicKeysOnDevice).toBe(false)
      expect(result.privateKeysCachedLocally).toBe(false)
    })
  })

  describe('R-2 isSecretStorageReady', () => {
    it('就绪时返回 true', async () => {
      const crypto = { isSecretStorageReady: vi.fn().mockResolvedValue(true) } as unknown as CryptoApi
      await expect(new CryptoSecurityAdapter(createMockAccessors({ crypto })).isSecretStorageReady()).resolves.toBe(
        true
      )
    })

    it('crypto 缺失 / 成员缺失 / 抛错 一律 false（fail-closed，不假定就绪）', async () => {
      await expect(new CryptoSecurityAdapter(createMockAccessors({})).isSecretStorageReady()).resolves.toBe(false)

      const noMember = { isCrossSigningReady: vi.fn() } as unknown as CryptoApi
      await expect(
        new CryptoSecurityAdapter(createMockAccessors({ crypto: noMember })).isSecretStorageReady()
      ).resolves.toBe(false)

      const throwing = { isSecretStorageReady: vi.fn().mockRejectedValue(new Error('x')) } as unknown as CryptoApi
      await expect(
        new CryptoSecurityAdapter(createMockAccessors({ crypto: throwing })).isSecretStorageReady()
      ).resolves.toBe(false)
    })
  })

  describe('R-2 storeCrossSigningKeysInSecretStorage（把已知私钥补存进既有 4S）', () => {
    function cryptoWith(opts: {
      ready: boolean
      alreadyStored?: boolean
      bootstrap?: ReturnType<typeof vi.fn>
    }): CryptoApi {
      return {
        isSecretStorageReady: vi.fn().mockResolvedValue(opts.ready),
        getCrossSigningStatus: vi.fn().mockResolvedValue({ privateKeysInSecretStorage: opts.alreadyStored ?? false }),
        bootstrapSecretStorage: opts.bootstrap ?? vi.fn().mockResolvedValue(undefined)
      } as unknown as CryptoApi
    }

    it('4S 未就绪 ⇒ needs-setup，且**绝不**调用 bootstrapSecretStorage（否则会新建用户从未见过的 4S 密钥）', async () => {
      const bootstrapSecretStorage = vi.fn().mockResolvedValue(undefined)
      const crypto = cryptoWith({ ready: false, bootstrap: bootstrapSecretStorage })
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto }))

      await expect(adapter.storeCrossSigningKeysInSecretStorage()).resolves.toBe('needs-setup')
      expect(bootstrapSecretStorage).not.toHaveBeenCalled()
    })

    it('4S 就绪且私钥尚未存入 ⇒ stored，且以空参数调用（不得传 setupNewSecretStorage / createSecretStorageKey）', async () => {
      const bootstrapSecretStorage = vi.fn().mockResolvedValue(undefined)
      const crypto = cryptoWith({ ready: true, alreadyStored: false, bootstrap: bootstrapSecretStorage })
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto }))

      await expect(adapter.storeCrossSigningKeysInSecretStorage()).resolves.toBe('stored')
      expect(bootstrapSecretStorage).toHaveBeenCalledWith({})
    })

    it('4S 就绪且已存过 ⇒ already-stored（幂等，不谎报「刚存入」）', async () => {
      const crypto = cryptoWith({ ready: true, alreadyStored: true })
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto }))

      await expect(adapter.storeCrossSigningKeysInSecretStorage()).resolves.toBe('already-stored')
    })

    it('写入抛错 ⇒ failed（不得伪装成功）', async () => {
      const crypto = cryptoWith({ ready: true, bootstrap: vi.fn().mockRejectedValue(new Error('boom')) })
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto }))

      await expect(adapter.storeCrossSigningKeysInSecretStorage()).resolves.toBe('failed')
    })

    it('crypto 不可用 ⇒ failed', async () => {
      const adapter = new CryptoSecurityAdapter(createMockAccessors({}))
      await expect(adapter.storeCrossSigningKeysInSecretStorage()).resolves.toBe('failed')
    })
  })

  describe('isCrossSigningReady', () => {
    it('returns true when client reports ready', async () => {
      const client = { isCrossSigningReady: vi.fn().mockResolvedValue(true) }
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ client }))
      await expect(adapter.isCrossSigningReady()).resolves.toBe(true)
    })

    it('returns false when method is absent', async () => {
      const adapter = new CryptoSecurityAdapter(createMockAccessors({}))
      await expect(adapter.isCrossSigningReady()).resolves.toBe(false)
    })

    it('returns false when method throws synchronously', async () => {
      const client = {
        isCrossSigningReady: () => {
          throw new Error('boom')
        }
      }
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ client }))
      await expect(adapter.isCrossSigningReady()).resolves.toBe(false)
    })
  })

  describe('setupCrossSigning', () => {
    function captureBootstrap(
      bootstrapCrossSigningMock: ReturnType<typeof vi.fn>
    ): (makeRequest: (authData: unknown) => Promise<unknown>) => Promise<unknown> {
      let captured: {
        authUploadDeviceSigningKeys: (makeRequest: (authData: unknown) => Promise<unknown>) => Promise<unknown>
      } | null = null
      bootstrapCrossSigningMock.mockImplementation(async (param: unknown) => {
        captured = param as {
          authUploadDeviceSigningKeys: (makeRequest: (authData: unknown) => Promise<unknown>) => Promise<unknown>
        }
      })
      const getCallback = () => {
        if (!captured) throw new Error('bootstrapCrossSigning was not invoked')
        return captured.authUploadDeviceSigningKeys
      }
      return (makeRequest) => getCallback()(makeRequest)
    }

    it('throws when no CryptoApi is available', async () => {
      const adapter = new CryptoSecurityAdapter(createMockAccessors({}))
      await expect(adapter.setupCrossSigning({ password: 'secret' })).rejects.toThrow('CryptoApi 不可用')
    })

    it('builds password auth data and calls makeRequest', async () => {
      const makeRequest = vi.fn().mockResolvedValue({ success: true })
      const bootstrapCrossSigning = vi.fn()
      const invokeAuth = captureBootstrap(bootstrapCrossSigning)
      const crypto = { bootstrapCrossSigning } as unknown as CryptoApi
      const matrixClient = { getUserId: () => '@alice:matrix.org' }
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto, matrixClient }))

      await adapter.setupCrossSigning({ password: ' secret ' })
      await invokeAuth(makeRequest)

      expect(bootstrapCrossSigning).toHaveBeenCalled()
      expect(makeRequest).toHaveBeenCalledWith({
        type: 'm.login.password',
        user: '@alice:matrix.org',
        password: 'secret'
      })
    })

    it('throws when no password and no authData are provided', async () => {
      const makeRequest = vi.fn()
      const bootstrapCrossSigning = vi.fn()
      const invokeAuth = captureBootstrap(bootstrapCrossSigning)
      const crypto = { bootstrapCrossSigning } as unknown as CryptoApi
      const matrixClient = { getUserId: () => '@alice:matrix.org' }
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto, matrixClient }))

      await adapter.setupCrossSigning()
      await expect(invokeAuth(makeRequest)).rejects.toThrow('需要认证参数')
      expect(makeRequest).not.toHaveBeenCalled()
    })

    it('uses provided authData directly', async () => {
      const makeRequest = vi.fn().mockResolvedValue({ success: true })
      const bootstrapCrossSigning = vi.fn()
      const invokeAuth = captureBootstrap(bootstrapCrossSigning)
      const crypto = { bootstrapCrossSigning } as unknown as CryptoApi
      const matrixClient = { getUserId: () => '@alice:matrix.org' }
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto, matrixClient }))

      const authData = { type: 'm.login.token', token: 'abc' }
      await adapter.setupCrossSigning({ authData })
      await invokeAuth(makeRequest)

      expect(makeRequest).toHaveBeenCalledWith(authData)
    })

    it('retries with session when UIA error provides one', async () => {
      const makeRequest = vi
        .fn()
        .mockRejectedValueOnce({ data: { session: 'sess-1' } })
        .mockResolvedValueOnce({ success: true })
      const bootstrapCrossSigning = vi.fn()
      const invokeAuth = captureBootstrap(bootstrapCrossSigning)
      const crypto = { bootstrapCrossSigning } as unknown as CryptoApi
      const matrixClient = { getUserId: () => '@alice:matrix.org' }
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto, matrixClient }))

      await adapter.setupCrossSigning({ password: 'secret' })
      await invokeAuth(makeRequest)

      expect(makeRequest).toHaveBeenNthCalledWith(1, {
        type: 'm.login.password',
        user: '@alice:matrix.org',
        password: 'secret'
      })
      expect(makeRequest).toHaveBeenNthCalledWith(2, {
        type: 'm.login.password',
        user: '@alice:matrix.org',
        password: 'secret',
        session: 'sess-1'
      })
    })

    it('rethrows UIA error when session is already present', async () => {
      const makeRequest = vi.fn().mockRejectedValueOnce({ data: { session: 'existing' } })
      const bootstrapCrossSigning = vi.fn()
      const invokeAuth = captureBootstrap(bootstrapCrossSigning)
      const crypto = { bootstrapCrossSigning } as unknown as CryptoApi
      const matrixClient = { getUserId: () => '@alice:matrix.org' }
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto, matrixClient }))

      const baseAuthData = {
        type: 'm.login.password',
        user: '@alice:matrix.org',
        password: 'secret',
        session: 'existing'
      }
      await adapter.setupCrossSigning({ authData: baseAuthData })
      await expect(invokeAuth(makeRequest)).rejects.toEqual({ data: { session: 'existing' } })
      expect(makeRequest).toHaveBeenCalledTimes(1)
    })
  })
})
