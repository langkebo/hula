import { describe, expect, it, vi } from 'vitest'
import type { CryptoApi, MatrixClientExtended } from '@/types/matrix-extensions'
import { CryptoDeviceAdapter } from '../CryptoDeviceAdapter'
import type { CryptoAdapterAccessors } from '../cryptoAdapterTypes'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() })
}))

/**
 * 安全回归：屏蔽设备不得静默降级为"取消验证"。
 *
 * 历史缺陷（V9）：`blockDevice` 先探测 `client.setDeviceBlocked`，但该方法在
 * vendored matrix-js-sdk 中**不存在**（全仓 0 命中，只有本地自造类型声称有）。
 * 探测恒为 false 后落入 `crypto.setDeviceVerified(userId, deviceId, false)` 分支，
 * 于是"屏蔽一台不可信设备"实际只是把它标成未验证——设备仍可正常参与加密通信，
 * 而 UI 却告诉用户已屏蔽。
 *
 * 真实能力：`DeviceTrustManager` 只有只读的 `isDeviceBlocked(deviceId)`，
 * 没有任何写入 API。因此正确行为是显式失败，绝不静默降级。
 */

function makeAccessors(opts: { client?: Partial<MatrixClientExtended>; crypto?: Partial<CryptoApi> | null }) {
  return {
    getCrypto: () => (opts.crypto ?? null) as CryptoApi | null,
    getExtendedClient: () => (opts.client ?? {}) as MatrixClientExtended,
    getClient: () => ({}) as never,
    getDeviceTrustManager: () => null,
    getSecureBackupManager: () => null,
    getKeyBackupManager: () => null,
    getSDKDeviceKeysManager: () => null,
    getSDKKeyBackupManager: () => null,
    getSDKKeyVerificationManager: () => null
  } as CryptoAdapterAccessors
}

describe('CryptoDeviceAdapter 屏蔽能力', () => {
  it('blockDevice 显式失败，绝不把「屏蔽」降级成「取消验证」', async () => {
    const setDeviceVerified = vi.fn().mockResolvedValue(undefined)
    const adapter = new CryptoDeviceAdapter(makeAccessors({ crypto: { setDeviceVerified } }))

    await expect(adapter.blockDevice('@alice:matrix.org', 'DEV1')).rejects.toThrow(/屏蔽/)

    // 关键断言：不得退化成取消验证
    expect(setDeviceVerified).not.toHaveBeenCalled()
  })

  it('unblockDevice 显式失败，不得谎称已取消屏蔽', async () => {
    const setDeviceVerified = vi.fn().mockResolvedValue(undefined)
    const adapter = new CryptoDeviceAdapter(makeAccessors({ crypto: { setDeviceVerified } }))

    await expect(adapter.unblockDevice('@alice:matrix.org', 'DEV1')).rejects.toThrow(/取消屏蔽|屏蔽/)

    expect(setDeviceVerified).not.toHaveBeenCalled()
  })

  it('即使 client 上存在同名方法也不使用（幻影契约不得复活）', async () => {
    const setDeviceBlocked = vi.fn().mockResolvedValue(undefined)
    const adapter = new CryptoDeviceAdapter(
      makeAccessors({ client: { setDeviceBlocked } as unknown as Partial<MatrixClientExtended> })
    )

    await expect(adapter.blockDevice('@alice:matrix.org', 'DEV1')).rejects.toThrow()
    expect(setDeviceBlocked).not.toHaveBeenCalled()
  })
})
