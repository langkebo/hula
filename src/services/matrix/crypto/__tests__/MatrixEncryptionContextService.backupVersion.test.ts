import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'
import matrixClientService from '../../MatrixClientService'
import { matrixEncryptionContextService } from '../MatrixEncryptionContextService'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() })
}))

/**
 * 幻影契约回归：不得调用 SDK 中不存在的 prepareKeyBackupVersion。
 *
 * 历史缺陷（F-11）：`prepareKeyBackupVersion` 在 `KeyBackupManager` 与 `CryptoApi`
 * 上都不存在（只有本仓自造类型声称有），且调用点全部用了 `?.` 可选链，
 * 于是恒返回 null。移动端"启用备份"因此在第 346 行必然走 `if (!preparedBackup)`
 * 分支，只弹一个"已禁用"提示——功能完全不可用且无任何报错。
 *
 * 正确机制：SDK 的 `CryptoApi.resetKeyBackup()` 一步完成"生成备份密钥 → 存入 SSSS →
 * 创建新备份版本 → 启用备份引擎"，无需手工准备 auth_data。
 */

describe('MatrixEncryptionContextService 备份版本创建', () => {
  let mockCrypto: { resetKeyBackup: ReturnType<typeof vi.fn> }
  let mockClient: {
    getCrypto: ReturnType<typeof vi.fn>
    getKeyBackupManager: ReturnType<typeof vi.fn>
    getStoredDevice: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockCrypto = { resetKeyBackup: vi.fn().mockResolvedValue(undefined) }
    mockClient = {
      getCrypto: vi.fn(() => mockCrypto),
      getKeyBackupManager: vi.fn(() => ({})),
      getStoredDevice: vi.fn()
    }
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as unknown as MatrixClient)
    vi.spyOn(matrixClientService, 'getUserId').mockReturnValue('@alice:example.com')
    vi.spyOn(matrixClientService, 'getDeviceId').mockReturnValue('DEVICE123')
  })

  it('通过真实 API resetKeyBackup 创建备份，而不是调用幻影方法', async () => {
    const ok = await matrixEncryptionContextService.ensureKeyBackupVersion()

    expect(mockCrypto.resetKeyBackup).toHaveBeenCalledTimes(1)
    expect(ok).toBe(true)
  })

  it('crypto 不可用时返回 false，而不是假装成功', async () => {
    mockClient.getCrypto = vi.fn(() => null)

    const ok = await matrixEncryptionContextService.ensureKeyBackupVersion()

    expect(ok).toBe(false)
  })

  it('resetKeyBackup 失败时抛错，让调用方走失败分支', async () => {
    mockCrypto.resetKeyBackup.mockRejectedValueOnce(new Error('server rejected'))

    await expect(matrixEncryptionContextService.ensureKeyBackupVersion()).rejects.toThrow('server rejected')
  })
})
