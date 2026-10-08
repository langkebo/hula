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
        isSetup: false
      })
    })

    it('returns full status with keys and public keys', async () => {
      // 真实 API 是 getCrossSigningKeyId（不是幻影 crossSigningInfo.getId）
      const crypto = {
        getCrossSigningStatus: vi.fn().mockResolvedValue({ privateKeysInSecretStorage: true }),
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
        masterPublicKey: 'master-pub',
        selfSigningPublicKey: 'self-pub',
        userSigningPublicKey: 'user-pub'
      })
    })

    it('在交叉签名未初始化时把密钥 ID 返回为 null', async () => {
      const crypto = {
        getCrossSigningStatus: vi.fn().mockResolvedValue({ privateKeysInSecretStorage: false }),
        isCrossSigningReady: vi.fn().mockResolvedValue(false)
      } as unknown as CryptoApi
      const adapter = new CryptoSecurityAdapter(createMockAccessors({ crypto }))

      const result = await adapter.getCrossSigningStatus()

      expect(result.privateKeysCached).toBe(false)
      expect(result.crossSigningVerified).toBe(false)
      expect(result.isSetup).toBe(false)
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
