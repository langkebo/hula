import { invoke } from '@tauri-apps/api/core'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SecureStorage')

type SecureStorageAvailabilityResponse = {
  available?: boolean
  backend?: string
}

let availabilityPromise: Promise<boolean> | null = null
let availabilityCheckedAt = 0
/** keychain 可用性缓存有效期：60s。超时后重新检测，应对 macOS keychain 首次授权弹窗场景。 */
const AVAILABILITY_CACHE_TTL_MS = 60_000

async function resolveSecureStorageAvailability(): Promise<boolean> {
  if (!hasTauriRuntime()) {
    return false
  }

  try {
    const result = await invoke<SecureStorageAvailabilityResponse>('check_secure_storage_available')
    availabilityCheckedAt = Date.now()
    return Boolean(result?.available)
  } catch (error) {
    logger.warn('检测 secure storage 可用性失败，回退到非持久化方案', error)
    availabilityCheckedAt = Date.now()
    return false
  }
}

async function isSecureStorageAvailable(): Promise<boolean> {
  // 缓存过期后重新检测：macOS 首次使用 keychain 时会弹出授权弹窗，
  // 用户授权后 keychain 变为可用，但旧缓存仍然为 false。
  if (availabilityPromise && Date.now() - availabilityCheckedAt > AVAILABILITY_CACHE_TTL_MS) {
    availabilityPromise = null
  }
  availabilityPromise ??= resolveSecureStorageAvailability()
  return availabilityPromise
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
