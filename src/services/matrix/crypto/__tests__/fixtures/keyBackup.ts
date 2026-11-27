/**
 * 密钥备份信息测试夹具。
 *
 * 契约来源：`MatrixEncryptionService.KeyBackupInfo`
 * （`getKeyBackupInfo()` 返回值；字段为 camelCase `authData`）。
 */
import type { KeyBackupInfo } from '@/services/matrix/crypto/MatrixEncryptionService'
import type { KeyBackupInfo as SdkKeyBackupInfo } from '@/types/matrix-extensions'

/** SDK `CryptoApi.getKeyBackupInfo()` 返回的备份版本概要（snake_case `auth_data`）。 */
export function makeSdkKeyBackupInfo(overrides: Partial<SdkKeyBackupInfo> = {}): SdkKeyBackupInfo {
  return {
    version: '2',
    algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
    auth_data: { public_key: 'fixture-public-key', signatures: {} },
    count: 0,
    ...overrides
  }
}

export function makeKeyBackupInfo(overrides: Partial<KeyBackupInfo> = {}): KeyBackupInfo {
  return {
    version: '1',
    algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
    authData: {},
    count: 0,
    ...overrides
  }
}
