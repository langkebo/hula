import { invoke } from '@tauri-apps/api/core'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SecureStorage')

/**
 * Rust 侧 `check_secure_storage_available` 的响应。
 *
 * `backend` / `nativeAvailable` / `degraded` 是 2026-10-13 新增字段：
 * 历史实现把 `backend` 按平台**硬编码**（macOS 恒为 `macos_keychain`），
 * 于是「keychain 写失败、secret 落在 master-key 加密的文件里」这一降级
 * 在两层日志里都显示成"keychain 可用"。三个字段对老版本二进制保持可选
 * （见 `mapBackendInfo` 的兼容推导）。
 */
type SecureStorageAvailabilityResponse = {
  available?: boolean
  backend?: string
  nativeAvailable?: boolean
  degraded?: boolean
}

/** 前端可依赖的安全存储后端事实（**不猜测**，全部来自 Rust 侧实测） */
export interface SecureStorageBackendInfo {
  /** 至少一个后端可用（原生密钥库或加密文件 fallback） */
  available: boolean
  /** 实际生效的后端标识：原生密钥库名 / `encrypted_file_fallback` / null */
  backend: string | null
  /** 平台原生密钥库（Keychain / Credential Manager / Secret Service）实测可用 */
  nativeAvailable: boolean
  /** `available && !nativeAvailable`：secret 只受 master-key 加密的文件保护 */
  degraded: boolean
}

/** 加密文件 fallback 的后端标识（与 Rust `StorageBackend::EncryptedFileFallback.id()` 一致） */
export const ENCRYPTED_FILE_FALLBACK_BACKEND = 'encrypted_file_fallback'

const UNAVAILABLE_INFO: SecureStorageBackendInfo = {
  available: false,
  backend: null,
  nativeAvailable: false,
  degraded: false
}

let backendInfoPromise: Promise<SecureStorageBackendInfo> | null = null
let availabilityCheckedAt = 0
/** keychain 可用性缓存有效期：60s。超时后重新检测，应对 macOS keychain 首次授权弹窗场景。 */
const AVAILABILITY_CACHE_TTL_MS = 60_000

/**
 * 把 IPC 响应映射为后端事实。
 *
 * 兼容推导（老二进制无新字段时）：
 * - `degraded` 缺省 ⇒ 以 `backend === 'encrypted_file_fallback'` 为准；
 * - `nativeAvailable` 缺省 ⇒ `available && !degraded`（老实现只有在原生可用时才报
 *   平台名，但它并不区分，故这里只做保守推导，绝不把未知后端当作原生）。
 */
export function mapBackendInfo(result: SecureStorageAvailabilityResponse | null | undefined): SecureStorageBackendInfo {
  const available = Boolean(result?.available)
  const backend = typeof result?.backend === 'string' && result.backend.length > 0 ? result.backend : null
  const degraded = typeof result?.degraded === 'boolean' ? result.degraded : backend === ENCRYPTED_FILE_FALLBACK_BACKEND
  const nativeAvailable = typeof result?.nativeAvailable === 'boolean' ? result.nativeAvailable : available && !degraded
  return { available, backend, nativeAvailable, degraded }
}

/**
 * 人类可读的后端描述，供日志使用。
 * **不得**在降级时出现 "keychain" 字样 —— 这正是被修复的那类日志谎言。
 */
export function describeSecureStorageBackend(info: SecureStorageBackendInfo): string {
  if (!info.available) return '安全存储（后端未上报）'
  if (info.degraded) {
    return `加密文件 fallback（系统密钥库不可用，backend=${info.backend ?? 'unknown'}）`
  }
  return `系统密钥库（backend=${info.backend ?? 'unknown'}）`
}

async function resolveSecureStorageBackend(): Promise<SecureStorageBackendInfo> {
  if (!hasTauriRuntime()) {
    return UNAVAILABLE_INFO
  }

  try {
    const result = await invoke<SecureStorageAvailabilityResponse>('check_secure_storage_available')
    availabilityCheckedAt = Date.now()
    const info = mapBackendInfo(result)
    if (info.degraded) {
      // 一次性、显式地把降级摆到日志顶层：secret 实际只受本机 master-key 加密保护，
      // 与「已存入操作系统密钥库」不是同一安全等级。
      logger.warn(
        `[SecureStorage] 降级：系统密钥库不可用，secret 仅由本机 master-key 加密的文件保护（backend=${info.backend ?? 'unknown'}）`
      )
    } else {
      logger.info(`[SecureStorage] 生效后端：${describeSecureStorageBackend(info)}`)
    }
    return info
  } catch (error) {
    logger.warn('检测 secure storage 可用性失败，回退到非持久化方案', error)
    availabilityCheckedAt = Date.now()
    return UNAVAILABLE_INFO
  }
}

/**
 * 读取安全存储的后端事实（带 60s 缓存；失败/非 Tauri 环境返回"不可用"）。
 *
 * 缓存过期后重新检测：macOS 首次使用 keychain 时会弹出授权弹窗，
 * 用户授权后 keychain 变为可用，但旧缓存仍然为 false。
 */
export async function getSecureStorageBackendInfo(): Promise<SecureStorageBackendInfo> {
  if (backendInfoPromise && Date.now() - availabilityCheckedAt > AVAILABILITY_CACHE_TTL_MS) {
    backendInfoPromise = null
  }
  backendInfoPromise ??= resolveSecureStorageBackend()
  try {
    return await backendInfoPromise
  } catch {
    return UNAVAILABLE_INFO
  }
}

async function isSecureStorageAvailable(): Promise<boolean> {
  return (await getSecureStorageBackendInfo()).available
}

/** 清空可用性缓存（登出/测试用：下一次调用会重新探测） */
export function resetSecureStorageBackendCache(): void {
  backendInfoPromise = null
  availabilityCheckedAt = 0
}

export async function getSecureSecret(key: string): Promise<string | null> {
  if (!(await isSecureStorageAvailable())) {
    return null
  }

  try {
    const value = await invoke<string | null>('get_secret', { key })
    return value ?? null
  } catch (error) {
    logger.warn(`读取 secure storage 失败: ${key}`, error)
    return null
  }
}

export async function setSecureSecret(key: string, value: string): Promise<boolean> {
  if (!(await isSecureStorageAvailable())) {
    return false
  }

  try {
    await invoke('set_secret', { key, value })
    return true
  } catch (error) {
    logger.warn(`写入 secure storage 失败: ${key}`, error)
    return false
  }
}

export async function deleteSecureSecret(key: string): Promise<boolean> {
  if (!(await isSecureStorageAvailable())) {
    return false
  }

  try {
    await invoke('delete_secret', { key })
    return true
  } catch (error) {
    logger.warn(`删除 secure storage 失败: ${key}`, error)
    return false
  }
}
