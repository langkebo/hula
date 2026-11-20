import type { SecureStorageBackendInfo } from '@/services/secure/secureStorage'

/**
 * 安全存储后端探测结果。
 *
 * 类型来源：`secureStorage` 导出的 `SecureStorageBackendInfo`。
 */
export function makeSecureStorageBackendInfo(
  overrides: Partial<SecureStorageBackendInfo> = {}
): SecureStorageBackendInfo {
  return {
    available: true,
    backend: 'macos_keychain',
    nativeAvailable: true,
    degraded: false,
    ...overrides
  }
}
