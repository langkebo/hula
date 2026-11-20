/**
 * crypto 域测试夹具（加密面板 / 密钥备份 / 设备验证）。
 *
 * 类型来自真实契约：
 * - `KeyBackupRestoreResult` / `KeyExportResult` / `KeyImportResult` / `DeviceVerificationResult`
 *   取自 `cryptoAdapterTypes.ts`（`CryptoSDKAdapter` 的返回类型）；
 * - `BackupInfo` 取自 `@/types/matrix-extensions`（`KeyBackupManager.checkKeyBackup` 的返回值）。
 *
 * ⚠️ 修正的假结构：`DeviceVerificationResult.tofu` 是**必填**字段（TS 接口无 `?`），
 * 旧测试 mock 的验证状态缺该键，与契约不符；夹具统一带上。
 */
import type { BackupInfo } from '@/types/matrix-extensions'
import type {
  DeviceInfo,
  DeviceVerificationResult,
  KeyBackupRestoreResult,
  KeyExportResult,
  KeyImportResult
} from '../../cryptoAdapterTypes'
import type { CrossSigningInfo, KeyRotationStatus } from '../../MatrixEncryptionService'

/** `getCrossSigningInfo()`（服务层与 `useEncryption` 同形）的交叉签名状态 */
export function makeCrossSigningInfo(overrides: Partial<CrossSigningInfo> = {}): CrossSigningInfo {
  return {
    isSetup: false,
    masterPublicKey: null,
    selfSigningPublicKey: null,
    userSigningPublicKey: null,
    ...overrides
  }
}

/** `matrixEncryptionService.getKeyRotationStatus()` 的轮换状态 */
export function makeKeyRotationStatus(overrides: Partial<KeyRotationStatus> = {}): KeyRotationStatus {
  return { enabled: true, intervalMs: 86_400_000, needsRotation: false, ...overrides }
}

/** `cryptoSDKAdapter.restoreFromBackup()` 的导入统计 */
export function makeKeyBackupRestoreResult(overrides: Partial<KeyBackupRestoreResult> = {}): KeyBackupRestoreResult {
  return { imported: 10, total: 12, ...overrides }
}

/** `matrixKeyBackupService.checkKeyBackup()` 的备份元信息 */
export function makeKeyBackupInfo(overrides: Partial<BackupInfo> = {}): BackupInfo {
  return {
    version: '1',
    algorithm: 'm.megolm_backup.v1.aes-sha2',
    auth_data: { iv: 'fixture-iv', mac: 'fixture-mac' },
    ...overrides
  }
}

/** `cryptoSDKAdapter.getDevices()` 的单台设备（`DeviceInfo`） */
export function makeDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: 'DEVICE',
    userId: '@user:server.test',
    ...overrides
  }
}

/** `matrixCryptoService.getDeviceVerificationStatus()` 的设备验证状态 */
export function makeDeviceVerificationResult(
  overrides: Partial<DeviceVerificationResult> = {}
): DeviceVerificationResult {
  return {
    verified: false,
    crossSigningVerified: false,
    devicesCrossSigningVerified: false,
    tofu: false,
    ...overrides
  }
}

/** `cryptoSDKAdapter.exportKeys()` 的导出结果 */
export function makeKeyExportResult(overrides: Partial<KeyExportResult> = {}): KeyExportResult {
  return { data: '{"keys":[]}', count: 0, ...overrides }
}

/** `cryptoSDKAdapter.importKeys()` 的导入统计 */
export function makeKeyImportResult(overrides: Partial<KeyImportResult> = {}): KeyImportResult {
  return { imported: 5, total: 5, ...overrides }
}
