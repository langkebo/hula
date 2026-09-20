import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CryptoApi, SecureBackupManager } from '@/types/matrix-extensions'
import { CryptoSecurityAdapter } from '../CryptoSecurityAdapter'
import type { CryptoAdapterAccessors } from '../cryptoAdapterTypes'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() })
}))

/**
 * 契约回归：交叉签名公钥/密钥 ID 必须来自真实 SDK API。
 *
 * 历史缺陷：通过 `as unknown as { crossSigningInfo?: ... }` 读取 `crypto.crossSigningInfo`，
 * 该成员不在 `CryptoApi` 上（只存在于 crypto store 内部，且是 `private crossSigningIdentity`）。
 * 于是 masterPublicKey / selfSigningPublicKey / userSigningPublicKey **恒为 undefined**，
 * 弹窗永远把三把密钥显示为「缺失」，复制按钮复制出 `-`。
 *
 * 真实 API：`CryptoApi.getCrossSigningKeyId(type?: CrossSigningKey): Promise<string | null>`，
 * 返回已初始化交叉签名时该密钥的 ID。
 */

function makeAccessors(crypto: Partial<CryptoApi> | null): CryptoAdapterAccessors {
  return {
    getCrypto: () => crypto as CryptoApi | null,
    getExtendedClient: () => ({}) as never,
    getClient: () => ({}) as never,
    getDeviceTrustManager: () => null,
    getSecureBackupManager: () => null as SecureBackupManager | null,
    getKeyBackupManager: () => null,
    getSDKDeviceKeysManager: () => null,
    getSDKKeyBackupManager: () => null,
    getSDKKeyVerificationManager: () => null
  } as CryptoAdapterAccessors
}

describe('CryptoSecurityAdapter.getCrossSigningStatus 交叉签名密钥 ID', () => {
  beforeEach(() => vi.clearAllMocks())

  it('通过 getCrossSigningKeyId 取三把密钥的 ID', async () => {
    const getCrossSigningKeyId = vi.fn(async (type?: string) => {
      if (type === 'self_signing') return 'SELF_ID'
      if (type === 'user_signing') return 'USER_ID'
      return 'MASTER_ID'
    })
    const adapter = new CryptoSecurityAdapter(
      makeAccessors({
        getCrossSigningStatus: vi.fn(async () => ({
          publicKeysOnDevice: true,
          privateKeysInSecretStorage: true,
          privateKeysCachedLocally: { masterKey: true, selfSigningKey: true, userSigningKey: true }
        })),
        isCrossSigningReady: vi.fn(async () => true),
        getCrossSigningKeyId
      } as unknown as Partial<CryptoApi>)
    )

    const status = await adapter.getCrossSigningStatus()

    expect(getCrossSigningKeyId).toHaveBeenCalled()
    expect(status.masterPublicKey).toBe('MASTER_ID')
    expect(status.selfSigningPublicKey).toBe('SELF_ID')
    expect(status.userSigningPublicKey).toBe('USER_ID')
  })

  it('SDK 未提供密钥 ID 时为 null（而不是 undefined）', async () => {
    const adapter = new CryptoSecurityAdapter(
      makeAccessors({
        getCrossSigningStatus: vi.fn(async () => ({
          publicKeysOnDevice: false,
          privateKeysInSecretStorage: false,
          privateKeysCachedLocally: { masterKey: false, selfSigningKey: false, userSigningKey: false }
        })),
        isCrossSigningReady: vi.fn(async () => false),
        getCrossSigningKeyId: vi.fn(async () => null)
      } as unknown as Partial<CryptoApi>)
    )

    const status = await adapter.getCrossSigningStatus()

    expect(status.masterPublicKey).toBeNull()
    expect(status.selfSigningPublicKey).toBeNull()
    expect(status.userSigningPublicKey).toBeNull()
  })

  it('不再读取幻影成员 crossSigningInfo', async () => {
    const crypto = {
      getCrossSigningStatus: vi.fn(async () => ({
        publicKeysOnDevice: true,
        privateKeysInSecretStorage: true,
        privateKeysCachedLocally: { masterKey: true, selfSigningKey: true, userSigningKey: true }
      })),
      isCrossSigningReady: vi.fn(async () => true),
      getCrossSigningKeyId: vi.fn(async () => 'REAL_ID'),
      // 故意提供幻影成员：若实现仍读它，会拿到 PHANTOM 而不是 REAL_ID
      crossSigningInfo: { getId: vi.fn(() => 'PHANTOM') }
    }
    const adapter = new CryptoSecurityAdapter(makeAccessors(crypto as unknown as Partial<CryptoApi>))

    const status = await adapter.getCrossSigningStatus()

    expect(status.masterPublicKey).toBe('REAL_ID')
  })
})
