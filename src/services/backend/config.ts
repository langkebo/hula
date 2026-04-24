import type { MatrixEndpointConfig, StorageLike } from './types'

export const MATRIX_HOMESERVER_STORAGE_KEY = 'hula-homeserver-url'
export const MATRIX_IDENTITY_SERVER_STORAGE_KEY = 'hula-identity-server-url'
export const DEFAULT_MATRIX_HOMESERVER_URL = 'http://localhost:8008'
export const DEFAULT_MATRIX_IDENTITY_SERVER_URL = 'https://vector.im'

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
