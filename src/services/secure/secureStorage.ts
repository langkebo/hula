import { invoke } from '@tauri-apps/api/core'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SecureStorage')

type SecureStorageAvailabilityResponse = {
  available?: boolean
  backend?: string
}

let availabilityPromise: Promise<boolean> | null = null

async function resolveSecureStorageAvailability(): Promise<boolean> {
  if (!hasTauriRuntime()) {
    return false
  }

  try {
    const result = await invoke<SecureStorageAvailabilityResponse>('check_secure_storage_available')
    return Boolean(result?.available)
  } catch (error) {
    logger.warn('检测 secure storage 可用性失败，回退到非持久化方案', error)
    return false
  }
}

export async function isSecureStorageAvailable(): Promise<boolean> {
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
