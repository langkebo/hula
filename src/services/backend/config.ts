import type { MatrixEndpointConfig, StorageLike } from './types'
import { hasTauriRuntime } from '@/utils/AppHarness'

export const MATRIX_HOMESERVER_STORAGE_KEY = 'hula-homeserver-url'
export const MATRIX_IDENTITY_SERVER_STORAGE_KEY = 'hula-identity-server-url'
export const DEFAULT_MATRIX_HOMESERVER_URL = 'http://localhost:28008'
export const DEFAULT_MATRIX_IDENTITY_SERVER_URL = 'https://vector.im'
const MATRIX_DEV_PROXY_PORT = '6130'
const MATRIX_DEV_PROXY_TARGET_PORT = '28008'

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
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
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

export function resolveMatrixEndpointConfig(storage?: StorageLike): MatrixEndpointConfig {
  const targetStorage = getStorage(storage)
  const defaults = getDefaultMatrixEndpointConfig()

  return {
    homeserverUrl: targetStorage?.getItem(MATRIX_HOMESERVER_STORAGE_KEY) || defaults.homeserverUrl,
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

  return window.location.protocol.startsWith('http') && window.location.port === MATRIX_DEV_PROXY_PORT
}

function shouldRewriteHomeserverToDevProxy(homeserverUrl: string): boolean {
  if (!shouldUseMatrixDevProxy()) {
    return false
  }

  try {
    const targetUrl = new URL(homeserverUrl)
    return (
      (targetUrl.hostname === 'localhost' || targetUrl.hostname === '127.0.0.1') &&
      targetUrl.port === MATRIX_DEV_PROXY_TARGET_PORT &&
      targetUrl.protocol === window.location.protocol
    )
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

export function saveMatrixHomeserverUrl(url: string, storage?: StorageLike): string {
  const normalizedUrl = normalizeHttpUrl(url)
  getStorage(storage)?.setItem(MATRIX_HOMESERVER_STORAGE_KEY, normalizedUrl)
  return normalizedUrl
}

export function saveMatrixIdentityServerUrl(url: string, storage?: StorageLike): string {
  const normalizedUrl = normalizeHttpUrl(url)
  getStorage(storage)?.setItem(MATRIX_IDENTITY_SERVER_STORAGE_KEY, normalizedUrl)
  return normalizedUrl
}
