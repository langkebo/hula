import { describe, expect, it } from 'vitest'
import {
  clearMatrixSessionEndpointConfig,
  getDefaultMatrixEndpointConfig,
  isValidHttpUrl,
  MATRIX_HOMESERVER_STORAGE_KEY,
  MATRIX_IDENTITY_SERVER_STORAGE_KEY,
  MATRIX_SESSION_HOMESERVER_STORAGE_KEY,
  MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY,
  normalizeHttpUrl,
  resolveMatrixEndpointConfig,
  resolveMatrixRuntimeEndpointConfig,
  resolveMatrixRuntimeHomeserverUrl,
  resolveMatrixSessionEndpointConfig,
  saveMatrixHomeserverUrl,
  saveMatrixIdentityServerUrl,
  saveMatrixSessionEndpointConfig
} from '../config'
import type { StorageLike } from '../types'

function createStorage(initialState: Record<string, string> = {}): StorageLike {
  const state = new Map(Object.entries(initialState))

  return {
    getItem(key) {
      return state.get(key) ?? null
    },
    setItem(key, value) {
      state.set(key, value)
    },
    removeItem(key) {
      state.delete(key)
    }
  }
}

function withMockWindowLocation<T>(callback: () => T): T {
  const previousWindow = globalThis.window

  Object.defineProperty(globalThis, 'window', {
    value: {
      __TAURI_INTERNALS__: undefined,
      location: {
        origin: 'http://localhost:6130',
        protocol: 'http:',
        port: '6130'
      }
    },
    configurable: true
  })

  try {
    return callback()
  } finally {
    if (previousWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window')
    } else {
      Object.defineProperty(globalThis, 'window', {
        value: previousWindow,
        configurable: true
      })
    }
  }
}

describe('backend config', () => {
  it('normalizes bare hosts into http urls', () => {
    expect(normalizeHttpUrl('matrix.example.com')).toBe('http://matrix.example.com')
    expect(normalizeHttpUrl(' https://matrix.example.com ')).toBe('https://matrix.example.com')
  })

  it('validates only http and https urls', () => {
    expect(isValidHttpUrl('https://matrix.example.com')).toBe(true)
    expect(isValidHttpUrl('http://localhost:8008')).toBe(true)
    expect(isValidHttpUrl('ftp://matrix.example.com')).toBe(false)
    expect(isValidHttpUrl('not-a-url')).toBe(false)
  })

  it('falls back to defaults when storage is empty', () => {
    const storage = createStorage()

    expect(resolveMatrixEndpointConfig(storage)).toEqual(getDefaultMatrixEndpointConfig())
  })

  it('prefers stored homeserver over env defaults', () => {
    const storage = createStorage({
      [MATRIX_HOMESERVER_STORAGE_KEY]: 'https://matrix.internal'
    })

    expect(resolveMatrixEndpointConfig(storage).homeserverUrl).toBe('https://matrix.internal')
  })

  it('migrates legacy stored homeserver values back to the env default', () => {
    const storage = createStorage({
      [MATRIX_HOMESERVER_STORAGE_KEY]: 'http://localhost:28008'
    })

    expect(resolveMatrixEndpointConfig(storage).homeserverUrl).toBe(getDefaultMatrixEndpointConfig().homeserverUrl)
    expect(storage.getItem(MATRIX_HOMESERVER_STORAGE_KEY)).toBeNull()
  })

  it('persists normalized homeserver urls through the shared helper', () => {
    const storage = createStorage()

    const savedUrl = saveMatrixHomeserverUrl('matrix.internal', storage)

    expect(savedUrl).toBe('http://matrix.internal')
    expect(storage.getItem(MATRIX_HOMESERVER_STORAGE_KEY)).toBe('http://matrix.internal')
  })

  it('clears a stored identity server configuration and falls back to defaults', () => {
    const storage = createStorage({
      [MATRIX_IDENTITY_SERVER_STORAGE_KEY]: 'https://identity.example.com'
    })

    expect(saveMatrixIdentityServerUrl('', storage)).toBe('')
    expect(storage.getItem(MATRIX_IDENTITY_SERVER_STORAGE_KEY)).toBeNull()
    expect(resolveMatrixEndpointConfig(storage).identityServerUrl).toBe(
      getDefaultMatrixEndpointConfig().identityServerUrl
    )
  })

  it('rewrites local homeserver requests only when the current runtime uses the dev proxy', () => {
    withMockWindowLocation(() => {
      const expectedUrl = import.meta.env.DEV ? 'http://localhost:6130' : 'http://localhost:8008'
      const expectedLoopbackUrl = import.meta.env.DEV ? 'http://localhost:6130' : 'http://127.0.0.1:8008'

      expect(resolveMatrixRuntimeHomeserverUrl('http://localhost:8008')).toBe(expectedUrl)
      expect(resolveMatrixRuntimeHomeserverUrl('http://127.0.0.1:8008')).toBe(expectedLoopbackUrl)
    })
  })

  it('keeps the real local homeserver url in tauri runtime even during dev', () => {
    withMockWindowLocation(() => {
      ;(globalThis.window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}

      expect(resolveMatrixRuntimeHomeserverUrl('http://localhost:8008')).toBe('http://localhost:8008')
      expect(resolveMatrixRuntimeHomeserverUrl('http://127.0.0.1:8008')).toBe('http://127.0.0.1:8008')
    })
  })

  it('keeps custom homeserver urls unchanged outside the local dev proxy rewrite case', () => {
    const storage = createStorage({
      [MATRIX_HOMESERVER_STORAGE_KEY]: 'https://matrix.example.com'
    })

    withMockWindowLocation(() => {
      expect(resolveMatrixRuntimeEndpointConfig(storage).homeserverUrl).toBe('https://matrix.example.com')
    })
  })

  it('prefers session-bound endpoint config over the global config', () => {
    const storage = createStorage({
      [MATRIX_HOMESERVER_STORAGE_KEY]: 'https://matrix.global.example.com',
      [MATRIX_IDENTITY_SERVER_STORAGE_KEY]: 'https://identity.global.example.com',
      [MATRIX_SESSION_HOMESERVER_STORAGE_KEY]: 'https://matrix.session.example.com',
      [MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY]: 'https://identity.session.example.com'
    })

    expect(resolveMatrixSessionEndpointConfig(storage)).toEqual({
      homeserverUrl: 'https://matrix.session.example.com',
      identityServerUrl: 'https://identity.session.example.com'
    })
  })

  it('clears legacy session-bound homeserver values and falls back to runtime config', () => {
    const storage = createStorage({
      [MATRIX_HOMESERVER_STORAGE_KEY]: 'https://matrix.test',
      [MATRIX_SESSION_HOMESERVER_STORAGE_KEY]: 'http://localhost:28008',
      [MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY]: 'https://identity.legacy.example.com'
    })

    expect(resolveMatrixSessionEndpointConfig(storage)).toEqual({
      homeserverUrl: 'https://matrix.test',
      identityServerUrl: getDefaultMatrixEndpointConfig().identityServerUrl
    })
    expect(storage.getItem(MATRIX_SESSION_HOMESERVER_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY)).toBeNull()
  })

  it('persists and clears session-bound endpoint config', () => {
    const storage = createStorage()

    expect(
      saveMatrixSessionEndpointConfig({ homeserverUrl: 'matrix.session.internal', identityServerUrl: '' }, storage)
    ).toEqual({
      homeserverUrl: 'http://matrix.session.internal',
      identityServerUrl: ''
    })
    expect(storage.getItem(MATRIX_SESSION_HOMESERVER_STORAGE_KEY)).toBe('http://matrix.session.internal')
    expect(storage.getItem(MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY)).toBeNull()

    clearMatrixSessionEndpointConfig(storage)
    expect(storage.getItem(MATRIX_SESSION_HOMESERVER_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY)).toBeNull()
  })
})
