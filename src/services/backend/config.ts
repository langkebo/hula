import { hasTauriRuntime } from '@/utils/AppHarness'
import type { MatrixEndpointConfig, StorageLike } from './types'

export const MATRIX_HOMESERVER_STORAGE_KEY = 'hula-homeserver-url'
export const MATRIX_IDENTITY_SERVER_STORAGE_KEY = 'hula-identity-server-url'
export const MATRIX_SESSION_HOMESERVER_STORAGE_KEY = 'hula-session-homeserver-url'
export const MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY = 'hula-session-identity-server-url'
export const DEFAULT_MATRIX_HOMESERVER_URL = 'http://localhost:8008'
export const DEFAULT_MATRIX_IDENTITY_SERVER_URL = ''
const MATRIX_DEV_PROXY_PORT = '6130'
const MATRIX_DEV_PROXY_TARGET_PORT = '8008'
const LEGACY_LOCAL_MATRIX_HOMESERVER_URLS = new Set([
  'http://localhost:8008',
  'http://127.0.0.1:8008',
  'http://localhost:28008',
  'http://127.0.0.1:28008',
  'https://localhost:28008',
  'https://127.0.0.1:28008'
])

function getStorage(storage?: StorageLike): StorageLike | undefined {
  if (storage) {
    return storage
  }

  if (typeof window === 'undefined') {
    return undefined
  }

  return window.localStorage
}

export function normalizeHttpUrl(value: string): string {
  let trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  // 13.4.2: homeserver.base_url 拿到 0.0.0.0 或 :: 时回退到 localhost
  if (trimmed === '0.0.0.0' || trimmed === '::') {
    trimmed = 'localhost'
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed)
      if (url.hostname === '0.0.0.0' || url.hostname === '::') {
        url.hostname = 'localhost'
        trimmed = url.toString()
      }
    } catch {
      // 忽略无效的 URL 格式
    }
    return trimmed
  }

  return `http://${trimmed}`
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function getDefaultMatrixEndpointConfig(): MatrixEndpointConfig {
  return {
    homeserverUrl: import.meta.env.VITE_HOMESERVER_URL || DEFAULT_MATRIX_HOMESERVER_URL,
    identityServerUrl: import.meta.env.VITE_IDENTITY_SERVER_URL || DEFAULT_MATRIX_IDENTITY_SERVER_URL
  }
}

function shouldMigrateLegacyHomeserverUrl(storedHomeserverUrl: string, defaultHomeserverUrl: string): boolean {
  if (!LEGACY_LOCAL_MATRIX_HOMESERVER_URLS.has(storedHomeserverUrl)) {
    return false
  }

  try {
    const defaultUrl = new URL(defaultHomeserverUrl)
    return defaultUrl.hostname !== 'localhost' && defaultUrl.hostname !== '127.0.0.1'
  } catch {
    return false
  }
}

export function resolveMatrixEndpointConfig(storage?: StorageLike): MatrixEndpointConfig {
  const targetStorage = getStorage(storage)
  const defaults = getDefaultMatrixEndpointConfig()
  const storedHomeserverUrl = targetStorage?.getItem(MATRIX_HOMESERVER_STORAGE_KEY)?.trim()

  if (storedHomeserverUrl && shouldMigrateLegacyHomeserverUrl(storedHomeserverUrl, defaults.homeserverUrl)) {
    targetStorage?.removeItem(MATRIX_HOMESERVER_STORAGE_KEY)

    return {
      homeserverUrl: defaults.homeserverUrl,
      identityServerUrl: targetStorage?.getItem(MATRIX_IDENTITY_SERVER_STORAGE_KEY) || defaults.identityServerUrl
    }
  }

  return {
    homeserverUrl: storedHomeserverUrl || defaults.homeserverUrl,
    identityServerUrl: targetStorage?.getItem(MATRIX_IDENTITY_SERVER_STORAGE_KEY) || defaults.identityServerUrl
  }
}

function shouldUseMatrixDevProxy(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return false
  }

  if (hasTauriRuntime()) {
    return false
  }

  return (
    window.location.protocol.startsWith('http') &&
    (window.location.port === MATRIX_DEV_PROXY_PORT || window.location.port === '5210')
  )
}

function shouldRewriteHomeserverToDevProxy(homeserverUrl: string): boolean {
  if (!shouldUseMatrixDevProxy()) {
    return false
  }

  try {
    const targetUrl = new URL(homeserverUrl)
    const appOrigin = window.location.origin

    // Already pointing to the app origin, no rewrite needed
    if (targetUrl.origin === appOrigin) {
      return false
    }

    // Rewrite localhost:8008 (standard Matrix dev proxy target)
    if (
      (targetUrl.hostname === 'localhost' || targetUrl.hostname === '127.0.0.1') &&
      targetUrl.port === MATRIX_DEV_PROXY_TARGET_PORT &&
      targetUrl.protocol === window.location.protocol
    ) {
      return true
    }

    // Rewrite any HTTPS homeserver URL when running in HTTP dev mode
    // (browser cannot reach HTTPS endpoints directly; Vite proxy handles it)
    if (targetUrl.protocol === 'https:' && window.location.protocol === 'http:') {
      return true
    }

    return false
  } catch {
    return false
  }
}

export function resolveMatrixRuntimeHomeserverUrl(homeserverUrl: string): string {
  if (!shouldRewriteHomeserverToDevProxy(homeserverUrl)) {
    return homeserverUrl
  }

  return window.location.origin
}

export function resolveMatrixRuntimeEndpointConfig(storage?: StorageLike): MatrixEndpointConfig {
  const config = resolveMatrixEndpointConfig(storage)

  return {
    ...config,
    homeserverUrl: resolveMatrixRuntimeHomeserverUrl(config.homeserverUrl)
  }
}

export function resolveMatrixSessionEndpointConfig(storage?: StorageLike): MatrixEndpointConfig {
  const targetStorage = getStorage(storage)
  const runtimeConfig = resolveMatrixRuntimeEndpointConfig(storage)
  const sessionHomeserverUrl = targetStorage?.getItem(MATRIX_SESSION_HOMESERVER_STORAGE_KEY)?.trim()
  const sessionIdentityServerUrl = targetStorage?.getItem(MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY)?.trim()

  if (!sessionHomeserverUrl) {
    return runtimeConfig
  }

  if (shouldMigrateLegacyHomeserverUrl(sessionHomeserverUrl, runtimeConfig.homeserverUrl)) {
    targetStorage?.removeItem(MATRIX_SESSION_HOMESERVER_STORAGE_KEY)
    targetStorage?.removeItem(MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY)
    return runtimeConfig
  }

  return {
    homeserverUrl: resolveMatrixRuntimeHomeserverUrl(sessionHomeserverUrl),
    identityServerUrl: sessionIdentityServerUrl || runtimeConfig.identityServerUrl
  }
}

export function saveMatrixHomeserverUrl(url: string, storage?: StorageLike): string {
  const normalizedUrl = normalizeHttpUrl(url)
  getStorage(storage)?.setItem(MATRIX_HOMESERVER_STORAGE_KEY, normalizedUrl)
  return normalizedUrl
}

export function saveMatrixIdentityServerUrl(url: string, storage?: StorageLike): string {
  const trimmedUrl = url.trim()
  const targetStorage = getStorage(storage)

  if (!trimmedUrl) {
    targetStorage?.removeItem(MATRIX_IDENTITY_SERVER_STORAGE_KEY)
    return ''
  }

  const normalizedUrl = normalizeHttpUrl(trimmedUrl)
  targetStorage?.setItem(MATRIX_IDENTITY_SERVER_STORAGE_KEY, normalizedUrl)
  return normalizedUrl
}

export function saveMatrixSessionEndpointConfig(
  config: MatrixEndpointConfig,
  storage?: StorageLike
): MatrixEndpointConfig {
  const targetStorage = getStorage(storage)
  const normalizedHomeserverUrl = normalizeHttpUrl(config.homeserverUrl)
  targetStorage?.setItem(MATRIX_SESSION_HOMESERVER_STORAGE_KEY, normalizedHomeserverUrl)

  const normalizedIdentityServerUrl = config.identityServerUrl ? normalizeHttpUrl(config.identityServerUrl) : ''

  if (normalizedIdentityServerUrl) {
    targetStorage?.setItem(MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY, normalizedIdentityServerUrl)
  } else {
    targetStorage?.removeItem(MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY)
  }

  return {
    homeserverUrl: normalizedHomeserverUrl,
    identityServerUrl: normalizedIdentityServerUrl
  }
}

export function clearMatrixSessionEndpointConfig(storage?: StorageLike): void {
  const targetStorage = getStorage(storage)
  targetStorage?.removeItem(MATRIX_SESSION_HOMESERVER_STORAGE_KEY)
  targetStorage?.removeItem(MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY)
}
