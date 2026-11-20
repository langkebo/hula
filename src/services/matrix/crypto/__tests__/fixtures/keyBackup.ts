/**
 * 密钥备份信息测试夹具。
 *
 * 契约来源：`MatrixEncryptionService.KeyBackupInfo`
 * （`getKeyBackupInfo()` 返回值；字段为 camelCase `authData`）。
 */
import type { KeyBackupInfo } from '@/services/matrix/crypto/MatrixEncryptionService'

export function makeKeyBackupInfo(overrides: Partial<KeyBackupInfo> = {}): KeyBackupInfo {
  return {
    version: '1',
    algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
    authData: {},
    count: 0,
    ...overrides
  }
}
